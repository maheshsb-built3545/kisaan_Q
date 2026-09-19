/**
 * KisanQ Storage Service & Resilient MongoDB API Adapter
 * Bridges client-side React UI with backend MongoDB Atlas REST endpoints.
 * Automatically falls back to localStorage if MongoDB is offline or in standby mode.
 */

export const STORAGE_KEYS = {
  ACTIVE_TOKENS: 'kisanq_active_tokens',
  CENTRE_PIPELINE: 'kisanq_centre_pipeline',
  FARMER_PROFILE: 'kisanq_farmer_profile',
  DB_STATUS: 'kisanq_db_status',
};

import { pricesApi } from '../api';

// API Base URL - Uses Vite env var or fallback to localhost:5000/api
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Mandi Master Data ────────────────────────────────────────────────────────
export const MANDIS = [
  {
    id: 'KPG-01',
    name: 'APMC Kopargaon',
    location: 'Kopargaon, Ahmednagar',
    distance: 1.5,
    travelTime: '~5 mins',
    capacity: 85,
    congestion: 'High',
    color: 'red',
    cropsHandled: ['Wheat', 'Soybean', 'Onion', 'Cotton'],
    code: 'MH-KPG-01',
    rates: {
      yesterday: { Soybean: 4880, Wheat: 2410, Onion: 1920, Cotton: 7110 },
      today:     { Soybean: 4950, Wheat: 2460, Onion: 1980, Cotton: 7250 },
    },
  },
  {
    id: 'SRD-02',
    name: 'APMC Shirdi',
    location: 'Shirdi, Ahmednagar',
    distance: 15.2,
    travelTime: '~25 mins',
    capacity: 45,
    congestion: 'Moderate',
    color: 'amber',
    cropsHandled: ['Wheat', 'Soybean', 'Onion', 'Cotton'],
    code: 'MH-SRD-02',
    rates: {
      yesterday: { Soybean: 4885, Wheat: 2400, Onion: 1940, Cotton: 7090 },
      today:     { Soybean: 4950, Wheat: 2450, Onion: 1990, Cotton: 7210 },
    },
  },
  {
    id: 'RHT-03',
    name: 'APMC Rahata',
    location: 'Rahata, Ahmednagar',
    distance: 19.8,
    travelTime: '~32 mins',
    capacity: 20,
    congestion: 'Low',
    color: 'green',
    cropsHandled: ['Wheat', 'Cotton', 'Soybean', 'Onion'],
    code: 'MH-RHT-03',
    rates: {
      yesterday: { Soybean: 4870, Wheat: 2415, Onion: 1930, Cotton: 7120 },
      today:     { Soybean: 4940, Wheat: 2465, Onion: 1970, Cotton: 7240 },
    },
  },
  {
    id: 'VJP-04',
    name: 'APMC Vaijapur',
    location: 'Vaijapur, Aurangabad',
    distance: 31.0,
    travelTime: '~45 mins',
    capacity: 50,
    congestion: 'Moderate',
    color: 'amber',
    cropsHandled: ['Onion', 'Wheat', 'Soybean', 'Cotton'],
    code: 'MH-VJP-04',
    rates: {
      yesterday: { Soybean: 4860, Wheat: 2390, Onion: 1960, Cotton: 7150 },
      today:     { Soybean: 4930, Wheat: 2440, Onion: 2010, Cotton: 7280 },
    },
  },
  {
    id: 'SRP-05',
    name: 'APMC Shrirampur',
    location: 'Shrirampur, Ahmednagar',
    distance: 41.5,
    travelTime: '~55 mins',
    capacity: 78,
    congestion: 'High',
    color: 'red',
    cropsHandled: ['Soybean', 'Cotton', 'Wheat', 'Onion'],
    code: 'MH-SRP-05',
    rates: {
      yesterday: { Soybean: 4890, Wheat: 2420, Onion: 1925, Cotton: 7130 },
      today:     { Soybean: 4960, Wheat: 2470, Onion: 1975, Cotton: 7260 },
    },
  },
  {
    id: 'LSG-06',
    name: 'APMC Lasalgaon',
    location: 'Lasalgaon, Nashik',
    distance: 48.0,
    travelTime: '~65 mins',
    capacity: 65,
    congestion: 'Moderate',
    color: 'emerald',
    cropsHandled: ['Onion', 'Soybean', 'Wheat', 'Cotton'],
    code: 'MH-LSG-06',
    rates: {
      yesterday: { Soybean: 4870, Wheat: 2405, Onion: 1970, Cotton: 7100 },
      today:     { Soybean: 4935, Wheat: 2455, Onion: 2020, Cotton: 7230 },
    },
  },
];

