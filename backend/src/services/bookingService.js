const mongoose = require('mongoose');
const { Booking, Centre, Farmer, AuditLog } = require('../models');
const logger = require('../utils/logger');

// In-memory store fallback for bookings and audit logs during testing/offline mode
const inMemoryBookings = new Map();
const inMemoryAuditLogs = [];

// Seed default weighmaster / guard desk demo bookings
inMemoryBookings.set('65f1a2b3c4d5e6f7a8b9c0d1', {
  _id: '65f1a2b3c4d5e6f7a8b9c0d1',
  tokenNumber: 'KQ-108',
  farmerId: '65f1a2b3c4d5e6f7a8b9c001',
  centreId: '65f1a2b3c4d5e6f7a8b9c002',
  farmerName: 'रामचंद्र पाटील',
  crop: 'Red Onion',
  quantityBand: '15q+',
  status: 'CHECKED_IN',
  createdAt: new Date(),
  updatedAt: new Date()
});

inMemoryBookings.set('65f1a2b3c4d5e6f7a8b9c0d2', {
  _id: '65f1a2b3c4d5e6f7a8b9c0d2',
  tokenNumber: 'KQ-107',
  farmerId: '65f1a2b3c4d5e6f7a8b9c003',
  centreId: '65f1a2b3c4d5e6f7a8b9c002',
  farmerName: 'सुरेश जाधव',
  crop: 'Yellow Maize',
  quantityBand: '15q+',
  status: 'CHECKED_IN',
  createdAt: new Date(),
  updatedAt: new Date()
});

