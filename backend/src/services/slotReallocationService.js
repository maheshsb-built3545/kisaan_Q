/**
 * KisanQ Automated Slot Release & Waitlist Reallocation Service (PRD 2.4)
 * 
 * Rules:
 * - WARN: 5 min after slot start (send arrival warning)
 * - GRACE: 10 min after slot start (auto-cancel unarrived token and release slot)
 * - OFFER: 10 min offer decision window for next waitlisted farmer
 * - Atomic accept & concurrency safety
 * - Configurable timings with second-level overrides for automated testing
 */

const mongoose = require('mongoose');
const Token = require('../models/Token');
const Waitlist = require('../models/Waitlist');
const SlotOffer = require('../models/SlotOffer');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Default Timings (in minutes)
const DEFAULT_WARN_MIN = 5;
const DEFAULT_GRACE_MIN = 10;
const DEFAULT_OFFER_MIN = 10;

/**
 * Helper to get active timing thresholds (supports env & testing overrides)
 */
function getTimingConfig(overrides = {}) {
  const warnSec = overrides.warnSec !== undefined ? overrides.warnSec : (process.env.SLOT_WARN_SEC ? Number(process.env.SLOT_WARN_SEC) : null);
  const graceSec = overrides.graceSec !== undefined ? overrides.graceSec : (process.env.SLOT_GRACE_SEC ? Number(process.env.SLOT_GRACE_SEC) : null);
  const offerSec = overrides.offerSec !== undefined ? overrides.offerSec : (process.env.SLOT_OFFER_SEC ? Number(process.env.SLOT_OFFER_SEC) : null);

  return {
    warnMs: warnSec !== null ? warnSec * 1000 : (Number(process.env.SLOT_WARN_MINUTES) || DEFAULT_WARN_MIN) * 60 * 1000,
    graceMs: graceSec !== null ? graceSec * 1000 : (Number(process.env.SLOT_GRACE_MINUTES) || DEFAULT_GRACE_MIN) * 60 * 1000,
    offerMs: offerSec !== null ? offerSec * 1000 : (Number(process.env.SLOT_OFFER_MINUTES) || DEFAULT_OFFER_MIN) * 60 * 1000
  };
}

/**
 * Helper to parse slot start timestamp
 * e.g. slotDate: '2026-09-20', slotTime: '08:00 AM - 11:00 AM' -> Date object
 */
function parseSlotStartTime(slotDateStr, slotTimeStr) {
  if (!slotDateStr) return new Date();
  
  let datePart = slotDateStr.trim();
  if (datePart.toLowerCase() === 'today') {
    datePart = new Date().toISOString().split('T')[0];
  }

  let hours = 8;
  let minutes = 0;

  if (slotTimeStr) {
    const match = slotTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const meridiem = match[3] ? match[3].toUpperCase() : null;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }
  }

  const d = new Date(datePart);
  if (isNaN(d.getTime())) {
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    return today;
  }

  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Background Execution Cycle
 * Processes:
 * 1. Warning alerts for unarrived slots >= WARN threshold
 * 2. Auto-release / cancellations for slots >= GRACE threshold
 * 3. Expired slot offers >= OFFER threshold
 */
