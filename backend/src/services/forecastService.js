/**
 * forecastService.js — Rule-based 7-day resource planning forecast (PRD 2.7)
 * All outputs are labelled "rule-based". No AI.
 */

'use strict';

const mongoose = require('mongoose');
const {
  getFillFraction,
  SHOW_UP_RATE,
  getBandMidpoint,
  LABOUR_QUINTALS_PER_SHIFT,
  DESK_UTIL_TARGET,
  getHeatStatus,
  ARRIVAL_CURVE_ASSUMED,
  getDeadlineSeconds
} = require('../config/forecast');
const { getTiming, getCentreTimings } = require('../config/timings');
const { Booking, Centre, Resource, ForecastSnapshot, PlanRequest, AuditLog } = require('../models');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Get the number of lead days from today to a target date string.
 */
function getLeadDays(targetDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr + 'T00:00:00.000Z');
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Compute rule-based forecast for a single date.
 *
 * @param {string} centreId - APMC centre code (e.g. 'KPG-01')
 * @param {string} date - 'YYYY-MM-DD'
 * @param {object[]} confirmedBookings - Bookings already confirmed for that date+centre
 * @returns {object} Forecast object with all derived metrics
 */
function computeDayForecast(centreId, date, confirmedBookings = []) {
  const leadDays = getLeadDays(date);
  const confirmed = confirmedBookings.length;

  // Data quality: if 0 confirmed bookings, insufficient data
  if (confirmed === 0) {
    return {
      centreId,
      date,
      leadDays,
      confirmedBookings: 0,
      projectedBookings: 0,
      expectedArrivalsMin: 0,
      expectedArrivalsMax: 0,
      expectedArrivalsMid: 0,
      totalQuintalsMin: 0,
      totalQuintalsMax: 0,
      totalQuintalsMid: 0,
      labourNeeded: 0,
      bottleneck: 'no_data',
      heatStatus: 'Amber',
      dataQualityBadge: 'assumed',
      insufficientData: true,
      note: 'insufficient data (0 confirmed bookings)',
      label: 'rule-based forecast'
    };
  }

  // 1. projectedBookings = confirmedSoFar / fillCurve(leadDays)
  const fillFraction = getFillFraction(leadDays);
  const projectedBookings = Math.round(confirmed / fillFraction);

  // 2. expectedArrivals = projected × showUpRate (range)
  const showMin = SHOW_UP_RATE.rangeMin;
  const showMid = SHOW_UP_RATE.assumed;
  const showMax = SHOW_UP_RATE.rangeMax;
  const arrivalsMin = Math.round(projectedBookings * showMin);
  const arrivalsMid = Math.round(projectedBookings * showMid);
  const arrivalsMax = Math.round(projectedBookings * showMax);

  // 3. Quintals from quantity bands
  const quintalsPerBooking = confirmedBookings.reduce((sum, b) => {
    return sum + getBandMidpoint(b.quantityBand || '5-15q');
  }, 0) / (confirmed || 1);

  const totalQuintalsMin = Math.round(arrivalsMin * quintalsPerBooking);
  const totalQuintalsMid = Math.round(arrivalsMid * quintalsPerBooking);
  const totalQuintalsMax = Math.round(arrivalsMax * quintalsPerBooking);

  // 4. Labour needed
  const labourNeeded = Math.ceil(totalQuintalsMid / LABOUR_QUINTALS_PER_SHIFT);

  // 5. Desk staff needed (weighbridge example — worst case bottleneck desk)
  const weighbridgeTiming = getTiming(centreId, 'weighbridgeServiceTime');
  const workingHours = 8;
  const arrivalsPerHour = arrivalsMid / workingHours;
  const neededWeighbridgeStaff = Math.ceil(
    (arrivalsPerHour * weighbridgeTiming.value) / 60 / DESK_UTIL_TARGET
  );

  // 6. Data quality badge from timings
  const timings = getCentreTimings(centreId);
  const allAssumed = Object.values(timings).every(
    (t) => !t || t.source === 'assumed' || t.source === undefined
  );
  const dataQualityBadge = allAssumed
    ? 'assumed'
    : `measured (${weighbridgeTiming.samples} samples)`;

  // 7. Bottleneck and heat status
  // Simple: compare labour capacity to need
  const bottleneck = labourNeeded > 5 ? 'labour' : 'none';
  // Capacity ratio: resources-on-hand / needed (simplified: use neededWeighbridgeStaff vs 2 weighbridges)
  const capacityRatio = neededWeighbridgeStaff > 0 ? 2 / neededWeighbridgeStaff : 2;
  const heatStatus = getHeatStatus(capacityRatio);

  return {
    centreId,
    date,
    leadDays,
    confirmedBookings: confirmed,
    projectedBookings,
    fillFraction,
    expectedArrivalsMin: arrivalsMin,
    expectedArrivalsMid: arrivalsMid,
    expectedArrivalsMax: arrivalsMax,
    avgQuintalsPerBooking: parseFloat(quintalsPerBooking.toFixed(1)),
    totalQuintalsMin,
    totalQuintalsMid,
    totalQuintalsMax,
    labourNeeded,
    neededWeighbridgeStaff,
    capacityRatio: parseFloat(capacityRatio.toFixed(2)),
    bottleneck,
    heatStatus,
    dataQualityBadge,
    insufficientData: false,
    timings: {
      weighbridge: weighbridgeTiming
    },
    label: 'rule-based forecast'
  };
}

