/**
 * KisanQ Resource Planning Forecast Configuration (PRD 2.7)
 * Rule-based forecast engine — all outputs are labelled "rule-based", NOT AI.
 *
 * All numeric constants here are assumed defaults.
 * They switch to measured (rolling median) once >= 20 telemetry samples exist.
 */

'use strict';

/**
 * Fill curve: probability that a confirmed booking shows up, by lead-days before the date.
 * e.g. 0 days out => 0.90; 6 days out => 0.55.
 * Used to project total expected bookings from confirmed-so-far.
 *
 * fillCurve[leadDays] = fraction of final bookings already confirmed by that many days out.
 * projectedBookings = confirmedSoFar / fillCurve[leadDays]
 */
const FILL_CURVE = {
  0: 0.95,
  1: 0.85,
  2: 0.75,
  3: 0.65,
  4: 0.60,
  5: 0.57,
  6: 0.55,
  7: 0.52,
  // Default for > 7 days
  default: 0.50
};

/**
 * Get the fill curve fraction for a given number of lead days.
 */
function getFillFraction(leadDays) {
  const d = Math.max(0, Math.min(7, Math.round(leadDays)));
  return FILL_CURVE[d] ?? FILL_CURVE.default;
}

/**
 * Show-up rate: fraction of expected arrivals who actually show.
 * Assumed default: 0.85. Reasonable range: [0.75, 0.95].
 */
const SHOW_UP_RATE = {
  assumed: 0.85,
  rangeMin: 0.75,
  rangeMax: 0.95
};

/**
 * Quantity band midpoints in quintals.
 * '0-5q' => 2.5, '5-15q' => 10, '15q+' => 20
 */
const QUANTITY_BAND_MIDPOINTS = {
  '0-5q': 2.5,
  '5-15q': 10,
  '15q+': 20,
  default: 10
};

function getBandMidpoint(band) {
  return QUANTITY_BAND_MIDPOINTS[band] ?? QUANTITY_BAND_MIDPOINTS.default;
}

/**
 * Labour capacity: quintals per labourer per shift.
 */
const LABOUR_QUINTALS_PER_SHIFT = 40;

/**
 * Desk utilisation target (efficiency factor for desk-staff calculation).
 * neededStaff = ceil(arrivalsPerHour × medianMinutes / 60 / DESK_UTIL_TARGET)
 */
const DESK_UTIL_TARGET = 0.8;

/**
 * Heat thresholds for capacity ratio (capacity / need):
 * >= 1.0  → Green  (adequate)
 * 0.8–1.0 → Amber  (watch)
 * < 0.8   → Red    (critical)
 */
const HEAT_THRESHOLDS = {
  green: 1.0,   // >= this → Green
  amber: 0.8    // >= this AND < green → Amber; else Red
};

function getHeatStatus(capacityRatio) {
  if (capacityRatio >= HEAT_THRESHOLDS.green) return 'Green';
  if (capacityRatio >= HEAT_THRESHOLDS.amber) return 'Amber';
  return 'Red';
}

/**
 * Arrival curve: assumed hourly distribution of arrivals across 8-hour working day.
 * Index 0 = first hour (e.g. 08:00–09:00). Five elements (5-hour core window).
 * Assumed default based on historical APMC patterns.
 */
const ARRIVAL_CURVE_ASSUMED = [0.1, 0.25, 0.35, 0.2, 0.1];

/**
 * Request deadline defaults (in seconds).
 * Configurable for test environments.
 */
const REQUEST_DEADLINE_SECONDS = {
  ownPlan: 24 * 3600,   // 24 hours for own-plan approvals
  borrow: 48 * 3600,    // 48 hours for borrow requests
  test: parseInt(process.env.PLANNING_REQUEST_DEADLINE_TEST_SECONDS || '0', 10) || 10
};

function getDeadlineSeconds(type, isTest = false) {
  if (isTest) return REQUEST_DEADLINE_SECONDS.test;
  return type === 'own' ? REQUEST_DEADLINE_SECONDS.ownPlan : REQUEST_DEADLINE_SECONDS.borrow;
}

module.exports = {
  FILL_CURVE,
  getFillFraction,
  SHOW_UP_RATE,
  QUANTITY_BAND_MIDPOINTS,
  getBandMidpoint,
  LABOUR_QUINTALS_PER_SHIFT,
  DESK_UTIL_TARGET,
  HEAT_THRESHOLDS,
  getHeatStatus,
  ARRIVAL_CURVE_ASSUMED,
  REQUEST_DEADLINE_SECONDS,
  getDeadlineSeconds
};
