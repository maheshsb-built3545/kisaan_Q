'use strict';

const mongoose = require('mongoose');
const { RedirectOffer, InboundQuota, Booking, Notification } = require('../models');
const notificationService = require('./notificationService');
const { AuditLog } = require('../models');
const logger = require('../utils/logger');

const REDIRECT_OFFER_TTL_SECONDS = parseInt(process.env.REDIRECT_OFFER_TTL_SECONDS || '3600', 10);

/**
 * Propose redirects for a set of farmers at a centre on a date.
 * Skips CHECKED_IN bookings and crops not handled at receiving centre.
 */
async function proposeRedirect({ farmerId, fromCentre, toCentre, date, hour, proposedBy, distanceKm, toCentreHeatStatus }) {
  if (!farmerId || !fromCentre || !toCentre || !date || hour === undefined) {
    throw new Error('farmerId, fromCentre, toCentre, date, hour are required');
  }

  const expiresAt = new Date(Date.now() + REDIRECT_OFFER_TTL_SECONDS * 1000);

  const mongoose = require('mongoose');

  // Check farmer's booking isn't already CHECKED_IN
  // Resolve centre code → ObjectId
  const { Centre } = require('../models');
  const fromCentreDoc = await Centre.findOne({ code: fromCentre.toUpperCase() }).select('_id').lean();
  const centreQuery = fromCentreDoc ? { centreId: fromCentreDoc._id } : {};

  // farmerId may be an ObjectId ref or a string (phone/id) depending on context
  const farmerQuery = mongoose.isValidObjectId(farmerId) ? { farmerId } : {};

  const booking = await Booking.findOne({
    ...farmerQuery,
    ...centreQuery,
    arrivalWindowStart: { $gte: new Date(date + 'T00:00:00Z'), $lte: new Date(date + 'T23:59:59Z') },
    status: { $in: ['BOOKED', 'CONFIRMED'] }
  });

  if (!booking) {
    return null; // No eligible booking
  }

  // Don't send duplicate pending offers
  const existing = await RedirectOffer.findOne({
    farmerId, fromCentre, toCentre, date, status: 'pending'
  });
  if (existing) return existing;

  const offer = await RedirectOffer.create({
    farmerId,
    fromCentre: fromCentre.toUpperCase(),
    toCentre: toCentre.toUpperCase(),
    date,
    hour: Number(hour),
    originalBookingId: booking._id,
    status: 'pending',
    expiresAt,
    proposedBy,
    distanceKm,
    toCentreHeatStatus: toCentreHeatStatus || 'Green'
  });

  // Notify farmer
  await notificationService.notify(
    { id: farmerId.toString(), type: 'farmer' },
    'redirect_offer',
    {
      offerId: offer._id.toString(),
      fromCentre,
      toCentre,
      date,
      distanceKm,
      heatStatus: toCentreHeatStatus || 'Green'
    },
    {}
  ).catch(() => {});

  return offer;
}

/**
 * Set inbound quota for a centre+date+hour.
 */
async function setInboundQuota({ centreId, date, hour, count, setBy }) {
  if (!centreId || !date || hour === undefined || !count) {
    throw new Error('centreId, date, hour, count required');
  }
  return InboundQuota.findOneAndUpdate(
    { centreId: centreId.toUpperCase(), date, hour: Number(hour) },
    { count: Number(count), setBy },
    { new: true, upsert: true }
  );
}

/**
 * Accept a redirect offer.
 * Atomically increments quota.used. Creates new booking at toCentre if quota available.
 * Never proceeds if quota is full or offer is not pending.
 */
async function acceptOffer({ offerId, farmerId }) {
  const offer = await RedirectOffer.findById(offerId);
  if (!offer) throw new Error('Redirect offer not found');
  if (offer.status !== 'pending') throw new Error(`Offer is already ${offer.status}`);
  if (offer.farmerId.toString() !== farmerId.toString()) throw new Error('Access denied');
  if (offer.expiresAt < new Date()) {
    offer.status = 'expired';
    await offer.save();
    throw new Error('Offer has expired');
  }

  // Atomically check+increment quota
  const quota = await InboundQuota.findOneAndUpdate(
    { centreId: offer.toCentre, date: offer.date, hour: offer.hour, $expr: { $lt: ['$used', '$count'] } },
    { $inc: { used: 1 } },
    { new: true }
  );

  if (!quota) {
    throw new Error('Inbound quota is full for this slot. No redirect possible.');
  }

  // Cancel original booking (change status to CANCELLED)
  await Booking.findByIdAndUpdate(offer.originalBookingId, { status: 'CANCELLED' });

  // Create new booking at receiving centre
  const origBooking = await Booking.findById(offer.originalBookingId).lean();
  const newArrivalStart = new Date(`${offer.date}T${String(offer.hour).padStart(2, '0')}:00:00.000Z`);
  const newArrivalEnd = new Date(newArrivalStart.getTime() + 60 * 60 * 1000);

  const tokenNumber = `REDIR-${offer.toCentre}-${Date.now().toString(36).toUpperCase()}`;

  const newBooking = await Booking.create({
    farmerId: offer.farmerId,
    centreId: offer.toCentre,
    crop: origBooking?.crop || 'Soybean',
    quantityBand: origBooking?.quantityBand || '5-15q',
    arrivalWindowStart: newArrivalStart,
    arrivalWindowEnd: newArrivalEnd,
    tokenNumber,
    status: 'CONFIRMED',
    channel: 'app'
  });

  // Update offer
  offer.status = 'accepted';
  offer.newBookingId = newBooking._id;
  offer.quotaRef = quota._id;
  await offer.save();

  // Audit both centres
  await AuditLog.create({
    actorId: farmerId.toString(), actorRole: 'farmer',
    action: 'REDIRECT_ACCEPTED',
    targetId: offer._id,
    reason: `Farmer accepted redirect from ${offer.fromCentre} to ${offer.toCentre}`
  }).catch(() => {});

  // Notify farmer of new token
  await notificationService.notify(
    { id: farmerId.toString(), type: 'farmer' },
    'redirect_accepted',
    { newToken: tokenNumber, toCentre: offer.toCentre, date: offer.date },
    {}
  ).catch(() => {});

  return { offer, newBooking };
}

/**
 * Decline a redirect offer (farmer declines).
 */
async function declineOffer({ offerId, farmerId }) {
  const offer = await RedirectOffer.findById(offerId);
  if (!offer) throw new Error('Redirect offer not found');
  if (offer.farmerId.toString() !== farmerId.toString()) throw new Error('Access denied');
  if (!['pending'].includes(offer.status)) throw new Error(`Offer is already ${offer.status}`);

  offer.status = 'declined';
  await offer.save();

  await AuditLog.create({
    actorId: farmerId.toString(), actorRole: 'farmer',
    action: 'REDIRECT_DECLINED',
    targetId: offer._id,
    reason: 'Farmer declined redirect'
  }).catch(() => {});

  return offer;
}

/**
 * Expire pending offers past their TTL.
 * Called by server.js setInterval.
 */
async function expireOffers() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const result = await RedirectOffer.updateMany(
      { status: 'pending', expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[Redirect] Expired ${result.modifiedCount} redirect offers`);
    }
  } catch (err) {
    logger.error(`[Redirect] expireOffers error: ${err.message}`);
  }
}

module.exports = {
  proposeRedirect,
  setInboundQuota,
  acceptOffer,
  declineOffer,
  expireOffers
};