/**
 * Compute 7-day forecast for a centre.
 */
async function computeWeekForecast(centreId) {
  const today = new Date();
  const results = [];

  // Resolve centreId string to ObjectId for Booking queries
  let centreObjectId = null;
  if (mongoose.connection.readyState === 1) {
    const { Centre } = require('../models');
    const centreDoc = await Centre.findOne({
      $or: [{ code: centreId }, { _id: mongoose.isValidObjectId(centreId) ? centreId : undefined }]
    }).select('_id').lean();
    centreObjectId = centreDoc?._id || null;
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    let bookings = [];
    if (mongoose.connection.readyState === 1 && centreObjectId) {
      const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
      bookings = await Booking.find({
        centreId: centreObjectId,
        arrivalWindowStart: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] }
      }).select('quantityBand status').lean();
    }

    const dayForecast = computeDayForecast(centreId, dateStr, bookings);
    results.push(dayForecast);
  }

  return results;
}

/**
 * What-if analysis: recalculate forecast with overridden inputs.
 */
function computeWhatIf(centreId, date, { confirmedBookings, showUpRateOverride, extraLabour = 0 }) {
  const confirmedArr = confirmedBookings || [];
  const base = computeDayForecast(centreId, date, confirmedArr);

  if (!showUpRateOverride) return base;

  const projected = base.projectedBookings;
  const arrivalsOverride = Math.round(projected * showUpRateOverride);
  const quintals = Math.round(arrivalsOverride * (base.avgQuintalsPerBooking || 10));
  const labourNeeded = Math.max(0, Math.ceil(quintals / LABOUR_QUINTALS_PER_SHIFT) - extraLabour);

  return {
    ...base,
    showUpRateOverride,
    extraLabour,
    expectedArrivalsMid: arrivalsOverride,
    totalQuintalsMid: quintals,
    labourNeeded,
    label: 'rule-based what-if'
  };
}

/**
 * Expire and escalate plan requests past their deadline.
 * Runs as a setInterval job in server.js.
 */
async function expireAndEscalateRequests(io) {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const now = new Date();

    // Expire own-plan requests past deadline with no decision
    const expiredOwn = await PlanRequest.find({
      type: 'own',
      status: 'pending',
      deadline: { $lt: now }
    });
    for (const req of expiredOwn) {
      req.status = 'expired';
      req.auditEntries.push({ action: 'auto_expired', actorId: 'SYSTEM', actorRole: 'system', at: now });
      await req.save();
      logger.info(`[Planning] Own-plan request ${req._id} expired`);
    }

    // Escalate borrow requests past deadline → district_admin
    const expiredBorrow = await PlanRequest.find({
      type: 'borrow',
      status: 'pending',
      deadline: { $lt: now }
    });
    for (const req of expiredBorrow) {
      req.status = 'escalated';
      req.auditEntries.push({ action: 'auto_escalated_to_district_admin', actorId: 'SYSTEM', actorRole: 'system', at: now });
      await req.save();

      // Notify district admin
      await notificationService.notify(
        { id: 'district_admin', type: 'role', role: 'district_admin', centreId: req.fromCentre },
        'request_escalated',
        { requestId: req._id.toString(), fromCentre: req.fromCentre, toCentre: req.toCentre, resource: req.resource },
        { io }
      ).catch(() => {});

      logger.info(`[Planning] Borrow request ${req._id} escalated to district_admin`);
    }

    // Log to AuditLog
    const totalProcessed = expiredOwn.length + expiredBorrow.length;
    if (totalProcessed > 0) {
      await AuditLog.create({
        actorId: 'SYSTEM',
        actorRole: 'system',
        action: `PLANNING_EXPIRE_ESCALATE: ${expiredOwn.length} expired, ${expiredBorrow.length} escalated`,
        targetId: 'PlanRequest',
        reason: 'Automatic deadline enforcement'
      }).catch(() => {});
    }
  } catch (err) {
    logger.error(`[Planning] expireAndEscalateRequests error: ${err.message}`);
  }
}

module.exports = {
  computeDayForecast,
  computeWeekForecast,
  computeWhatIf,
  expireAndEscalateRequests
};