/**
 * Synchronize daily live crop rates across all APMC mandis from unified backend service
 */
export async function syncMandiRates() {
  try {
    const res = await pricesApi.getAllPrices();
    const prices = Array.isArray(res) ? res : res?.data || [];
    if (prices.length > 0) {
      MANDIS.forEach((mandi) => {
        const cleanId = mandi.id.toUpperCase();
        const mandiPrices = prices.filter(p => p.mandiId === cleanId || p.mandiId?.startsWith(cleanId));
        mandiPrices.forEach(p => {
          if (p?.crop) {
            if (!mandi.rates) mandi.rates = { today: {}, yesterday: {} };
            if (!mandi.rates.today) mandi.rates.today = {};
            if (!mandi.rates.yesterday) mandi.rates.yesterday = {};
            mandi.rates.today[p.crop] = p.marketPriceToday;
            mandi.rates.yesterday[p.crop] = p.marketPriceYesterday !== null && p.marketPriceYesterday !== undefined ? p.marketPriceYesterday : p.mspPrice;
          }
        });
      });
    }
  } catch (err) {
    console.debug('[storageService] Live rates sync notice:', err.message);
  }
}

/**
 * Fetch latest dynamic crop rates for a specific mandi
 */
export async function fetchMandiRates(mandiId) {
  try {
    const res = await pricesApi.getPricesByMandi(mandiId);
    const prices = Array.isArray(res) ? res : res?.data || [];
    const rates = { today: {}, yesterday: {} };
    prices.forEach(p => {
      if (p?.crop) {
        rates.today[p.crop] = p.marketPriceToday;
        rates.yesterday[p.crop] = p.marketPriceYesterday !== null && p.marketPriceYesterday !== undefined ? p.marketPriceYesterday : p.mspPrice;
      }
    });
    const mandi = MANDIS.find(m => m.id === mandiId || m.code?.includes(mandiId));
    if (mandi && rates.today && Object.keys(rates.today).length > 0) {
      mandi.rates = rates;
    }
    return rates;
  } catch (err) {
    const fallback = MANDIS.find(m => m.id === mandiId) || MANDIS[0];
    return fallback?.rates || { today: {}, yesterday: {} };
  }
}

// Initial eager sync of live rates
syncMandiRates().catch(() => {});

// ─── Stage Definitions ────────────────────────────────────────────────────────
export const STAGE_DEFINITIONS = [
  {
    id: 'GATE_CHECKIN',
    label: 'Gate Check-in & QR Scan',
    shortLabel: 'Gate Check-in',
    officer: 'Security Desk #1',
    officerCode: 'SEC-D1-KPG',
    icon: 'gate',
  },
  {
    id: 'QUALITY_GRADING',
    label: 'Physical Assaying & Quality Grading',
    shortLabel: 'Quality Grading',
    officer: 'S. Patil, Quality Assayer',
    officerCode: 'QA-SP-KPG',
    icon: 'leaf',
  },
  {
    id: 'WEIGHBRIDGE',
    label: 'Digital Weighbridge #2',
    shortLabel: 'Weighbridge',
    officer: 'Weighment In-Charge',
    officerCode: 'WM-02-KPG',
    icon: 'scale',
  },
  {
    id: 'PROCUREMENT',
    label: 'Procurement & Price Confirmation',
    shortLabel: 'Procurement',
    officer: 'APMC Secretary Desk',
    officerCode: 'SEC-APMC-KPG',
    icon: 'document',
  },
  {
    id: 'PAYOUT',
    label: 'Final Accounts Payout / Digital E-Receipt',
    shortLabel: 'E-Receipt & Payout',
    officer: 'Treasury / Direct Bank Transfer',
    officerCode: 'TRY-DBT-KPG',
    icon: 'bank',
  },
];

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_PIPELINE = {
  'KPG-01': [
    { tokenId: 'KQ-KPG-2026-0001', farmerName: 'Ramesh Patil', crop: 'Red Onion', status: 'GATE_IN', queuePosition: 1 },
    { tokenId: 'KQ-KPG-2026-0002', farmerName: 'Suresh Jadhav', crop: 'Wheat', status: 'GATE_IN', queuePosition: 2 },
    { tokenId: 'KQ-KPG-2026-0003', farmerName: 'Ganesh Deshmukh', crop: 'Soybean', status: 'INSPECTED', queuePosition: 3 },
  ],
  'SRD-02': [
    { tokenId: 'KQ-SRD-2026-0011', farmerName: 'Vilas Shinde', crop: 'Wheat', status: 'GATE_IN', queuePosition: 1 },
  ],
  'RHT-03': [],
  'VJP-04': [
    { tokenId: 'KQ-VJP-2026-0021', farmerName: 'Prakash More', crop: 'Onion', status: 'GATE_IN', queuePosition: 1 },
  ],
  'SRP-05': [
    { tokenId: 'KQ-SRP-2026-0031', farmerName: 'Dilip Gaikwad', crop: 'Soybean', status: 'GATE_IN', queuePosition: 1 },
    { tokenId: 'KQ-SRP-2026-0032', farmerName: 'Ashok Kulkarni', crop: 'Cotton', status: 'GATE_IN', queuePosition: 2 },
  ],
};

