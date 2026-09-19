/**
 * Standardized KisanQ Token Status Enums and Normalization Utility (Frontend)
 */
export const TOKEN_STATUS = {
  BOOKED: 'Booked',
  IN_PROGRESS: 'In-Progress',
  GATE_EXIT_REQUESTED: 'Gate-Exit-Requested',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

export function normalizeStatus(status) {
  if (!status) return TOKEN_STATUS.BOOKED;
  const s = String(status).trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (
    s === 'GATE-EXIT-REQUESTED' ||
    s === 'GATE-EXIT-REQUEST' ||
    s === 'GATE_EXIT_REQUESTED' ||
    s === 'EXIT-REQUESTED' ||
    s === 'EXIT_REQUESTED' ||
    s === 'GATEEXITREQUESTED'
  ) {
    return TOKEN_STATUS.GATE_EXIT_REQUESTED;
  }
  if (s === 'COMPLETED' || s === 'DONE') {
    return TOKEN_STATUS.COMPLETED;
  }
  if (s === 'CANCELLED' || s === 'CANCELED') {
    return TOKEN_STATUS.CANCELLED;
  }
  if (
    s === 'IN-PROGRESS' ||
    s === 'INPROGRESS' ||
    s === 'GATE-IN' ||
    s === 'GATE_IN' ||
    s === 'INSPECTED' ||
    s === 'WEIGHED' ||
    s === 'PROCUREMENT' ||
    s === 'PAYOUT'
  ) {
    return TOKEN_STATUS.IN_PROGRESS;
  }
  if (s === 'BOOKED' || s === 'PENDING') {
    return TOKEN_STATUS.BOOKED;
  }
  return status;
}

export function isTokenActive(status) {
  const norm = normalizeStatus(status);
  return norm !== TOKEN_STATUS.COMPLETED && norm !== TOKEN_STATUS.CANCELLED;
}

/**
 * Range-based Queue Position formatting to avoid over-promising precision
 * @param {number|string} pos - Queue position (1-based index)
 * @param {string} lang - 'en' | 'mr' | 'hi'
 * @returns {string} Range formatted string, e.g. "You are next", "1–3 ahead", "4–7 ahead"
 */
export function formatQueueRange(pos, lang = 'en') {
  const num = Number(pos);
  if (isNaN(num) || num <= 1) {
    if (lang === 'mr') return 'पुढील नंबर तुमचा आहे';
    if (lang === 'hi') return 'अगला नंबर आपका है';
    return 'You are next';
  }
  const ahead = num - 1;
  return formatVehiclesAheadRange(ahead, lang);
}

/**
 * Range-based "Vehicles Ahead" formatting
 * @param {number|string} ahead - Number of vehicles ahead
 * @param {string} lang - 'en' | 'mr' | 'hi'
 */
export function formatVehiclesAheadRange(ahead, lang = 'en') {
  const n = Number(ahead);
  if (isNaN(n) || n <= 0) {
    if (lang === 'mr') return 'पुढील नंबर तुमचा आहे';
    if (lang === 'hi') return 'अगला नंबर आपका है';
    return 'You are next';
  }
  if (n === 1) {
    if (lang === 'mr') return '१ वाहन पुढे';
    if (lang === 'hi') return '१ वाहन आगे';
    return '1 ahead';
  }
  if (n <= 3) {
    if (lang === 'mr') return '१–३ वाहने पुढे';
    if (lang === 'hi') return '१–३ वाहन आगे';
    return '1–3 ahead';
  }
  if (n <= 7) {
    if (lang === 'mr') return '४–७ वाहने पुढे';
    if (lang === 'hi') return '४–७ वाहन आगे';
    return '4–7 ahead';
  }
  if (n <= 12) {
    if (lang === 'mr') return '८–१२ वाहने पुढे';
    if (lang === 'hi') return '८–१२ वाहन आगे';
    return '8–12 ahead';
  }
  if (lang === 'mr') return '१०+ वाहने पुढे';
  if (lang === 'hi') return '१०+ वाहन आगे';
  return '10+ ahead';
}
