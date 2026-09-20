/**
 * KisanQ Operational Timings Configuration & Measured Telemetry Engine
 * PRD 2.8 Compliance:
 * - Leave-by pace: 8 min/truck (assumed default)
 * - Desk service times:
 *     - Security Gate (Desk 1): 3.5 min (assumed default)
 *     - Quality Lab (Desk 2): 5.0 min (assumed default)
 *     - Weighbridge (Desk 3): 8.0 min (assumed default)
 *     - Procurement (Desk 4): 4.0 min (assumed default)
 * - Arrival curve: [0.1, 0.25, 0.35, 0.2, 0.1] (assumed default)
 * 
 * Rules:
 * - Uses rolling median per centre once sample size >= 20.
 * - Displays "assumed" when samples < 20, and "measured (N samples)" once samples >= 20.
 */

const ASSUMED_DEFAULTS = {
  leaveByPace: 8.0, // min/truck
  gateServiceTime: 3.5, // min (Desk 1)
  qualityServiceTime: 5.0, // min (Desk 2)
  weighbridgeServiceTime: 8.0, // min (Desk 3)
  procurementServiceTime: 4.0, // min (Desk 4)
  arrivalCurve: [0.1, 0.25, 0.35, 0.2, 0.1] // standard hourly arrival distribution
};

// In-memory rolling observation samples keyed by centreId:metricKey
const samplesStore = new Map();

/**
 * Calculates median of numeric array
 */
function computeMedian(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

/**
 * Record a measured timing sample for a specific centre and metric
 * @param {string} centreId APMC centre code (e.g. 'KPG-01')
 * @param {string} metricKey Timing metric key
 * @param {number} sampleValue Observed duration in minutes
 */
function recordSample(centreId, metricKey, sampleValue) {
  if (typeof sampleValue !== 'number' || isNaN(sampleValue) || sampleValue <= 0) return;
  const key = `${(centreId || 'GLOBAL').toUpperCase()}:${metricKey}`;
  if (!samplesStore.has(key)) {
    samplesStore.set(key, []);
  }
  const list = samplesStore.get(key);
  list.push(sampleValue);
  // Keep rolling window of last 100 observations
  if (list.length > 100) {
    list.shift();
  }
}

/**
 * Clear samples for testing isolation
 */
function clearSamples() {
  samplesStore.clear();
}

/**
 * Retrieve timing object with assumed vs measured telemetry status
 * @param {string} centreId APMC centre code
 * @param {string} metricKey Timing metric key
 * @returns {{ value: number, source: 'assumed'|'measured', samples: number, display: string }}
 */
function getTiming(centreId, metricKey) {
  const defVal = ASSUMED_DEFAULTS[metricKey] !== undefined ? ASSUMED_DEFAULTS[metricKey] : 8.0;
  const key = `${(centreId || 'GLOBAL').toUpperCase()}:${metricKey}`;
  const samples = samplesStore.get(key) || [];
  const sampleCount = samples.length;

  if (sampleCount >= 20) {
    const medianVal = computeMedian(samples);
    return {
      value: medianVal,
      source: 'measured',
      samples: sampleCount,
      display: `measured (${sampleCount} samples)`,
      formatted: `${medianVal} min (measured, ${sampleCount} samples)`
    };
  }

  return {
    value: defVal,
    source: 'assumed',
    samples: sampleCount,
    display: 'assumed',
    formatted: `${defVal} min (assumed)`
  };
}

/**
 * Get full timing telemetry block for a centre
 */
function getCentreTimings(centreId) {
  return {
    centreId,
    leaveByPace: getTiming(centreId, 'leaveByPace'),
    gateServiceTime: getTiming(centreId, 'gateServiceTime'),
    qualityServiceTime: getTiming(centreId, 'qualityServiceTime'),
    weighbridgeServiceTime: getTiming(centreId, 'weighbridgeServiceTime'),
    procurementServiceTime: getTiming(centreId, 'procurementServiceTime'),
    arrivalCurve: {
      value: ASSUMED_DEFAULTS.arrivalCurve,
      source: 'assumed',
      samples: 0,
      display: 'assumed'
    }
  };
}

module.exports = {
  ASSUMED_DEFAULTS,
  computeMedian,
  recordSample,
  clearSamples,
  getTiming,
  getCentreTimings
};