// ─── Initialize Storage ───────────────────────────────────────────────────────
export function initializeStorage() {
  // Purge any legacy un-scoped monolithic tokens to prevent cross-account data bleeding
  const legacy = localStorage.getItem(STORAGE_KEYS.ACTIVE_TOKENS);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TOKENS);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TOKENS);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.CENTRE_PIPELINE)) {
    localStorage.setItem(STORAGE_KEYS.CENTRE_PIPELINE, JSON.stringify(SEED_PIPELINE));
  }
}

// ─── Health & Connection Check ────────────────────────────────────────────────
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        database: data.database || 'disconnected',
        cluster: data.cluster || 'offline_fallback'
      };
    }
  } catch {
    // Server offline
  }
  return { online: false, database: 'disconnected', cluster: 'local_storage_fallback' };
}

// ─── Scoped Local Token CRUD (Per Farmer Identity) ────────────────────────────
export function getScopedTokenKey(phone) {
  const cleanPhone = (phone || '').toString().trim().replace(/\D/g, '');
  return cleanPhone ? `kisanq_tokens_${cleanPhone}` : STORAGE_KEYS.ACTIVE_TOKENS;
}

export function getFarmerTokens(phone) {
  try {
    const key = getScopedTokenKey(phone);
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function getTokens(phone) {
  if (phone) return getFarmerTokens(phone);
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_TOKENS) || '[]');
  } catch {
    return [];
  }
}

export function saveToken(token) {
  const phone = token.farmerPhone || token.phone;
  const key = getScopedTokenKey(phone);
  const tokens = getFarmerTokens(phone);

  // Avoid duplicate entries
  const existingIdx = tokens.findIndex((t) => (t.id && t.id === token.id) || (t.tokenNumber && t.tokenNumber === token.tokenNumber));
  if (existingIdx !== -1) {
    tokens[existingIdx] = { ...tokens[existingIdx], ...token };
  } else {
    tokens.unshift(token); // newest first
  }
  localStorage.setItem(key, JSON.stringify(tokens));

  // Asynchronously push to backend if available
  saveTokenToApi(token).catch(() => {});
  return token;
}

export function updateToken(tokenId, updates, phone) {
  const targetPhone = phone || updates?.farmerPhone || updates?.phone;
  const key = getScopedTokenKey(targetPhone);
  const tokens = getFarmerTokens(targetPhone);

  const idx = tokens.findIndex((t) => t.id === tokenId || t.tokenNumber === tokenId);
  if (idx !== -1) {
    tokens[idx] = { ...tokens[idx], ...updates };
    localStorage.setItem(key, JSON.stringify(tokens));
    return tokens[idx];
  }
  return null;
}

