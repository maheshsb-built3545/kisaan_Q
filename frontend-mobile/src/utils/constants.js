export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export const COLORS = {
  primary: '#16a34a',     // Green 600
  primaryDark: '#15803d', // Green 700
  primaryLight: '#dcfce7',// Green 100
  accent: '#f59e0b',      // Amber 500
  danger: '#ef4444',      // Red 500
  background: '#f8fafc',  // Slate 50
  surface: '#ffffff',
  text: '#0f172a',        // Slate 900
  textMuted: '#64748b',   // Slate 500
  border: '#e2e8f0'       // Slate 200
};

/**
 * Range-based Queue Position formatting for Mobile App
 * @param {number|string} pos - Queue position (1-based index)
 * @param {string} lang - 'en' | 'mr' | 'hi'
 * @returns {string} Range formatted string, e.g. "You are next", "1–3 ahead", "4–7 ahead"
 */
export function formatQueueRange(pos, lang = 'mr') {
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
export function formatVehiclesAheadRange(ahead, lang = 'mr') {
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

export function isTokenActive(tokenOrStatus) {
  if (!tokenOrStatus) return false;
  const status = typeof tokenOrStatus === 'object' ? tokenOrStatus.status : tokenOrStatus;
  if (!status) return false;
  const s = String(status).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'COMPLETED' || s === 'CANCELLED' || s === 'CANCELED' || s === 'DONE') {
    return false;
  }
  return true;
}
