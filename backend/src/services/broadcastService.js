'use strict';

const mongoose = require('mongoose');
const { Booking, Broadcast } = require('../models');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Send a broadcast message to all farmers with active bookings at a centre.
 * Supports trilingual content (en/hi/mr).
 */
async function sendBroadcast({ centreId, text, sentBy, io }) {
  if (!centreId || !text?.en) {
    throw new Error('centreId and text.en required');
  }

  // Find all farmers with active bookings at this centre
  let recipientFarmerIds = [];
  if (mongoose.connection.readyState === 1) {
    // Resolve centre code → ObjectId
    const { Centre } = require('../models');
    const centreDoc = await Centre.findOne({ code: centreId.toUpperCase() }).select('_id').lean();
    if (centreDoc) {
      const activeBookings = await Booking.find({
        centreId: centreDoc._id,
        status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] }
      }).select('farmerId').lean();
      recipientFarmerIds = [...new Set(activeBookings.map(b => b.farmerId?.toString()))].filter(Boolean);
    }
  }

  // Save broadcast record
  const broadcast = await Broadcast.create({
    centreId: centreId.toUpperCase(),
    text: {
      en: text.en,
      hi: text.hi || '',
      mr: text.mr || ''
    },
    sentBy,
    sentAt: new Date(),
    recipientCount: recipientFarmerIds.length
  });

  // Notify each farmer
  let notified = 0;
  for (const farmerId of recipientFarmerIds) {
    try {
      await notificationService.notify(
        { id: farmerId, type: 'farmer' },
        'broadcast',
        { broadcastId: broadcast._id.toString(), centreId, message: text.en },
        { io }
      );
      notified++;
    } catch (err) {
      logger.warn(`[Broadcast] Failed to notify farmer ${farmerId}: ${err.message}`);
    }
  }

  // Update actual count
  if (notified !== recipientFarmerIds.length) {
    broadcast.recipientCount = notified;
    await broadcast.save();
  }

  logger.info(`[Broadcast] Sent to ${notified} farmers at ${centreId}`);
  return { broadcast, notified };
}

module.exports = { sendBroadcast };