export function updateTokenStage(tokenId, stageId, stageUpdates, phone) {
  const targetPhone = phone || stageUpdates?.farmerPhone || stageUpdates?.phone;
  const key = getScopedTokenKey(targetPhone);
  const tokens = getFarmerTokens(targetPhone);

  const idx = tokens.findIndex((t) => t.id === tokenId || t.tokenNumber === tokenId);
  if (idx !== -1) {
    const token = { ...tokens[idx] };
    if (Array.isArray(token.stages)) {
      const stageIdx = token.stages.findIndex((s) => s.id === stageId);
      if (stageIdx !== -1) {
        token.stages[stageIdx] = { ...token.stages[stageIdx], ...stageUpdates };
      }
      // Update overall token status based on stages
      const completed = token.stages.filter((s) => s.status === 'completed' || s.status === 'Completed').length;
      if (completed === 0) token.status = 'BOOKED';
      else if (completed === 1) token.status = 'GATE_IN';
      else if (completed === 2) token.status = 'INSPECTED';
      else if (completed === 3) token.status = 'WEIGHED';
      else if (completed === 4) token.status = 'PROCUREMENT';
      else if (completed >= 5) token.status = 'COMPLETED';

      token.currentStageIndex = Math.min(completed, token.stages.length);
    }

    tokens[idx] = token;
    localStorage.setItem(key, JSON.stringify(tokens));

    // Asynchronously push stage progress to backend
    updateStageProgressApi(tokenId, stageId, stageUpdates).catch(() => {});
    return token;
  }
  return null;
}

// ─── Resilient Async API Integration Layer ─────────────────────────────────────

/** Helper: Generate authenticated headers */
function getAuthHeaders() {
  const token = localStorage.getItem('kq_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Helper: Save token to MongoDB backend via REST endpoint */
async function saveTokenToApi(token) {
  try {
    const res = await fetch(`${API_BASE}/tokens/book`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        tokenNumber: token.tokenNumber || token.id,
        id: token.id || token.tokenNumber,
        farmerName: token.farmerName,
        farmerPhone: token.phone || token.farmerPhone,
        phone: token.phone || token.farmerPhone,
        mandiId: token.mandiId,
        mandiName: token.mandiName,
        mandiCode: token.mandiCode,
        crop: token.crop,
        quantity: token.quantity,
        quantityBand: token.quantityBand,
        slotDate: token.slotDate,
        slotTime: token.slotTime || token.slotLabel,
        slotLabel: token.slotLabel || token.slotTime,
        queuePosition: token.queuePosition,
        latitude: token.latitude || 19.8928,
        longitude: token.longitude || 74.4820,
        stages: token.stages
      }),
      signal: AbortSignal.timeout(4000)
    });

    const data = await res.json().catch(() => null);

    // 409 Conflict: Single-Active-Token Constraint or duplicate
    if (res.status === 409) {
      return {
        error: data?.error || 'ACTIVE_TOKEN_EXISTS',
        code: data?.error || 'ACTIVE_TOKEN_EXISTS',
        message: data?.message || 'You already have an active booking.',
        activeToken: data?.activeToken
      };
    }

    // 400 Bad Request: Slot expired
    if (res.status === 400 && (data?.code === 'SLOT_EXPIRED' || data?.error === 'SLOT_EXPIRED')) {
      return {
        error: 'SLOT_EXPIRED',
        code: 'SLOT_EXPIRED',
        message: data?.message || 'The selected arrival time slot has already passed for today. Please select a future time slot or book for tomorrow.'
      };
    }

    // 400 Bad Request: Pickup location required
    if (res.status === 400 || data?.code === 'PICKUP_LOCATION_REQUIRED') {
      return {
        error: data?.code || data?.error || 'PICKUP_LOCATION_REQUIRED',
        code: data?.code || data?.error || 'PICKUP_LOCATION_REQUIRED',
        message: data?.message || 'Please set your pickup location before booking'
      };
    }

    if (res.ok && data?.token) {
      return data.token;
    }

    if (!res.ok || data?.error || data?.code || data?.message) {
      return {
        error: data?.code || data?.error || 'BOOKING_FAILED',
        code: data?.code || data?.error || 'BOOKING_FAILED',
        message: data?.message || `Booking request returned status ${res.status}`
      };
    }

  } catch (err) {
    console.debug('[KisanQ Adapter] Backend booking API unreachable, using local persistence.', err.message);
  }
  return null;
}

