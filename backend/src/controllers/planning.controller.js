'use strict';

const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  Centre, StaffUser, Booking, Resource, Availability, CentreEvent, SlotCap, ForecastSnapshot, PlanRequest, AuditLog
} = require('../models');
const {
  computeDayForecast, computeWeekForecast, computeWhatIf
} = require('../services/forecastService');
const notificationService = require('../services/notificationService');
const { getDeadlineSeconds } = require('../config/forecast');
const { getHeatStatus } = require('../config/forecast');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Helper: get centreId from authenticated officer (falls back to 'KPG-01' for demo)
function getOfficerCentre(req) {
  return (
    req.scopedCentreId ||
    req.user?.assignedMandi ||
    req.user?.centreId ||
    'KPG-01'
  ).toUpperCase();
}

const planningController = {
  /**
   * GET /api/planning/me — Officer profile + centre config
   */
  getPlanningMe: async (req, res) => {
    try {
      const user = req.user;
      const assignedCentreCode = user.assignedMandi || user.assignedMandiId || 'KPG-01';

      let centreDoc = null;
      try {
        centreDoc = await Centre.findOne({
          $or: [{ code: assignedCentreCode }, { id: assignedCentreCode }, { _id: user.centreId }]
        }).lean();
      } catch (e) {
        logger.debug(`[Planning] Centre lookup notice: ${e.message}`);
      }

      const centreData = {
        code: assignedCentreCode,
        name: centreDoc?.name || user.assignedMandiName || `APMC Mandi (${assignedCentreCode})`,
        district: centreDoc?.district || 'Nashik',
        state: centreDoc?.state || 'Maharashtra',
        weighbridges: centreDoc?.weighbridges || 2,
        assayingBays: centreDoc?.assayingBays || 3,
        gateLanes: centreDoc?.gateLanes || 2,
        dailySlotCap: centreDoc?.dailySlotCap || 120,
        operatingHours: centreDoc?.operatingHours || '08:00 - 18:00',
        activeCrops: centreDoc?.activeCrops || ['Soybean', 'Cotton', 'Wheat', 'Onion', 'Maize', 'Chana']
      };

      return successResponse(res, {
        user: {
          id: user.id || user._id, name: user.name, phone: user.phone, role: user.role,
          officerCode: user.officerCode, deskName: user.deskName, terminalCode: user.terminalCode,
          assignedMandi: user.assignedMandi, assignedMandiName: user.assignedMandiName
        },
        centre: centreData
      }, 'Planning officer profile retrieved');
    } catch (err) {
      logger.error(`[Planning] getPlanningMe error: ${err.message}`);
      return errorResponse(res, 'Failed to fetch planning officer profile', 500, err.message);
    }
  },

  /**
   * GET /api/planning/forecast?centreId=&days=7
   * Returns 7-day rule-based forecast heat strip.
   * district_admin: pass centreId in query; officer: scoped to own centre.
   */
  getForecast: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      const forecast = await computeWeekForecast(centreId);
      return successResponse(res, {
        centreId,
        forecast,
        label: 'rule-based forecast',
        note: 'All projections are rule-based estimates, not AI predictions.'
      }, '7-day forecast retrieved');
    } catch (err) {
      logger.error(`[Planning] getForecast error: ${err.message}`);
      return errorResponse(res, 'Failed to compute forecast', 500, err.message);
    }
  },

  /**
   * POST /api/planning/what-if
   * Body: { centreId, date, confirmedBookings: [...], showUpRateOverride, extraLabour }
   */
  postWhatIf: async (req, res) => {
    try {
      const { centreId, date, confirmedBookings, showUpRateOverride, extraLabour } = req.body;
      if (!centreId || !date) return errorResponse(res, 'centreId and date are required', 400);
      const result = computeWhatIf(centreId.toUpperCase(), date, {
        confirmedBookings: confirmedBookings || [],
        showUpRateOverride: showUpRateOverride ? Number(showUpRateOverride) : null,
        extraLabour: extraLabour ? Number(extraLabour) : 0
      });
      return successResponse(res, result, 'What-if scenario computed (rule-based)');
    } catch (err) {
      return errorResponse(res, 'What-if computation failed', 500, err.message);
    }
  },

  /**
   * POST /api/planning/simulate-peak (demo only)
   * Returns a synthetic peak-day forecast for demonstration.
   */
  postSimulatePeak: async (req, res) => {
    try {
      const centreId = (req.body?.centreId || getOfficerCentre(req)).toUpperCase();
      const date = req.body?.date || new Date().toISOString().slice(0, 10);
      // Simulate 180 bookings peak day (all '15q+' band)
      const syntheticBookings = Array.from({ length: 180 }, () => ({ quantityBand: '15q+' }));
      const result = computeDayForecast(centreId, date, syntheticBookings);
      return successResponse(res, {
        ...result,
        note: 'demo data — simulated peak load. Not a real forecast.',
        label: 'demo simulation'
      }, 'Peak load simulation (demo data)');
    } catch (err) {
      return errorResponse(res, 'Simulation failed', 500, err.message);
    }
  },

  /**
   * GET /api/planning/resources?centreId=
   */
  getResources: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      if (mongoose.connection.readyState !== 1) {
        return successResponse(res, [], 'Resources retrieved (offline mode)');
      }
      const resources = await Resource.find({ centreId }).lean();
      return successResponse(res, resources, 'Resources retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch resources', 500, err.message);
    }
  },

  /**
   * PUT /api/planning/resources
   * Body: { centreId, type, count, unitCapacity }
   */
  putResources: async (req, res) => {
    try {
      const { centreId, type, count, unitCapacity } = req.body;
      if (!centreId || !type || count === undefined) {
        return errorResponse(res, 'centreId, type and count are required', 400);
      }
      const officerCentre = getOfficerCentre(req);
      if (req.user.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: wrong centre', 403);
      }
      const resource = await Resource.findOneAndUpdate(
        { centreId: centreId.toUpperCase(), type },
        { count: Number(count), unitCapacity: Number(unitCapacity || 1), updatedBy: req.user.id || req.user._id },
        { new: true, upsert: true }
      );
      await AuditLog.create({ actorId: req.user.id || req.user._id, actorRole: req.user.role, action: 'RESOURCE_UPDATE', targetId: resource._id, reason: `Set ${type} count=${count}` }).catch(() => {});
      return successResponse(res, resource, 'Resource updated');
    } catch (err) {
      return errorResponse(res, 'Failed to update resource', 500, err.message);
    }
  },

  /**
   * GET /api/planning/availability?centreId=&date=
   */
  getAvailability: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      const filter = { centreId };
      if (req.query.date) filter.date = req.query.date;
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'Availability retrieved (offline)');
      const avail = await Availability.find(filter).lean();
      return successResponse(res, avail, 'Availability retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch availability', 500, err.message);
    }
  },

  /**
   * PUT /api/planning/availability
   * Body: { centreId, date, resourceType, available, note }
   */
  putAvailability: async (req, res) => {
    try {
      const { centreId, date, resourceType, available, note } = req.body;
      if (!centreId || !date || !resourceType || available === undefined) {
        return errorResponse(res, 'centreId, date, resourceType, available are required', 400);
      }
      const officerCentre = getOfficerCentre(req);
      if (req.user.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: wrong centre', 403);
      }
      const avail = await Availability.findOneAndUpdate(
        { centreId: centreId.toUpperCase(), date, resourceType },
        { available: Number(available), note, updatedBy: req.user.id || req.user._id },
        { new: true, upsert: true }
      );
      return successResponse(res, avail, 'Availability updated');
    } catch (err) {
      return errorResponse(res, 'Failed to update availability', 500, err.message);
    }
  },

  /**
   * GET /api/planning/events?centreId=&date=
   */
  getEvents: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      const filter = { centreId };
      if (req.query.date) filter.date = req.query.date;
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'Events retrieved (offline)');
      const events = await CentreEvent.find(filter).lean();
      return successResponse(res, events, 'Events retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch events', 500, err.message);
    }
  },

  /**
   * POST /api/planning/events
   * Body: { centreId, date, kind, note }
   */
  postEvent: async (req, res) => {
    try {
      const { centreId, date, kind, note } = req.body;
      if (!centreId || !date || !kind) return errorResponse(res, 'centreId, date, kind required', 400);
      const officerCentre = getOfficerCentre(req);
      if (req.user.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: wrong centre', 403);
      }
      const ev = await CentreEvent.create({
        centreId: centreId.toUpperCase(), date, kind, note,
        createdBy: req.user.id || req.user._id
      });
      return successResponse(res, ev, 'Event created', 201);
    } catch (err) {
      return errorResponse(res, 'Failed to create event', 500, err.message);
    }
  },

  /**
   * GET /api/planning/slot-caps?centreId=&date=
   */
  getSlotCaps: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      const filter = { centreId };
      if (req.query.date) filter.date = req.query.date;
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'SlotCaps retrieved (offline)');
      const caps = await SlotCap.find(filter).lean();
      return successResponse(res, caps, 'Slot caps retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch slot caps', 500, err.message);
    }
  },

  /**
   * PUT /api/planning/slot-caps
   * Body: { centreId, date, hour, cap }
   * Warns if cap < confirmed. Never cancels bookings.
   */
  putSlotCap: async (req, res) => {
    try {
      const { centreId, date, hour, cap } = req.body;
      if (!centreId || !date || hour === undefined || cap === undefined) {
        return errorResponse(res, 'centreId, date, hour, cap required', 400);
      }
      const officerCentre = getOfficerCentre(req);
      if (req.user.role !== 'district_admin' && officerCentre !== centreId.toUpperCase()) {
        return errorResponse(res, 'Access denied: wrong centre', 403);
      }

      // Count confirmed bookings for this slot
      let confirmedCount = 0;
      if (mongoose.connection.readyState === 1) {
        // Resolve centre code → ObjectId
        const centreDoc = await require('../models').Centre.findOne({ code: centreId.toUpperCase() }).select('_id').lean();
        if (centreDoc) {
          const startHour = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
          const endHour = new Date(`${date}T${String(hour).padStart(2, '0')}:59:59.999Z`);
          confirmedCount = await Booking.countDocuments({
            centreId: centreDoc._id,
            arrivalWindowStart: { $gte: startHour, $lte: endHour },
            status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] }
          });
        }
      }

      const warnCapBelowConfirmed = Number(cap) < confirmedCount;
      const slotCap = await SlotCap.findOneAndUpdate(
        { centreId: centreId.toUpperCase(), date, hour: Number(hour) },
        { cap: Number(cap), confirmedAtSet: confirmedCount, warnCapBelowConfirmed, setBy: req.user.id || req.user._id },
        { new: true, upsert: true }
      );

      return successResponse(res, {
        slotCap,
        warning: warnCapBelowConfirmed
          ? `Cap (${cap}) is below current confirmed bookings (${confirmedCount}). Existing bookings are preserved.`
          : null
      }, 'Slot cap updated');
    } catch (err) {
      return errorResponse(res, 'Failed to update slot cap', 500, err.message);
    }
  },

  /**
   * GET /api/planning/accuracy
   * Returns comparison of previous forecasts to actuals (stub with demo data label).
   */
  getAccuracy: async (req, res) => {
    try {
      const centreId = (req.query.centreId || getOfficerCentre(req)).toUpperCase();
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'Accuracy retrieved (offline)');
      const snapshots = await ForecastSnapshot.find({ centreId }).sort({ date: -1 }).limit(14).lean();
      return successResponse(res, {
        centreId,
        snapshots,
        note: 'Accuracy data is rule-based comparison of projected vs actual arrivals. Demo data may show limited history.'
      }, 'Forecast accuracy retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch accuracy', 500, err.message);
    }
  },

  /**
   * GET /api/planning/requests
   * Own requests for officer; incoming borrow requests for lending centre.
   */
  getRequests: async (req, res) => {
    try {
      const centreId = getOfficerCentre(req);
      const role = req.user?.role;
      let query = {};
      if (role === 'district_admin') {
        query = { status: { $in: ['escalated', 'pending'] } };
      } else {
        query = { $or: [{ fromCentre: centreId }, { toCentre: centreId }] };
      }
      if (mongoose.connection.readyState !== 1) return successResponse(res, [], 'Requests retrieved (offline)');
      const requests = await PlanRequest.find(query).sort({ createdAt: -1 }).limit(50).lean();
      return successResponse(res, requests, 'Requests retrieved');
    } catch (err) {
      return errorResponse(res, 'Failed to fetch requests', 500, err.message);
    }
  },

  /**
   * POST /api/planning/requests
   * Body: { type: 'own'|'borrow', toCentre, resource, count, dates, isTest }
   */
  postRequest: async (req, res) => {
    try {
      const { type, toCentre, resource, count, dates, isTest } = req.body;
      if (!type || !resource || !count) return errorResponse(res, 'type, resource, count required', 400);
      if (type === 'borrow' && !toCentre) return errorResponse(res, 'toCentre required for borrow', 400);

      const centreId = getOfficerCentre(req);
      const deadlineSecs = getDeadlineSeconds(type, Boolean(isTest));
      const deadline = new Date(Date.now() + deadlineSecs * 1000);

      const planReq = await PlanRequest.create({
        type,
        fromCentre: centreId,
        toCentre: type === 'borrow' ? toCentre.toUpperCase() : centreId,
        resource,
        count: Number(count),
        dates: dates || [],
        status: 'pending',
        deadline,
        requestedBy: req.user.id || req.user._id,
        auditEntries: [{
          action: 'created',
          actorId: req.user.id || req.user._id,
          actorRole: req.user.role,
          at: new Date()
        }]
      });

      // Notify supervisor (own plan) or lending centre (borrow)
      const notifyTarget = type === 'own'
        ? { id: 'supervisor', type: 'role', role: 'supervisor', centreId }
        : { id: 'resource_officer', type: 'role', role: 'resource_officer', centreId: toCentre?.toUpperCase() };

      await notificationService.notify(
        notifyTarget,
        type === 'own' ? 'plan_request_received' : 'borrow_request_received',
        { requestId: planReq._id.toString(), fromCentre: centreId, resource, count },
        { io: req.io }
      ).catch(() => {});

      await AuditLog.create({
        actorId: req.user.id || req.user._id, actorRole: req.user.role,
        action: `PLAN_REQUEST_CREATED: ${type}`, targetId: planReq._id,
        reason: `${resource} x${count} for ${centreId}`
      }).catch(() => {});

      return successResponse(res, planReq, 'Request created', 201);
    } catch (err) {
      return errorResponse(res, 'Failed to create request', 500, err.message);
    }
  },

  /**
   * POST /api/planning/requests/:id/decision
   * Body: { decision: 'allowed'|'declined', reason }
   * Own plan: same officer can allow; supervisor can flag.
   * Borrow: only lending centre's resource_officer can decide.
   */
  postDecision: async (req, res) => {
    try {
      const { id } = req.params;
      const { decision, reason } = req.body;
      if (!decision || !['allowed', 'declined'].includes(decision)) {
        return errorResponse(res, 'decision must be "allowed" or "declined"', 400);
      }
      if (mongoose.connection.readyState !== 1) return errorResponse(res, 'DB offline', 503);

      const planReq = await PlanRequest.findById(id);
      if (!planReq) return errorResponse(res, 'Request not found', 404);
      if (!['pending', 'escalated'].includes(planReq.status)) {
        return errorResponse(res, `Request is already ${planReq.status}`, 409);
      }

      const role = req.user?.role;
      const officerCentre = getOfficerCentre(req);

      // RBAC: borrow → lending centre's officer; own → requesting centre's officer; escalated → district_admin
      if (planReq.type === 'borrow' && planReq.status !== 'escalated') {
        if (role !== 'resource_officer' || officerCentre !== planReq.toCentre) {
          return errorResponse(res, 'Only the lending centre resource_officer can decide borrow requests', 403);
        }
      } else if (planReq.type === 'own') {
        if (role !== 'resource_officer' || officerCentre !== planReq.fromCentre) {
          return errorResponse(res, 'Only your own centre resource_officer can decide own-plan requests', 403);
        }
      } else if (planReq.status === 'escalated' && role !== 'district_admin') {
        return errorResponse(res, 'Only district_admin can decide escalated requests', 403);
      }

      planReq.status = decision;
      planReq.decidedBy = req.user.id || req.user._id;
      if (reason) planReq.reason = reason;
      planReq.auditEntries.push({
        action: `decision_${decision}`, actorId: req.user.id || req.user._id,
        actorRole: role, note: reason, at: new Date()
      });
      await planReq.save();

      // Notify requestor
      await notificationService.notify(
        { id: planReq.requestedBy, type: 'staff', role: 'resource_officer', centreId: planReq.fromCentre },
        decision === 'allowed' ? 'request_allowed' : 'request_declined',
        { requestId: planReq._id.toString(), resource: planReq.resource, reason },
        { io: req.io }
      ).catch(() => {});

      await AuditLog.create({
        actorId: req.user.id || req.user._id, actorRole: role,
        action: `PLAN_REQUEST_${decision.toUpperCase()}`, targetId: planReq._id,
        reason: reason || decision
      }).catch(() => {});

      return successResponse(res, planReq, `Request ${decision}`);
    } catch (err) {
      return errorResponse(res, 'Failed to process decision', 500, err.message);
    }
  }
};

module.exports = planningController;