async function processSlotReallocationCycle(options = {}) {
  const timings = getTimingConfig(options);
  const now = options.simulatedNow ? new Date(options.simulatedNow) : new Date();

  const results = {
    warningsIssued: 0,
    slotsReleased: 0,
    offersCreated: 0,
    offersExpired: 0
  };

  if (mongoose.connection.readyState !== 1) {
    return results;
  }

  try {
    // ── Phase 1: Expose & Process Expired Offers ──────────────────────────────
    const expiredOffers = await SlotOffer.find({
      status: 'PENDING',
      expiresAt: { $lte: now }
    });

    for (const offer of expiredOffers) {
      offer.status = 'EXPIRED';
      await offer.save();
      results.offersExpired++;

      // Mark waitlist entry expired or re-queue
      await Waitlist.findByIdAndUpdate(offer.waitlistId, { status: 'EXPIRED' });

      // Offer to next waiting farmer
      const nextOffer = await offerNextWaitlistCandidate(offer.centreId, offer.slotDate, offer.releasedTokenNumber, options);
      if (nextOffer) results.offersCreated++;
    }

    // ── Phase 2: Inspect Active BOOKED Tokens for Warning & Grace Expiry ─────
    const activeTokens = await Token.find({
      status: { $in: ['BOOKED', 'Booked'] },
      currentStageIndex: 0
    });

    for (const token of activeTokens) {
      // If gate check-in already completed, skip
      if (token.stages?.[0]?.status === 'Completed' || token.stages?.[0]?.status === 'completed') {
        continue;
      }

      const slotStart = parseSlotStartTime(token.slotDate, token.slotTime);
      const elapsedMs = now.getTime() - slotStart.getTime();

      // Case A: Grace Expiry (>= GRACE threshold) -> AUTO RELEASE
      if (elapsedMs >= timings.graceMs) {
        token.status = 'CANCELLED';
        token.cancellationReason = 'Auto-cancelled: missed arrival grace period';
        token.cancelledAt = now;
        await token.save();
        results.slotsReleased++;

        logger.info(`[SlotRelease] Auto-cancelled token ${token.tokenNumber} at mandi ${token.mandiId} (Elapsed: ${Math.round(elapsedMs / 1000)}s)`);

        // Send cancellation notification
        try {
          await notificationService.notify({
            recipientPhone: token.farmerPhone || token.phone,
            recipientName: token.farmerName,
            recipientRole: 'farmer',
            templateKey: 'SLOT_AUTO_RELEASED',
            centreId: token.mandiId,
            params: {
              tokenNumber: token.tokenNumber,
              mandiName: token.mandiName || 'APMC Mandi',
              slotTime: token.slotTime
            }
          });
        } catch (e) {
          logger.warn(`[SlotRelease] Notify cancellation failed: ${e.message}`);
        }

        // Offer released slot to next candidate on Waitlist
        const nextOffer = await offerNextWaitlistCandidate(token.mandiId, token.slotDate, token.tokenNumber, options);
        if (nextOffer) {
          results.offersCreated++;
        }
      }
      // Case B: Warning threshold (>= WARN and < GRACE) -> WARNING ALERT
      else if (elapsedMs >= timings.warnMs && !token.warnedAt) {
        token.warnedAt = now;
        await token.save();
        results.warningsIssued++;

        logger.info(`[SlotRelease] Issued arrival warning for token ${token.tokenNumber} (Elapsed: ${Math.round(elapsedMs / 1000)}s)`);

        try {
          await notificationService.notify({
            recipientPhone: token.farmerPhone || token.phone,
            recipientName: token.farmerName,
            recipientRole: 'farmer',
            templateKey: 'SLOT_ARRIVAL_WARNING',
            centreId: token.mandiId,
            params: {
              tokenNumber: token.tokenNumber,
              mandiName: token.mandiName || 'APMC Mandi',
              graceMinutesRemaining: Math.max(1, Math.round((timings.graceMs - elapsedMs) / 60000))
            }
          });
        } catch (e) {
          logger.warn(`[SlotRelease] Notify warning failed: ${e.message}`);
        }
      }
    }
  } catch (err) {
    logger.error(`[SlotRelease] Error in reallocation cycle: ${err.message}`);
  }

  return results;
}

/**
 * Offer a released slot to the next highest priority farmer in Waitlist
 */