/** Helper: Update stage progress in MongoDB backend */
async function updateStageProgressApi(tokenId, stageId, stageUpdates) {
  try {
    const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenId)}/stage-progress`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        stageId,
        status: stageUpdates.status || 'Completed',
        officerName: stageUpdates.officerName || stageUpdates.officer,
        officerSigId: stageUpdates.officerSigId,
        grade: stageUpdates.grade,
        weight: stageUpdates.weight,
        grossWeight: stageUpdates.grossWeight,
        tareWeight: stageUpdates.tareWeight,
        netWeight: stageUpdates.netWeight,
        moisture: stageUpdates.moisture,
        foreignMatter: stageUpdates.foreignMatter,
        poNumber: stageUpdates.poNumber,
        totalAmount: stageUpdates.totalAmount,
        paymentRef: stageUpdates.paymentRef,
        details: stageUpdates.details
      }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.token;
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Backend stage API unreachable, using local persistence.', err.message);
  }
  return null;
}


/**
 * Fetch tokens for a farmer: First attempts secure JWT-authenticated MongoDB API;
 * falls back to phone lookup, saves to isolated per-farmer storage, and respects 0-count empty state.
 */
export async function getTokensAsync(phone = '9876543210') {
  const token = localStorage.getItem('kq_token');
  const headers = getAuthHeaders();

  try {
    let res = null;
    // 1. First attempt secure /tokens/my-tokens if JWT token is stored
    if (token) {
      res = await fetch(`${API_BASE}/tokens/my-tokens`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(2500)
      }).catch(() => null);
    }

    // 2. Fallback to /tokens/farmer/:phone if /my-tokens failed or no token
    if (!res || !res.ok) {
      res = await fetch(`${API_BASE}/tokens/farmer/${encodeURIComponent(phone)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2500)
      }).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tokens)) {
        // Normalize token objects to ensure both id, tokenNumber, slotLabel, and stages exist
        const normalized = data.tokens.map((t) => ({
          ...t,
          id: t.id || t.tokenNumber,
          tokenNumber: t.tokenNumber || t.id,
          phone: t.phone || t.farmerPhone || phone,
          farmerPhone: t.farmerPhone || t.phone || phone,
          slotLabel: t.slotLabel || t.slotTime || '08:00 – 11:00 AM',
          slotTime: t.slotTime || t.slotLabel || '08:00 – 11:00 AM',
          quantityBand: t.quantityBand || `${t.quantity || 10} Quintals`,
          latitude: t.latitude || 19.8928,
          longitude: t.longitude || 74.4820,
          stages: Array.isArray(t.stages) && t.stages.length > 0 ? t.stages : STAGE_DEFINITIONS.map((def, idx) => ({
            stageIndex: idx,
            id: def.id,
            label: def.label,
            title: def.label,
            shortLabel: def.shortLabel,
            officer: def.officer,
            officerName: def.officer,
            officerCode: def.officerCode,
            officerRole: def.officerCode,
            icon: def.icon,
            status: 'pending',
            timestamp: null,
            completedAt: null,
            officerSigId: null,
            grade: null,
            weight: null,
            details: {}
          }))
        }));

        // Persist strictly to isolated per-farmer storage key
        localStorage.setItem(getScopedTokenKey(phone), JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Farmer tokens API unavailable, using isolated localStorage cache.');
  }

  return getFarmerTokens(phone);
}

/**
 * Save new token: Enforces single-token rule from backend, saves to MongoDB backend if available
 * and syncs localStorage only if not blocked by a 409 Conflict.
 */
export async function saveTokenAsync(token) {
  // First attempt backend booking to enforce business rules (e.g. 409 ACTIVE_TOKEN_EXISTS)
  const apiRes = await saveTokenToApi(token);

  if (apiRes && (apiRes.error || apiRes.code)) {
    const err = new Error(apiRes.message || 'Booking could not be completed.');
    err.code = apiRes.code || apiRes.error;
    err.activeToken = apiRes.activeToken;
    throw err;
  }


  const tokenToPersist = apiRes && !apiRes.error ? {
    ...apiRes,
    id: apiRes.id || apiRes.tokenNumber || token.id,
    tokenNumber: apiRes.tokenNumber || apiRes.id || token.tokenNumber,
    phone: apiRes.phone || apiRes.farmerPhone || token.phone,
    farmerPhone: apiRes.farmerPhone || apiRes.phone || token.farmerPhone,
    slotLabel: apiRes.slotLabel || apiRes.slotTime || token.slotLabel || '08:00 – 11:00 AM',
    quantityBand: apiRes.quantityBand || token.quantityBand || `${apiRes.quantity || 10} Quintals`,
    stages: Array.isArray(apiRes.stages) && apiRes.stages.length > 0 ? apiRes.stages : token.stages,
  } : token;

  const phone = tokenToPersist.farmerPhone || tokenToPersist.phone;
  const key = getScopedTokenKey(phone);
  const tokens = getFarmerTokens(phone);
  const idx = tokens.findIndex((t) => (t.id && t.id === tokenToPersist.id) || (t.tokenNumber && t.tokenNumber === tokenToPersist.tokenNumber));
  if (idx !== -1) {
    tokens[idx] = tokenToPersist;
  } else {
    tokens.unshift(tokenToPersist);
  }
  localStorage.setItem(key, JSON.stringify(tokens));

  return tokenToPersist;
}

