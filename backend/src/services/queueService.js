const mongoose = require('mongoose');
const { Booking, QueueState, AuditLog } = require('../models');
const { broadcastQueueUpdate } = require('../socket/queue.socket');
const logger = require('../utils/logger');

// Shared in-memory fallback stores
const { _inMemoryBookings: inMemoryBookings } = require('./bookingService');
const inMemoryQueueStates = new Map();
const inMemoryAuditLogs = [];

/**
 * Helper: find a booking from DB or in-memory fallback
 */
const findBookingById = async (bookingId) => {
  let booking = null;
  try {
    if (mongoose.connection.readyState === 1) {
      booking = await Booking.findById(bookingId);
    }
  } catch (err) {
    // fallback below
  }
  if (!booking && inMemoryBookings) {
    booking = inMemoryBookings.get(bookingId.toString());
  }
  return booking;
};

/**
 * Helper: update a booking status in DB or in-memory
 */
const updateBookingStatus = async (bookingId, newStatus) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return await Booking.findByIdAndUpdate(bookingId, { status: newStatus }, { new: true });
    }
  } catch (err) {
    // fallback below
  }
  if (inMemoryBookings && inMemoryBookings.has(bookingId.toString())) {
    const b = inMemoryBookings.get(bookingId.toString());
    b.status = newStatus;
    b.updatedAt = new Date();
    inMemoryBookings.set(bookingId.toString(), b);
    return b;
  }
  return null;
};