const bookingService = {
  /**
   * Reserve an arrival window slot with deduplication and capacity checks
   */
  createBooking: async ({
    farmerId,
    centreId,
    crop,
    quantityBand,
    arrivalWindowStart,
    arrivalWindowEnd,
    channel = 'app',
    actorId,
    actorRole = 'farmer'
  }) => {
    if (!farmerId || !centreId || !crop || !quantityBand || !arrivalWindowStart || !arrivalWindowEnd) {
      throw new Error('Missing required booking parameters (farmerId, centreId, crop, quantityBand, arrivalWindowStart, arrivalWindowEnd)');
    }

    const windowStart = new Date(arrivalWindowStart);
    const windowEnd = new Date(arrivalWindowEnd);

    if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
      throw new Error('Invalid arrival window start or end timestamp');
    }

    if (windowEnd <= windowStart) {
      throw new Error('Arrival window end time must be strictly after start time');
    }

    // Reject past arrival windows or slots with less than 15 minutes remaining
    if (windowEnd.getTime() <= (Date.now() + 15 * 60 * 1000)) {
      throw new Error('The requested arrival window has already expired or has less than 15 minutes remaining.');
    }

    // 1. Deduplication Check: Prevent the same farmer from booking duplicate slots in the same window
    let duplicateBooking = null;
    try {
      if (mongoose.connection.readyState === 1) {
        duplicateBooking = await Booking.findOne({
          farmerId,
          centreId,
          status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
          arrivalWindowStart: { $lt: windowEnd },
          arrivalWindowEnd: { $gt: windowStart }
        });
      } else {
        duplicateBooking = Array.from(inMemoryBookings.values()).find(
          (b) =>
            b.farmerId.toString() === farmerId.toString() &&
            b.centreId.toString() === centreId.toString() &&
            ['BOOKED', 'CONFIRMED', 'CHECKED_IN'].includes(b.status) &&
            new Date(b.arrivalWindowStart) < windowEnd &&
            new Date(b.arrivalWindowEnd) > windowStart
        );
      }
    } catch (e) {
      logger.warn(`Deduplication query warning: ${e.message}`);
    }

    if (duplicateBooking) {
      throw new Error('Duplicate booking detected: You already have an active reservation in this arrival window');
    }

    // 2. Capacity Check: Ensure selected window has remaining capacity
    let activeInWindowCount = 0;
    try {
      if (mongoose.connection.readyState === 1) {
        activeInWindowCount = await Booking.countDocuments({
          centreId,
          status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
          arrivalWindowStart: { $lt: windowEnd },
          arrivalWindowEnd: { $gt: windowStart }
        });
      } else {
        activeInWindowCount = Array.from(inMemoryBookings.values()).filter(
          (b) =>
            b.centreId.toString() === centreId.toString() &&
            ['BOOKED', 'CONFIRMED', 'CHECKED_IN'].includes(b.status) &&
            new Date(b.arrivalWindowStart) < windowEnd &&
            new Date(b.arrivalWindowEnd) > windowStart
        ).length;
      }
    } catch (e) {
      activeInWindowCount = 0;
    }

    // Window capacity limit per arrival block (default 5 for testing/standard lane limit)
    const windowMaxCapacity = 5;
    if (activeInWindowCount >= windowMaxCapacity) {
      throw new Error('Arrival window capacity reached. Please select an alternative time slot.');
    }

    // 3. Generate unique Token Number & QR Code payload
    const tokenNumber = `KQ-${Math.floor(100000 + Math.random() * 900000)}`;
    const qrCodePayload = JSON.stringify({
      tokenNumber,
      centreId,
      farmerId,
      crop,
      quantityBand,
      windowStart: windowStart.toISOString()
    });

    // Grace period ends 15 minutes after arrival window closes
    const gracePeriodEnd = new Date(windowEnd.getTime() + 15 * 60 * 1000);

    const bookingData = {
      _id: new mongoose.Types.ObjectId(),
      farmerId,
      centreId,
      crop,
      quantityBand,
      arrivalWindowStart: windowStart,
      arrivalWindowEnd: windowEnd,
      tokenNumber,
      qrCode: qrCodePayload,
      status: 'BOOKED',
      channel,
      gracePeriodEnd
    };

    let booking = null;
    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.create(bookingData);
      }
    } catch (err) {
      logger.warn(`Database write bypassed for booking: ${err.message}`);
    }

    if (!booking) {
      booking = { ...bookingData, createdAt: new Date(), updatedAt: new Date() };
      inMemoryBookings.set(booking._id.toString(), booking);
    }

    // 4. Audit Log entry for BOOKING_CREATED
    try {
      const auditPayload = {
        actorId: actorId || farmerId,
        actorRole: actorRole || 'farmer',
        action: 'BOOKING_CREATED',
        targetId: booking._id,
        reason: 'Farmer slot reserved for procurement intake',
        timestamp: new Date()
      };

      if (mongoose.connection.readyState === 1) {
        await AuditLog.create(auditPayload);
      } else {
        inMemoryAuditLogs.push(auditPayload);
      }
    } catch (err) {
      logger.warn(`AuditLog creation notice: ${err.message}`);
    }

    return booking;
  },

  /**
   * Get single booking details
   */
  getBookingById: async (id) => {
    let booking = null;
    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findById(id).populate('farmerId', 'name phone preferredLanguage').populate('centreId', 'name location workingHours');
      } else if (inMemoryBookings.has(id.toString())) {
        booking = inMemoryBookings.get(id.toString());
      }
    } catch (err) {
      if (inMemoryBookings.has(id.toString())) {
        booking = inMemoryBookings.get(id.toString());
      }
    }

    if (!booking) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    return booking;
  },

  /**
   * Cancel booking & record SLOT_RELEASED in AuditLog
   */
  cancelBooking: async (id, { actorId, actorRole = 'farmer', reason = 'Farmer requested slot cancellation' }) => {
    let booking = await bookingService.getBookingById(id);

    if (booking.status === 'CANCELLED') {
      throw new Error('Booking is already cancelled');
    }
    if (booking.status === 'COMPLETED') {
      throw new Error('Completed bookings cannot be cancelled');
    }

    booking.status = 'CANCELLED';

    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findByIdAndUpdate(
          id,
          { status: 'CANCELLED' },
          { new: true }
        );
      } else {
        inMemoryBookings.set(id.toString(), { ...booking, status: 'CANCELLED', updatedAt: new Date() });
      }
    } catch (err) {
      logger.warn(`Database update fallback: ${err.message}`);
      inMemoryBookings.set(id.toString(), { ...booking, status: 'CANCELLED', updatedAt: new Date() });
    }

    // Audit Log for SLOT_RELEASED
    const auditPayload = {
      actorId: actorId || booking.farmerId,
      actorRole: actorRole || 'farmer',
      action: 'SLOT_RELEASED',
      targetId: booking._id || id,
      reason: reason || 'Farmer requested cancellation',
      timestamp: new Date()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create(auditPayload);
      } else {
        inMemoryAuditLogs.push(auditPayload);
      }
    } catch (err) {
      logger.warn(`AuditLog cancellation notice: ${err.message}`);
    }

    return booking;
  },

  /**
   * Get all bookings for authenticated farmer
   */
  getFarmerBookings: async (farmerId) => {
    let bookings = [];
    try {
      if (mongoose.connection.readyState === 1) {
        bookings = await Booking.find({ farmerId })
          .populate('centreId', 'name location workingHours')
          .sort({ arrivalWindowStart: -1 });
      } else {
        bookings = Array.from(inMemoryBookings.values()).filter(
          (b) => b.farmerId.toString() === farmerId.toString()
        );
      }
    } catch (err) {
      bookings = Array.from(inMemoryBookings.values()).filter(
        (b) => b.farmerId.toString() === farmerId.toString()
      );
    }

    return bookings;
  },

  /**
   * Helper to inspect audit logs for verification
   */
  getAuditLogs: async (targetId) => {
    try {
      if (mongoose.connection.readyState === 1) {
        return await AuditLog.find(targetId ? { targetId } : {}).sort({ timestamp: -1 });
      }
    } catch (e) {
      // fallback
    }
    return targetId
      ? inMemoryAuditLogs.filter((l) => l.targetId?.toString() === targetId.toString())
      : inMemoryAuditLogs;
  }
};

module.exports = bookingService;
module.exports._inMemoryBookings = inMemoryBookings;