/**
 * Update token stage: Updates both MongoDB backend and localStorage.
 */
export async function updateTokenStageAsync(tokenId, stageId, stageUpdates) {
  // Update local storage first
  const localUpdated = updateTokenStage(tokenId, stageId, stageUpdates);

  try {
    const apiUpdated = await updateStageProgressApi(tokenId, stageId, stageUpdates);
    if (apiUpdated) {
      const normalized = {
        ...apiUpdated,
        id: apiUpdated.id || apiUpdated.tokenNumber || tokenId,
        tokenNumber: apiUpdated.tokenNumber || apiUpdated.id || tokenId,
      };
      
      const tokens = getTokens();
      const idx = tokens.findIndex((t) => t.id === normalized.id || t.tokenNumber === normalized.tokenNumber);
      if (idx !== -1) {
        tokens[idx] = normalized;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
      }
      return normalized;
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Failed to sync stage update to API, persisted locally.');
  }

  return localUpdated;
}

/**
 * Fetch farmer portfolio pending cancellation dues and history
 */
export async function getFarmerProfileDuesApi(phone = '9876543210') {
  try {
    const res = await fetch(`${API_BASE}/tokens/farmer/${encodeURIComponent(phone)}/dues`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.farmer) {
        localStorage.setItem(STORAGE_KEYS.FARMER_PROFILE, JSON.stringify(data.farmer));
        return data.farmer;
      }
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Farmer profile dues API offline, fallback to local storage.');
  }

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FARMER_PROFILE) || '{"pendingDues":0,"cancellationHistory":[]}');
  } catch {
    return { pendingDues: 0, cancellationHistory: [] };
  }
}

/**
 * Preview dynamic penalty for a token
 */