const queueService = {
  /**
   * Get today's date as YYYY-MM-DD string
   */
  getTodayDateStr: () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  },

  /**
   * Get or create the QueueState document for a given centre and date
   */
  getOrCreateQueueState: async (centreId, date) => {
    const dateStr = date || queueService.getTodayDateStr();

    try {
      if (mongoose.connection.readyState === 1) {
        let qs = await QueueState.findOne({ centreId, date: dateStr });
        if (!qs) {
          qs = await QueueState.create({
            centreId,
            date: dateStr,
            activeBookings: [],
            currentPositionMap: new Map(),
            lastUpdated: new Date()
          });
        }
        return qs;
      }
    } catch (err) {
      logger.warn(`QueueState DB fallback: ${err.message}`);
    }

    // In-memory fallback
    const key = `${centreId}_${dateStr}`;
    if (!inMemoryQueueStates.has(key)) {
      inMemoryQueueStates.set(key, {
        _id: new mongoose.Types.ObjectId(),
        centreId,
        date: dateStr,
        activeBookings: [],
        currentPositionMap: new Map(),
        lastUpdated: new Date()
      });
    }
    return inMemoryQueueStates.get(key);
  },

  /**
   * Recompute position map for all active bookings in a centre's queue.
   * Returns a Map of bookingId -> position range string like "4-7 ahead"
   */
  computePositionMap: async (centreId, date) => {
    const dateStr = date || queueService.getTodayDateStr();
    let activeBookings = [];

    try {
      if (mongoose.connection.readyState === 1) {
        activeBookings = await Booking.find({
          centreId,
          status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
          arrivalWindowStart: {
            $gte: new Date(`${dateStr}T00:00:00.000Z`),
            $lte: new Date(`${dateStr}T23:59:59.999Z`)
          }
        }).sort({ arrivalWindowStart: 1, createdAt: 1 });
      }
    } catch (err) {
      logger.warn(`Position computation fallback: ${err.message}`);
    }

    const positionMap = new Map();
    const checkedInIds = [];
    const waitingIds = [];

    activeBookings.forEach((b) => {
      if (b.status === 'CHECKED_IN') {
        checkedInIds.push(b._id.toString());
      } else {
        waitingIds.push(b._id.toString());
      }
    });

    // Checked-in bookings get priority queue position
    checkedInIds.forEach((id, idx) => {
      positionMap.set(id, `Position ${idx + 1} (Checked In)`);
    });

    // Waiting bookings are ordered after checked-in ones
    waitingIds.forEach((id, idx) => {
      const ahead = checkedInIds.length + idx;
      if (ahead === 0) {
        positionMap.set(id, 'You are next');
      } else {
        const rangeLow = Math.max(1, ahead - 1);
        const rangeHigh = ahead + 1;
        positionMap.set(id, `${rangeLow}-${rangeHigh} ahead`);
      }
    });

    return { positionMap, activeBookingIds: [...checkedInIds, ...waitingIds], totalActive: activeBookings.length };
  },

  /**
   * Rebuild and persist the QueueState, then broadcast via Socket.IO
   */
  refreshAndBroadcast: async (io, centreId, date) => {
    const dateStr = date || queueService.getTodayDateStr();
    const { positionMap, activeBookingIds, totalActive } = await queueService.computePositionMap(centreId, dateStr);

    const queueState = await queueService.getOrCreateQueueState(centreId, dateStr);

    // Update QueueState
    try {
      if (mongoose.connection.readyState === 1) {
        await QueueState.findOneAndUpdate(
          { centreId, date: dateStr },
          {
            activeBookings: activeBookingIds.map((id) => new mongoose.Types.ObjectId(id)),
            currentPositionMap: positionMap,
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        );
      } else {
        const key = `${centreId}_${dateStr}`;
        inMemoryQueueStates.set(key, {
          ...queueState,
          activeBookings: activeBookingIds,
          currentPositionMap: positionMap,
          lastUpdated: new Date()
        });
      }
    } catch (err) {
      logger.warn(`QueueState persistence fallback: ${err.message}`);
    }

    // Broadcast to Socket.IO room
    const broadcastPayload = {
      date: dateStr,
      totalActive,
      positions: Object.fromEntries(positionMap)
    };

    broadcastQueueUpdate(io, centreId, broadcastPayload);

    return broadcastPayload;
  },

  /**
   * Check-in: Mark a booking as CHECKED_IN (farmer has physically arrived)
   */
  checkIn: async (bookingId, { actorId, actorRole }, io) => {
    let booking = await findBookingById(bookingId);

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'CHECKED_IN') {
      throw new Error('Booking is already checked in');
    }

    if (!['BOOKED', 'CONFIRMED'].includes(booking.status)) {
      throw new Error(`Cannot check in booking with status '${booking.status}'. Must be BOOKED or CONFIRMED.`);
    }

    // Update status
    booking = await updateBookingStatus(bookingId, 'CHECKED_IN') || booking;
    booking.status = 'CHECKED_IN';

    // Audit Log
    const auditPayload = {
      actorId,
      actorRole,
      action: 'CHECK_IN',
      targetId: bookingId,
      reason: 'Farmer arrived and checked in at the centre',
      timestamp: new Date()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create(auditPayload);
      } else {
        inMemoryAuditLogs.push(auditPayload);
      }
    } catch (err) {
      inMemoryAuditLogs.push(auditPayload);
    }

    // Refresh queue and broadcast
    const centreId = booking.centreId?.toString() || booking.centreId;
    await queueService.refreshAndBroadcast(io, centreId);

    return booking;
  },

  /**
   * Release: Staff-confirmed vacancy release for an ELIGIBLE_FOR_RELEASE booking.
   * Transitions booking to RELEASED, logs in AuditLog, broadcasts update.
   */
  releaseSlot: async (bookingId, { actorId, actorRole, reason }, io) => {
    let booking = await findBookingById(bookingId);

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Only ELIGIBLE_FOR_RELEASE or CHECKED_IN can be released (staff override pathway)
    if (!['ELIGIBLE_FOR_RELEASE', 'CHECKED_IN'].includes(booking.status)) {
      throw new Error(
        `Cannot release booking with status '${booking.status}'. Must be ELIGIBLE_FOR_RELEASE or CHECKED_IN.`
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('A clear reason is mandatory for slot release actions');
    }

    // Update status
    booking = await updateBookingStatus(bookingId, 'RELEASED') || booking;
    booking.status = 'RELEASED';

    // Audit Log (reason mandatory for releases)
    const auditPayload = {
      actorId,
      actorRole,
      action: 'SLOT_RELEASED',
      targetId: bookingId,
      reason,
      timestamp: new Date()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create(auditPayload);
      } else {
        inMemoryAuditLogs.push(auditPayload);
      }
    } catch (err) {
      inMemoryAuditLogs.push(auditPayload);
    }

    // Refresh queue and broadcast
    const centreId = booking.centreId?.toString() || booking.centreId;
    await queueService.refreshAndBroadcast(io, centreId);

    return booking;
  },

  /**
   * Mark a booking as ELIGIBLE_FOR_RELEASE (grace period expired, ready for staff action)
   */
  markEligibleForRelease: async (bookingId, io) => {
    let booking = await findBookingById(bookingId);

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Status guards: reject checked-in or any post-arrival state
    if (['CHECKED_IN', 'INSPECTED', 'WEIGHED_READY_FOR_AUCTION', 'PROCUREMENT_APPROVED', 'COMPLETED'].includes(booking.status)) {
      throw new Error('Cannot release a booking that has already checked in');
    }

    // Must be CONFIRMED
    if (booking.status !== 'CONFIRMED') {
      throw new Error(`Cannot mark booking with status '${booking.status}' as eligible for release`);
    }

    // Grace period guard: gracePeriodEnd must have passed if defined
    if (booking.gracePeriodEnd && new Date(booking.gracePeriodEnd) > new Date()) {
      throw new Error('Cannot mark booking as eligible for release: grace period has not expired yet');
    }

    // Update status
    booking = await updateBookingStatus(bookingId, 'ELIGIBLE_FOR_RELEASE') || booking;
    booking.status = 'ELIGIBLE_FOR_RELEASE';

    const centreId = booking.centreId?.toString() || booking.centreId;
    await queueService.refreshAndBroadcast(io, centreId);

    return booking;
  },

  /**
   * Get current position for a specific booking (HTTP fallback for offline recovery)
   */
  getBookingPosition: async (centreId, bookingId, date) => {
    const dateStr = date || queueService.getTodayDateStr();
    const { positionMap, totalActive } = await queueService.computePositionMap(centreId, dateStr);

    const position = positionMap.get(bookingId.toString());

    return {
      bookingId,
      centreId,
      date: dateStr,
      position: position || 'Not in active queue',
      isInQueue: !!position,
      totalActive
    };
  },

  /**
   * Get the full live queue for a centre (REST endpoint)
   */
  getLiveQueue: async (centreId, date) => {
    const dateStr = date || queueService.getTodayDateStr();
    const { positionMap, activeBookingIds, totalActive } = await queueService.computePositionMap(centreId, dateStr);

    return {
      centreId,
      date: dateStr,
      totalActive,
      positions: Object.fromEntries(positionMap),
      activeBookingIds
    };
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
      : [...inMemoryAuditLogs];
  }
};

module.exports = queueService;