async function offerNextWaitlistCandidate(centreId, slotDate, releasedTokenNumber = null, options = {}) {
  const timings = getTimingConfig(options);
  const now = options.simulatedNow ? new Date(options.simulatedNow) : new Date();

  // Find next waiting candidate
  const candidate = await Waitlist.findOne({
    centreId,
    status: 'WAITING'
  }).sort({ priority: -1, joinedAt: 1 });

  if (!candidate) {
    return null;
  }

  const expiresAt = new Date(Date.now() + timings.offerMs);

  const offer = await SlotOffer.create({
    waitlistId: candidate._id,
    releasedTokenNumber,
    farmerPhone: candidate.farmerPhone,
    farmerName: candidate.farmerName,
    centreId: candidate.centreId,
    mandiId: candidate.mandiId,
    mandiName: candidate.mandiName,
    crop: candidate.crop,
    quantity: candidate.quantity,
    slotDate: slotDate || candidate.requestedSlotDate,
    slotTime: candidate.requestedSlotTime || '08:00 AM - 11:00 AM',
    offeredAt: now,
    expiresAt,
    status: 'PENDING'
  });

  candidate.status = 'OFFERED';
  await candidate.save();

  logger.info(`[SlotRelease] Created slot offer ${offer._id} for farmer ${candidate.farmerPhone} (Expires in ${Math.round(timings.offerMs / 1000)}s)`);

  // Send offer notification to farmer
  try {
    await notificationService.notify({
      recipientPhone: candidate.farmerPhone,
      recipientName: candidate.farmerName,
      recipientRole: 'farmer',
      templateKey: 'SLOT_OFFER_AVAILABLE',
      centreId: candidate.centreId,
      params: {
        offerId: offer._id.toString(),
        mandiName: candidate.mandiName,
        crop: candidate.crop,
        quantity: candidate.quantity,
        slotDate: offer.slotDate,
        slotTime: offer.slotTime,
        offerMinutesValid: Math.round(timings.offerMs / 60000)
      }
    });
  } catch (e) {
    logger.warn(`[SlotRelease] Offer notification note: ${e.message}`);
  }

  return offer;
}

/**
 * Atomic Acceptance of a Slot Offer
 * Guarantees race-condition safety
 */