export async function previewCancellationPenaltyApi(tokenId) {
  try {
    const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenId)}/cancellation-preview`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Preview penalty API unreachable.');
  }
  return null;
}

/**
 * Pre-Gate Token Cancellation (Stage 0/1)
 */
export async function cancelTokenApi(tokenId, reason = 'Farmer requested cancellation') {
  try {
    const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenId)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Update local storage
      const tokens = getTokens().map((t) => {
        if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
          return { ...t, status: 'Cancelled', cancellationFee: data.penaltyAmount, cancelledAt: new Date().toISOString() };
        }
        return t;
      });
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
      return data;
    }
    if (data?.error || data?.message) {
      const err = new Error(data.message || 'Failed to cancel token');
      err.code = data.error;
      throw err;
    }
  } catch (err) {
    if (err.code) throw err;
    console.debug('[KisanQ Adapter] Cancel API unreachable, cancelling locally.');
    // Local fallback
    const tokens = getTokens().map((t) => {
      if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
        return { ...t, status: 'Cancelled', cancelledAt: new Date().toISOString() };
      }
      return t;
    });
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
    return { success: true, status: 'Cancelled', penaltyAmount: 0 };
  }
}

/**
 * Post-Gate Exit Request (Stage 1 Completed / Yard Entry)
 */
export async function requestGateExitApi(tokenId, reason = 'Produce Rejection') {
  try {
    const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenId)}/request-exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const tokens = getTokens().map((t) => {
        if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
          return { ...t, status: 'Gate-Exit-Requested', cancellationReason: reason };
        }
        return t;
      });
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
      return data;
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Gate exit request API unreachable, updating locally.');
  }

  const tokens = getTokens().map((t) => {
    if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
      return { ...t, status: 'Gate-Exit-Requested', cancellationReason: reason };
    }
    return t;
  });
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
  return { success: true, status: 'Gate-Exit-Requested' };
}

/**
 * Desk 1 Gate Officer Authorizes Exit & Opens Barrier
 */
export async function approveGateExitApi(tokenId, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenId)}/approve-exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const tokens = getTokens().map((t) => {
        if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
          return { ...t, status: 'Cancelled', cancellationFee: payload.penaltyAmount || 150, gateExitApprovedBy: payload.officerName };
        }
        return t;
      });
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
      return data;
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Approve exit API unreachable, updating locally.');
  }

  const tokens = getTokens().map((t) => {
    if ((t.id === tokenId) || (t.tokenNumber === tokenId)) {
      return { ...t, status: 'Cancelled', cancellationFee: payload.penaltyAmount || 150, gateExitApprovedBy: payload.officerName };
    }
    return t;
  });
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TOKENS, JSON.stringify(tokens));
  return { success: true, status: 'Cancelled', penaltyAmount: payload.penaltyAmount || 150 };
}

// ─── Pipeline CRUD ────────────────────────────────────────────────────────────
export function getPipeline() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CENTRE_PIPELINE) || '{}');
  } catch {
    return SEED_PIPELINE;
  }
}

export function addTokenToPipeline(mandiId, entry) {
  const pipeline = getPipeline();
  if (!pipeline[mandiId]) pipeline[mandiId] = [];
  const queuePos = pipeline[mandiId].length + 1;
  pipeline[mandiId].push({ ...entry, queuePosition: queuePos });
  localStorage.setItem(STORAGE_KEYS.CENTRE_PIPELINE, JSON.stringify(pipeline));
  return queuePos;
}

export function getMandiQueueCount(mandiId) {
  const pipeline = getPipeline();
  return (pipeline[mandiId] || []).length;
}

// ─── Token Generator ─────────────────────────────────────────────────────────
export function generateTokenId(mandiCode) {
  const prefix = mandiCode || 'KPG';
  const year = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 8999));
  return `KQ-${prefix}-${year}-${rand}`;
}

export function buildNewToken({ id: customId, tokenNumber: customTokenNumber, mandiId, mandiName, mandiCode, farmerName, phone, crop, quantityBand, quantity, slotLabel, slotDate, latitude = 19.8928, longitude = 74.4820 }) {
  const id = customId || customTokenNumber || generateTokenId(mandiCode);
  const now = new Date().toISOString();

  return {
    id,
    tokenNumber: id,
    farmerName: farmerName || 'Mahesh Borde',
    farmerPhone: phone || '9876543210',
    phone: phone || '9876543210',
    mandiId,
    mandiName,
    mandiCode,
    crop,
    quantityBand: quantityBand || `${quantity || 10} Quintals`,
    quantity: quantity || 10,
    slotLabel: slotLabel || 'Morning 08:00 – 11:00 AM',
    slotTime: slotLabel || '08:00 – 11:00 AM',
    slotDate,
    latitude: Number(latitude) || 19.8928,
    longitude: Number(longitude) || 74.4820,
    status: 'BOOKED',
    queuePosition: 8,
    createdAt: now,
    stages: STAGE_DEFINITIONS.map((def, idx) => ({
      stageIndex: idx,
      id: def.id,
      label: def.label,
      title: def.label,
      shortLabel: def.shortLabel,
      officer: def.officer,
      officerName: def.officer,
      officerCode: def.officerCode,
      officerRole: def.officerCode,
      icon: def.icon,
      status: 'pending',
      timestamp: null,
      completedAt: null,
      officerSigId: null,
      grade: null,
      weight: null,
      details: {}
    })),
  };
}

/**
 * Admin Database Reset API
 */
export async function resetDataApi() {
  try {
    const res = await fetch(`${API_BASE}/admin/reset-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TOKENS);
      localStorage.removeItem(STORAGE_KEYS.CENTRE_PIPELINE);
      return data;
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Reset API unreachable, clearing local storage.');
  }

  localStorage.removeItem(STORAGE_KEYS.ACTIVE_TOKENS);
  localStorage.removeItem(STORAGE_KEYS.CENTRE_PIPELINE);
  return { success: true, message: 'Local storage reset' };
}

/**
 * Fetch Registered Farmers API
 */
export async function getFarmersApi() {
  try {
    const res = await fetch(`${API_BASE}/admin/farmers`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.data?.farmers || [];
    }
  } catch (err) {
    console.debug('[KisanQ Adapter] Get farmers API unreachable.');
  }
  return [];
}

/**
 * Register New Farmer API
 */
export async function createFarmerApi(farmerData) {
  try {
    const res = await fetch(`${API_BASE}/admin/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(farmerData),
      signal: AbortSignal.timeout(3500)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data.data?.farmer || data.data;
    }
    throw new Error(data.message || 'Failed to create farmer');
  } catch (err) {
    console.error('Error creating farmer:', err);
    throw err;
  }
}

