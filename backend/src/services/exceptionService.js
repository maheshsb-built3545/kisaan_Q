const mongoose = require('mongoose');
const { Exception, Booking, AuditLog } = require('../models');
const logger = require('../utils/logger');

// In-memory fallback stores
const inMemoryExceptions = new Map();
const inMemoryAuditLogs = [];

// Shared booking lookup
const { _inMemoryBookings: inMemoryBookings } = require('./bookingService');

const findBooking = async (bookingId) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return await Booking.findById(bookingId);
    }
  } catch (e) { /* fallback */ }
  return inMemoryBookings?.get(bookingId.toString()) || null;
};

const updateBookingStatus = async (bookingId, status) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });
    }
  } catch (e) { /* fallback */ }
  if (inMemoryBookings?.has(bookingId.toString())) {
    const b = inMemoryBookings.get(bookingId.toString());
    b.status = status;
    b.updatedAt = new Date();
    return b;
  }
  return null;
};

const writeAuditLog = async (payload) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await AuditLog.create(payload);
      return;
    }
  } catch (e) { /* fallback */ }
  inMemoryAuditLogs.push(payload);
};

const exceptionService = {
  /**
   * Raise an exception on a booking (staff action)
   */
  raiseException: async ({ bookingId, type, reasonCode, raisedBy, actorRole }) => {
    if (!bookingId || !type || !reasonCode || !raisedBy) {
      throw new Error('bookingId, type, reasonCode, and raisedBy are all required');
    }

    const validTypes = ['quality_dispute', 'partial_accept', 'rejected', 'document_mismatch'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid exception type '${type}'. Must be one of: ${validTypes.join(', ')}`);
    }

    const booking = await findBooking(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const exceptionData = {
      _id: new mongoose.Types.ObjectId(),
      bookingId,
      type,
      reasonCode,
      raisedBy,
      supervisorOverride: false,
      overrideReason: null,
      outcome: null
    };

    let exception = null;
    try {
      if (mongoose.connection.readyState === 1) {
        exception = await Exception.create(exceptionData);
      }
    } catch (err) {
      logger.warn(`Exception DB fallback: ${err.message}`);
    }

    if (!exception) {
      exception = { ...exceptionData, createdAt: new Date(), updatedAt: new Date() };
      inMemoryExceptions.set(exception._id.toString(), exception);
    }

    // Route booking to exception lane
    await updateBookingStatus(bookingId, 'CHECKED_IN');

    // Audit trail
    await writeAuditLog({
      actorId: raisedBy,
      actorRole: actorRole || 'staff',
      action: 'EXCEPTION_RAISED',
      targetId: exception._id,
      reason: `[${type}] ${reasonCode}`,
      timestamp: new Date()
    });

    return exception;
  },

  /**
   * Supervisor override for an existing exception
   */
  supervisorOverride: async (exceptionId, { overrideReason, outcome, actorId }) => {
    if (!overrideReason || overrideReason.trim().length === 0) {
      throw new Error('overrideReason is mandatory for supervisor overrides');
    }

    let exception = null;
    try {
      if (mongoose.connection.readyState === 1) {
        exception = await Exception.findById(exceptionId);
      }
    } catch (e) { /* fallback */ }
    if (!exception && inMemoryExceptions.has(exceptionId.toString())) {
      exception = inMemoryExceptions.get(exceptionId.toString());
    }

    if (!exception) {
      throw new Error(`Exception ${exceptionId} not found`);
    }

    if (exception.supervisorOverride) {
      throw new Error('This exception has already been overridden by a supervisor');
    }

    // Apply override
    const updates = {
      supervisorOverride: true,
      overrideReason,
      outcome: outcome || 'Supervisor override applied'
    };

    try {
      if (mongoose.connection.readyState === 1) {
        exception = await Exception.findByIdAndUpdate(exceptionId, updates, { new: true });
      }
    } catch (e) { /* fallback */ }

    if (!exception || !exception.supervisorOverride) {
      Object.assign(exception, updates, { updatedAt: new Date() });
      inMemoryExceptions.set(exceptionId.toString(), exception);
    }

    // Audit trail (mandatory reason for overrides)
    await writeAuditLog({
      actorId,
      actorRole: 'supervisor',
      action: 'OVERRIDE_APPLIED',
      targetId: exceptionId,
      reason: overrideReason,
      timestamp: new Date()
    });

    return exception;
  },

  /**
   * Get exception details by ID
   */
  getExceptionById: async (id) => {
    let exception = null;
    try {
      if (mongoose.connection.readyState === 1) {
        exception = await Exception.findById(id)
          .populate('bookingId', 'tokenNumber status crop')
          .populate('raisedBy', 'name role');
      }
    } catch (e) { /* fallback */ }
    if (!exception && inMemoryExceptions.has(id.toString())) {
      exception = inMemoryExceptions.get(id.toString());
    }
    if (!exception) {
      throw new Error(`Exception ${id} not found`);
    }
    return exception;
  },

  /**
   * Get all exceptions for a booking
   */
  getExceptionsByBooking: async (bookingId) => {
    try {
      if (mongoose.connection.readyState === 1) {
        return await Exception.find({ bookingId }).sort({ createdAt: -1 });
      }
    } catch (e) { /* fallback */ }
    return Array.from(inMemoryExceptions.values()).filter(
      (ex) => ex.bookingId?.toString() === bookingId.toString()
    );
  },

  /**
   * List all exceptions with optional status filter.
   *
   * SCHEMA GAP NOTE — approach taken: map virtual status strings to supervisorOverride boolean.
   *   ?status=pending_review → supervisorOverride: false  (not yet acted on)
   *   ?status=resolved       → supervisorOverride: true   (override applied)
   *   (no ?status)           → return all exceptions
   *
   * Decision: DO NOT add a real 'status' field to the Exception schema.
   * supervisorOverride is the single source of truth. Adding a parallel status
   * field would create a sync bug every time supervisorOverride is toggled.
   */
  getAllExceptions: async (filters = {}) => {
    const query = {};
    if (filters.status === 'pending_review') {
      query.supervisorOverride = false;
    } else if (filters.status === 'resolved') {
      query.supervisorOverride = true;
    }
    // Any other or missing status → no filter applied (return all)

    try {
      if (mongoose.connection.readyState === 1) {
        return await Exception.find(query)
          .populate('bookingId', 'tokenNumber status crop centreId')
          .populate('raisedBy', 'name role')
          .sort({ createdAt: -1 })
          .lean();
      }
    } catch (e) { /* fallback */ }

    // In-memory fallback: filter on the boolean directly
    let all = Array.from(inMemoryExceptions.values());
    if (filters.status === 'pending_review') {
      all = all.filter((ex) => !ex.supervisorOverride);
    } else if (filters.status === 'resolved') {
      all = all.filter((ex) => ex.supervisorOverride);
    }
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /** Helper for tests */
  _getAuditLogs: () => [...inMemoryAuditLogs]
};

module.exports = exceptionService;