async function acceptSlotOffer(offerId, farmerPhone = null, options = {}) {
  const now = options.simulatedNow ? new Date(options.simulatedNow) : new Date();

  // Concurrency-safe atomic query & update
  const query = {
    _id: offerId,
    status: 'PENDING',
    expiresAt: { $gt: now }
  };

  if (farmerPhone) {
    query.farmerPhone = farmerPhone;
  }

  const updatedOffer = await SlotOffer.findOneAndUpdate(
    query,
    {
      $set: {
        status: 'ACCEPTED',
        acceptedAt: now
      }
    },
    { new: true }
  );

  if (!updatedOffer) {
    return {
      success: false,
      message: 'Slot offer is no longer valid, expired, or already claimed.'
    };
  }

  // Update Waitlist status
  await Waitlist.findByIdAndUpdate(updatedOffer.waitlistId, { status: 'ACCEPTED' });

  // Generate confirmed Token
  const mandiCode = updatedOffer.centreId.split('-')[0] || 'KPG';
  const randNum = String(Math.floor(1000 + Math.random() * 8999));
  const tokenNumber = `KQ-${mandiCode}-${new Date().getFullYear()}-${randNum}`;

  const defaultStages = [
    { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in & QR Scan', status: 'Pending', timestamp: null },
    { stageIndex: 1, id: 'QUALITY_GRADING', title: 'Quality Grading & Assaying', status: 'Pending', timestamp: null },
    { stageIndex: 2, id: 'WEIGHBRIDGE', title: 'Digital Weighbridge', status: 'Pending', timestamp: null },
    { stageIndex: 3, id: 'PROCUREMENT', title: 'Procurement & Agreement', status: 'Pending', timestamp: null },
    { stageIndex: 4, id: 'PAYOUT', title: 'Final DBT Payout', status: 'Pending', timestamp: null }
  ];

  const tokenPayload = {
    tokenNumber,
    id: tokenNumber,
    farmerName: updatedOffer.farmerName,
    farmerPhone: updatedOffer.farmerPhone,
    phone: updatedOffer.farmerPhone,
    mandiId: updatedOffer.centreId,
    mandiName: updatedOffer.mandiName,
    mandiCode,
    crop: updatedOffer.crop,
    quantity: updatedOffer.quantity,
    quantityBand: updatedOffer.quantity <= 5 ? '0-5q' : updatedOffer.quantity <= 15 ? '5-15q' : '15q+',
    slotDate: updatedOffer.slotDate,
    slotTime: updatedOffer.slotTime,
    slotLabel: updatedOffer.slotTime,
    status: 'BOOKED',
    queuePosition: 1,
    stages: defaultStages
  };

  const createdToken = await Token.create(tokenPayload);

  updatedOffer.createdTokenNumber = tokenNumber;
  await updatedOffer.save();

  logger.info(`[SlotRelease] Farmer ${updatedOffer.farmerPhone} accepted offer ${offerId} -> Token ${tokenNumber}`);

  // Send confirmation notification
  try {
    await notificationService.notify({
      recipientPhone: updatedOffer.farmerPhone,
      recipientName: updatedOffer.farmerName,
      recipientRole: 'farmer',
      templateKey: 'SLOT_OFFER_CONFIRMED',
      centreId: updatedOffer.centreId,
      params: {
        tokenNumber,
        mandiName: updatedOffer.mandiName,
        slotDate: updatedOffer.slotDate,
        slotTime: updatedOffer.slotTime
      }
    });
  } catch (e) {
    logger.warn(`[SlotRelease] Confirm notification note: ${e.message}`);
  }

  return {
    success: true,
    message: 'Slot offer accepted successfully. Token confirmed.',
    token: createdToken.toObject(),
    offer: updatedOffer.toObject()
  };
}

/**
 * Decline a Slot Offer
 */
async function declineSlotOffer(offerId, farmerPhone = null, options = {}) {
  const query = { _id: offerId, status: 'PENDING' };
  if (farmerPhone) query.farmerPhone = farmerPhone;

  const offer = await SlotOffer.findOneAndUpdate(
    query,
    { $set: { status: 'DECLINED' } },
    { new: true }
  );

  if (!offer) {
    return { success: false, message: 'Offer not found or not in pending state.' };
  }

  await Waitlist.findByIdAndUpdate(offer.waitlistId, { status: 'CANCELLED' });

  // Immediately offer to next candidate
  const nextOffer = await offerNextWaitlistCandidate(offer.centreId, offer.slotDate, offer.releasedTokenNumber, options);

  return {
    success: true,
    message: 'Slot offer declined.',
    nextOfferCreated: !!nextOffer
  };
}

/**
 * Add farmer to Waitlist
 */
async function joinWaitlist({ farmerId, farmerName, farmerPhone, centreId, mandiId, mandiName, crop, quantity, requestedSlotDate, requestedSlotTime, priority }) {
  const entry = await Waitlist.create({
    farmerId: farmerId || null,
    farmerName: farmerName || 'Farmer',
    farmerPhone,
    centreId: centreId || mandiId || 'KPG-01',
    mandiId: mandiId || centreId || 'KPG-01',
    mandiName: mandiName || 'APMC Kopargaon',
    crop: crop || 'Soybean',
    quantity: Number(quantity) || 25,
    requestedSlotDate: requestedSlotDate || new Date().toISOString().split('T')[0],
    requestedSlotTime: requestedSlotTime || '08:00 AM - 11:00 AM',
    priority: Number(priority) || 0,
    status: 'WAITING',
    joinedAt: new Date()
  });

  return entry;
}

// ── Background 60s Reallocation Job ────────────────────────────────────────────
let intervalHandle = null;

function startReallocationJob(intervalMs = 60000) {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      await processSlotReallocationCycle();
    } catch (e) {
      logger.warn(`[SlotRelease Job] Background iteration error: ${e.message}`);
    }
  }, intervalMs);
  logger.info(`[SlotRelease Job] Started background slot reallocation worker (${intervalMs / 1000}s interval)`);
}

function stopReallocationJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  getTimingConfig,
  parseSlotStartTime,
  processSlotReallocationCycle,
  offerNextWaitlistCandidate,
  acceptSlotOffer,
  declineSlotOffer,
  joinWaitlist,
  startReallocationJob,
  stopReallocationJob
};
