const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Token = require('../models/Token');
const Farmer = require('../models/Farmer');
const authService = require('../services/authService');
const notificationService = require('../services/notificationService');
const fastTrackAuctionService = require('../services/fastTrackAuctionService');
const logger = require('../utils/logger');
const { optionalAuthenticate, authenticate } = require('../middleware/auth.middleware');

const { TOKEN_STATUS, normalizeStatus } = require('../utils/statusEnums');
const {
  broadcastNewBooking,
  broadcastStageUpdated,
  broadcastHardwareEvent,
  broadcastAgriPoolMatch,
  broadcastTokenCompleted,
  broadcastTokenCancelled,
  broadcastGateExitRequested,
  broadcastExitApproved,
  broadcastFarmerDuesUpdated,
  broadcastQueueSlotFreed
} = require('../socket/queue.socket');

/** Helper: Calculate distance between two coordinates in meters using Haversine formula */
function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (Number(lat1) * Math.PI) / 180;
  const φ2 = (Number(lat2) * Math.PI) / 180;
  const Δφ = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const Δλ = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates deterministic, non-overlapping wait range string from exact queue position.
 * @param {number} position - 1-based exact integer position in queue
 * @returns {{ waitEstimate: string, waitMinutes: number }}
 */
function getNonOverlappingWaitRange(position) {
  const pos = Math.max(1, Number(position) || 1);
  if (pos === 1) {
    return { waitEstimate: 'You are next (0-5 mins)', waitMinutes: 5 };
  }
  if (pos <= 3) {
    return { waitEstimate: 'Near Turn (5-15 mins)', waitMinutes: 15 };
  }
  if (pos <= 6) {
    return { waitEstimate: '15-30 mins wait', waitMinutes: 30 };
  }
  if (pos <= 10) {
    return { waitEstimate: '30-60 mins wait', waitMinutes: 60 };
  }
  return { waitEstimate: '> 60 mins wait', waitMinutes: 90 };
}

/**
 * Mask private farmer identity strings for public boards & unauthenticated endpoints
 */
function maskFarmerName(name) {
  if (!name || typeof name !== 'string') return 'Farmer';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const s = parts[0];
    if (s.length <= 2) return s;
    return s[0] + '*'.repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  const maskedFirst = first.length <= 2 ? first : first[0] + '*'.repeat(Math.max(1, first.length - 2)) + first[first.length - 1];
  return `${maskedFirst} ${last[0]}.`;
}

function maskPhoneNumber(phone) {
  if (!phone) return '******0000';
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  if (clean.length < 4) return '******0000';
  return '******' + clean.slice(-4);
}

function maskVehiclePlate(plate) {
  if (!plate || typeof plate !== 'string') return 'MH-**-****';
  const clean = plate.trim();
  const parts = clean.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-**-${parts[3]}`;
  }
  if (clean.length > 6) {
    return clean.slice(0, 4) + '**' + clean.slice(-4);
  }
  return 'MH-**-****';
}

/**
 * Helper to check if a booking slot has expired relative to current server time.
 * @param {string} slotDateStr - e.g. "2026-09-13", "13 Sep 2026", "Today"
 * @param {string} slotTimeStr - e.g. "08:00 AM - 10:00 AM", "Morning  08:00 – 11:00 AM", "14:00 - 17:00"
 * @param {number} bufferMinutes - Grace buffer in minutes before slot end (default: 15)
 * @returns {boolean} true if slot is expired / passed
 */
function isSlotExpired(slotDateStr, slotTimeStr, bufferMinutes = 15) {
  if (!slotTimeStr) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Check if slot date is provided and determine if it is today, past, or future
  if (slotDateStr && typeof slotDateStr === 'string' && slotDateStr.toLowerCase() !== 'today') {
    let parsedDate = null;
    const cleanDateStr = slotDateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
      const [y, m, d] = cleanDateStr.split('-').map(Number);
      parsedDate = new Date(y, m - 1, d);
    } else {
      const d = new Date(cleanDateStr);
      if (!isNaN(d.getTime())) {
        parsedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }

    if (parsedDate) {
      const todayStart = new Date(currentYear, currentMonth, currentDate);
      if (parsedDate < todayStart) {
        return true; // Past date is always expired
      }
      if (parsedDate > todayStart) {
        return false; // Future date is never expired
      }
      // If parsedDate == todayStart, continue to slot end-time evaluation
    }
  }

  // Parse slot end time from slotTimeStr
  // Matches: "08:00 AM - 10:00 AM", "Morning  08:00 – 11:00 AM", "Afternoon 02:00 – 05:00 PM", "14:00 - 17:00", etc.
  const timeRegex = /(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i;
  const match = slotTimeStr.match(timeRegex);

  if (match) {
    let endHour = parseInt(match[1], 10);
    const endMinute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && endHour < 12) {
      endHour += 12;
    } else if (ampm === 'AM' && endHour === 12) {
      endHour = 0;
    } else if (!ampm) {
      // 12-hour heuristic if AM/PM is omitted in the second part
      if (endHour <= 6) {
        endHour += 12; // e.g. 2:00 -> 14:00, 5:00 -> 17:00
      }
    }

    const slotEndMinutes = endHour * 60 + endMinute;
    // Slot is expired if current time is within bufferMinutes of the end time or past it
    if (currentMinutes >= (slotEndMinutes - bufferMinutes)) {
      return true;
    }
  }

  return false;
}

// ─── In-Memory Token Store (Fallback when Atlas is offline) ────────────────────
// Key: phone number, Value: { token, bookedAt }
const inMemoryTokenStore = new Map();
const COMPLETED_STATUSES = new Set([
  'Completed', 'COMPLETED', 'Cancelled', 'CANCELLED',
  'completed', 'cancelled'
]);
const IN_MEMORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── In-Memory Farmer Dues Store (Fallback when Atlas is offline) ───────────────
// Key: phone number, Value: { phone, pendingDues, cancellationHistory, name }
const inMemoryFarmerDuesStore = new Map();

function inMemoryGetFarmerDues(phone, name = 'Farmer') {
  if (!inMemoryFarmerDuesStore.has(phone)) {
    inMemoryFarmerDuesStore.set(phone, {
      phone,
      name,
      pendingDues: 0,
      cancellationHistory: []
    });
  }
  return inMemoryFarmerDuesStore.get(phone);
}

function inMemoryAddCancellation(phone, record, name) {
  const profile = inMemoryGetFarmerDues(phone, name);
  profile.pendingDues = Math.max(0, profile.pendingDues + (Number(record.penaltyAmount) || 0));
  profile.cancellationHistory.unshift(record);
  return profile;
}

function inMemoryDeductDues(phone) {
  const profile = inMemoryGetFarmerDues(phone);
  const deducted = profile.pendingDues;
  profile.pendingDues = 0;
  profile.cancellationHistory.forEach((r) => {
    if (r.status === 'DUE') r.status = 'DEDUCTED';
  });
  return deducted;
}

/** Check if in-memory store has an active token for given phone */
function inMemoryFindActiveToken(phone) {
  const entry = inMemoryTokenStore.get(phone);
  if (!entry) return null;
  // Expire stale entries
  if (Date.now() - entry.bookedAt > IN_MEMORY_TTL_MS) {
    inMemoryTokenStore.delete(phone);
    return null;
  }
  // Respect completed or cancelled status updates
  if (COMPLETED_STATUSES.has(entry.token.status)) {
    inMemoryTokenStore.delete(phone);
    return null;
  }
  return entry.token;
}

/** Store a token in-memory for a given phone */
function inMemoryStoreToken(phone, token) {
  inMemoryTokenStore.set(phone, { token, bookedAt: Date.now() });
}

/** Update status of an in-memory token */
function inMemoryUpdateTokenStatus(phone, status) {
  const entry = inMemoryTokenStore.get(phone);
  if (entry) {
    entry.token.status = status;
    if (COMPLETED_STATUSES.has(status)) {
      inMemoryTokenStore.delete(phone);
    }
  }
}

/** Retrieve all active in-memory tokens for a mandi */
function inMemoryGetActiveTokens(mandiId = null) {
  const active = [];
  for (const [, entry] of inMemoryTokenStore.entries()) {
    if (!entry || !entry.token) continue;
    if (COMPLETED_STATUSES.has(entry.token.status)) continue;
    if (mandiId && entry.token.mandiId !== mandiId && entry.token.mandiCode !== mandiId.split('-')[0]) continue;
    active.push(entry.token);
  }
  active.sort((a, b) => (b.isFastTrack ? 1 : 0) - (a.isFastTrack ? 1 : 0) || (b.fastTrackTier || 0) - (a.fastTrackTier || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  active.forEach((t, idx) => {
    t.queuePosition = idx + 1;
  });
  return active;
}

/** Clear all in-memory tokens and reset farmer dues */
function inMemoryResetAll() {
  inMemoryTokenStore.clear();
  inMemoryFarmerDuesStore.clear();
}

/** Reposition the full queue for a Mandi (Fast-track priority first, then FIFO) */
async function repositionMandiQueue(mandiId) {
  if (mongoose.connection.readyState === 1) {
    const activeTokens = await Token.find({
      $or: [{ mandiId }, { mandiCode: mandiId.split('-')[0] }],
      status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
    }).sort({ isFastTrack: -1, fastTrackTier: -1, createdAt: 1 });

    for (let idx = 0; idx < activeTokens.length; idx++) {
      activeTokens[idx].queuePosition = idx + 1;
      await activeTokens[idx].save();
    }
    return activeTokens;
  }

  // In-memory fallback
  return inMemoryGetActiveTokens(mandiId);
}

router.inMemoryResetAll = inMemoryResetAll;
router.inMemoryGetActiveTokens = inMemoryGetActiveTokens;
router.repositionMandiQueue = repositionMandiQueue;


/**
 * Dynamic Time-Decay Cancellation Penalty Calculator
 * Rules:
 * - ΔT > 2 hours: Penalty = ₹0 (Free Cancellation)
 * - 30 mins <= ΔT <= 2 hours: Penalty = ₹50 (Nominal Convenience Fee)
 * - ΔT < 30 mins or after slot start: Penalty = ₹150 (High-Friction / Spam Penalty)
 */
function calculateCancellationPenalty(token, now = new Date()) {
  let slotStart = null;
  const rawDate = token.slotDate;
  const rawTime = token.slotLabel || token.slotTime;

  if (token.scheduledStartTime && !isNaN(new Date(token.scheduledStartTime).getTime())) {
    slotStart = new Date(token.scheduledStartTime);
  } else if (rawDate) {
    try {
      let timeStr = '08:00';
      if (rawTime) {
        const match = rawTime.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          timeStr = `${match[1].padStart(2, '0')}:${match[2]}`;
        }
      }
      const parsed = new Date(`${rawDate} ${timeStr}:00`);
      if (!isNaN(parsed.getTime())) {
        slotStart = parsed;
      }
    } catch (e) {}
  }

  if (!slotStart) {
    const created = token.createdAt ? new Date(token.createdAt) : new Date();
    slotStart = new Date(created.getTime() + 2 * 60 * 60 * 1000);
  }

  const deltaMs = slotStart.getTime() - now.getTime();
  const deltaMins = Math.round(deltaMs / (60 * 1000));
  const deltaHours = deltaMins / 60;

  let penalty = 0;
  let tier = 'FREE';
  let explanation = 'Free cancellation window (> 2 hours before scheduled slot)';

  if (deltaMins > 120) {
    penalty = 0;
    tier = 'FREE';
    explanation = `Free cancellation (Requested ${deltaHours.toFixed(1)}h prior to slot start)`;
  } else if (deltaMins >= 30 && deltaMins <= 120) {
    penalty = 50;
    tier = 'NOMINAL_FEE';
    explanation = `Nominal convenience fee (Requested ${deltaMins} mins prior to slot start)`;
  } else {
    penalty = 150;
    tier = 'SPAM_PENALTY';
    explanation = deltaMins < 0
      ? `Late cancellation / missed slot (${Math.abs(deltaMins)} mins past scheduled start)`
      : `High-friction penalty (Requested within 30 mins of scheduled slot)`;
  }

  return {
    penalty,
    deltaMins,
    tier,
    explanation,
    slotStart: slotStart.toISOString()
  };
}

/** Get all active in-memory tokens (for AgriPool proximity search) */
function inMemoryGetActiveTokens() {
  const results = [];
  for (const [phone, entry] of inMemoryTokenStore.entries()) {
    if (Date.now() - entry.bookedAt <= IN_MEMORY_TTL_MS && !COMPLETED_STATUSES.has(entry.token.status)) {
      results.push(entry.token);
    } else {
      inMemoryTokenStore.delete(phone);
    }
  }
  return results;
}

// Default 5-stage procurement checkpoints definitions
const DEFAULT_STAGES = [
  {
    stageIndex: 0,
    id: 'GATE_CHECKIN',
    title: 'Gate Check-in & QR Scan',
    label: 'Gate Check-in & QR Scan',
    shortLabel: 'Gate Check-in',
    officerName: 'Security Desk #1',
    officer: 'Security Desk #1',
    officerRole: 'Security Officer',
    officerCode: 'SEC-D1-KPG',
    icon: 'gate',
    status: 'pending',
    timestamp: null,
    completedAt: null,
    officerSigId: null,
    details: {}
  },
  {
    stageIndex: 1,
    id: 'QUALITY_GRADING',
    title: 'Physical Assaying & Quality Grading',
    label: 'Physical Assaying & Quality Grading',
    shortLabel: 'Quality Grading',
    officerName: 'S. Patil, Quality Assayer',
    officer: 'S. Patil, Quality Assayer',
    officerRole: 'Quality Assayer',
    officerCode: 'QA-SP-KPG',
    icon: 'leaf',
    status: 'pending',
    timestamp: null,
    completedAt: null,
    officerSigId: null,
    details: {}
  },
  {
    stageIndex: 2,
    id: 'WEIGHBRIDGE',
    title: 'Digital Weighbridge #2',
    label: 'Digital Weighbridge #2',
    shortLabel: 'Weighbridge',
    officerName: 'Weighment In-Charge',
    officer: 'Weighment In-Charge',
    officerRole: 'Weighmaster',
    officerCode: 'WM-02-KPG',
    icon: 'scale',
    status: 'pending',
    timestamp: null,
    completedAt: null,
    officerSigId: null,
    details: {}
  },
  {
    stageIndex: 3,
    id: 'PROCUREMENT',
    title: 'Procurement & Price Confirmation',
    label: 'Procurement & Price Confirmation',
    shortLabel: 'Procurement',
    officerName: 'APMC Secretary Desk',
    officer: 'APMC Secretary Desk',
    officerRole: 'Procurement Officer',
    officerCode: 'SEC-APMC-KPG',
    icon: 'document',
    status: 'pending',
    timestamp: null,
    completedAt: null,
    officerSigId: null,
    details: {}
  },
  {
    stageIndex: 4,
    id: 'PAYOUT',
    title: 'Final Accounts Payout / Digital E-Receipt',
    label: 'Final Accounts Payout / Digital E-Receipt',
    shortLabel: 'E-Receipt & Payout',
    officerName: 'Treasury / Direct Bank Transfer',
    officer: 'Treasury / Direct Bank Transfer',
    officerRole: 'Finance & Accounts',
    officerCode: 'TRY-DBT-KPG',
    icon: 'bank',
    status: 'pending',
    timestamp: null,
    completedAt: null,
    officerSigId: null,
    details: {}
  }
];

/** Helper: Generate unique token number */
function generateTokenNumber(mandiCode = 'KPG') {
  const prefix = mandiCode.toUpperCase();
  const year = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 8999));
  return `KQ-${prefix}-${year}-${rand}`;
}

/**
 * @route   GET /api/tokens/health
 * @desc    Health check for tokens API & MongoDB database status
 * @access  Public
 */
router.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  return res.status(200).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    mode: isDbConnected ? 'operational' : 'graceful degraded mode (dev-only in-memory fallback)',
    cluster: isDbConnected ? (mongoose.connection.host || 'MongoDB Atlas') : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/tokens/all
 * @desc    Fetch all tokens in the system (for Admin Dashboard / Multi-crop Kanban)
 * @access  Public
 */
router.get('/all', async (req, res) => {
  try {
    const { crop, mandiId, status, limit = 100 } = req.query;
    const filter = {};
    if (crop) filter.crop = crop;
    if (mandiId) {
      filter.$or = [
        { mandiId },
        { mandiCode: mandiId.split('-')[0] }
      ];
    }
    if (status) filter.status = status;

    if (mongoose.connection.readyState === 1) {
      const tokens = await Token.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit));

      return res.status(200).json({
        success: true,
        count: tokens.length,
        tokens
      });
    }

    // In-memory fallback
    const allMem = [];
    for (const [, entry] of inMemoryTokenStore.entries()) {
      if (!entry || !entry.token) continue;
      const t = entry.token;
      if (mandiId && t.mandiId !== mandiId && t.mandiCode !== mandiId.split('-')[0]) continue;
      if (crop && t.crop !== crop) continue;
      if (status && normalizeStatus(t.status) !== normalizeStatus(status)) continue;
      allMem.push(t);
    }
    allMem.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      count: allMem.length,
      tokens: allMem.slice(0, Number(limit))
    });
  } catch (error) {
    logger.error(`[Tokens] Error fetching all tokens: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tokens/mandi/:mandiId
 * @desc    Fetch all active and actionable tokens for a specific Mandi (Booked, In-Progress, Gate-Exit-Requested)
 * @access  Public
 */
router.get('/mandi/:mandiId', async (req, res) => {
  try {
    const { mandiId } = req.params;

    if (mongoose.connection.readyState === 1) {
      const tokens = await Token.find({
        $or: [
          { mandiId },
          { mandiCode: mandiId.split('-')[0] }
        ]
      }).sort({ isFastTrack: -1, createdAt: 1 });

      let activePos = 1;
      const enrichedTokens = tokens.map((tok) => {
        const obj = tok.toObject();
        const norm = normalizeStatus(obj.status);
        let queuePos = null;
        let waitInfo = null;

        if (norm !== TOKEN_STATUS.COMPLETED && norm !== TOKEN_STATUS.CANCELLED) {
          queuePos = activePos++;
          waitInfo = getNonOverlappingWaitRange(queuePos);
        }

        // Return sanitized public tracking representation
        return {
          id: obj.id || obj._id,
          tokenNumber: obj.tokenNumber,
          mandiId: obj.mandiId,
          mandiName: obj.mandiName,
          mandiCode: obj.mandiCode,
          crop: obj.crop,
          quantity: obj.quantity,
          quantityBand: obj.quantityBand,
          slotDate: obj.slotDate,
          slotTime: obj.slotTime,
          slotLabel: obj.slotLabel,
          status: obj.status,
          currentStageIndex: obj.currentStageIndex,
          isFastTrack: obj.isFastTrack || false,
          queuePosition: queuePos || obj.queuePosition || 1,
          waitEstimate: waitInfo?.waitEstimate || '0-5 mins',
          waitMinutes: waitInfo?.waitMinutes || 5,
          farmerName: maskFarmerName(obj.farmerName),
          farmerPhone: maskPhoneNumber(obj.farmerPhone || obj.phone),
          phone: maskPhoneNumber(obj.phone || obj.farmerPhone),
          vehicleNumber: maskVehiclePlate(obj.vehicleNumber),
          vehicleType: obj.vehicleType || 'Tractor',
          createdAt: obj.createdAt,
          updatedAt: obj.updatedAt
        };
      });

      return res.status(200).json({
        success: true,
        count: enrichedTokens.length,
        tokens: enrichedTokens
      });
    }

    // In-memory fallback
    const memTokens = [];
    for (const [, entry] of inMemoryTokenStore.entries()) {
      if (!entry || !entry.token) continue;
      const t = entry.token;
      if (mandiId && t.mandiId !== mandiId && t.mandiCode !== mandiId.split('-')[0]) continue;
      memTokens.push(t);
    }
    memTokens.sort((a, b) => (b.isFastTrack ? 1 : 0) - (a.isFastTrack ? 1 : 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    let activePos = 1;
    const sanitizedMemTokens = memTokens.map((t) => {
      const norm = normalizeStatus(t.status);
      let queuePos = null;
      let waitInfo = null;

      if (norm !== TOKEN_STATUS.COMPLETED && norm !== TOKEN_STATUS.CANCELLED) {
        queuePos = activePos++;
        waitInfo = getNonOverlappingWaitRange(queuePos);
      }

      return {
        id: t.id || t._id,
        tokenNumber: t.tokenNumber,
        mandiId: t.mandiId,
        mandiName: t.mandiName,
        mandiCode: t.mandiCode,
        crop: t.crop,
        quantity: t.quantity,
        quantityBand: t.quantityBand,
        slotDate: t.slotDate,
        slotTime: t.slotTime,
        slotLabel: t.slotLabel,
        status: t.status,
        currentStageIndex: t.currentStageIndex,
        isFastTrack: t.isFastTrack || false,
        queuePosition: queuePos || t.queuePosition || 1,
        waitEstimate: waitInfo?.waitEstimate || '0-5 mins',
        waitMinutes: waitInfo?.waitMinutes || 5,
        farmerName: maskFarmerName(t.farmerName),
        farmerPhone: maskPhoneNumber(t.farmerPhone || t.phone),
        phone: maskPhoneNumber(t.phone || t.farmerPhone),
        vehicleNumber: maskVehiclePlate(t.vehicleNumber),
        vehicleType: t.vehicleType || 'Tractor',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      count: sanitizedMemTokens.length,
      tokens: sanitizedMemTokens
    });
  } catch (error) {
    logger.error(`[Tokens] Error fetching mandi tokens: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mandi tokens',
      error: error.message
    });
  }
});


/**
 * Shared core token reservation & booking creation function.
 * Used identically by manual web form, manual mobile form, and voice booking flow.
 */
async function createTokenReservation(params) {
  const {
    tokenNumber,
    id,
    farmerName,
    farmerPhone,
    phone,
    farmerId,
    mandiId,
    mandiName,
    mandiCode,
    crop,
    quantity,
    quantityBand,
    slotDate,
    slotTime,
    slotLabel,
    queuePosition,
    latitude,
    longitude,
    stages,
    channel = 'app',
    io = null,
    authUser = null,
    isInternalAdmin = false
  } = params;

  const assignedTokenNumber = tokenNumber || id || generateTokenNumber(mandiCode || (mandiId ? mandiId.split('-')[0] : 'KPG'));
  const assignedPhone = farmerPhone || phone || '9876543210';
  const assignedFarmerName = farmerName || 'Mahesh Borde';
  const parsedQuantity = Number(quantity) || 10;
  const assignedMandiId = mandiId || 'KPG-01';
  const parsedLat = Number(latitude) || 19.8928;
  const parsedLng = Number(longitude) || 74.4820;

  // 1. Auth check
  if (!authUser && !isInternalAdmin) {
    let isKnownFarmer = false;
    if (mongoose.connection.readyState === 1) {
      const f = await Farmer.findOne({ phone: assignedPhone });
      if (f) isKnownFarmer = true;
    }
    if (!isKnownFarmer && (assignedPhone.length === 10 || assignedPhone.startsWith('980000000'))) {
      isKnownFarmer = true;
    }
    if (!isKnownFarmer) {
      const err = new Error('Access denied. Valid citizen farmer or staff authentication session required to book tokens.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  }

  // 2. Pickup location check
  let farmerDoc = null;
  if (mongoose.connection.readyState === 1) {
    farmerDoc = await Farmer.findOne({ phone: assignedPhone });
  }
  if (!farmerDoc && authService.inMemoryFarmers && authService.inMemoryFarmers.has(assignedPhone)) {
    farmerDoc = authService.inMemoryFarmers.get(assignedPhone);
  }

  let effectiveLat = parsedLat;
  let effectiveLng = parsedLng;
  if (farmerDoc && farmerDoc.pickupLocation && Array.isArray(farmerDoc.pickupLocation.coordinates) && farmerDoc.pickupLocation.coordinates.length === 2) {
    const flng = Number(farmerDoc.pickupLocation.coordinates[0]);
    const flat = Number(farmerDoc.pickupLocation.coordinates[1]);
    if (!isNaN(flat)) effectiveLat = flat;
    if (!isNaN(flng)) effectiveLng = flng;
  }

  // 3. Slot expiry check
  const effectiveSlotTime = slotTime || slotLabel;
  if (effectiveSlotTime && isSlotExpired(slotDate, effectiveSlotTime, 15)) {
    const err = new Error('The selected arrival time slot has already passed for today. Please select a future time slot or book for tomorrow.');
    err.status = 400;
    err.code = 'SLOT_EXPIRED';
    throw err;
  }

  // 4. Single-Active-Token Constraint
  if (mongoose.connection.readyState === 1) {
    const activeToken = await Token.findOne({
      $or: [{ farmerPhone: assignedPhone }, { phone: assignedPhone }],
      status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
    });

    if (activeToken) {
      const err = new Error(`You already have an active booking (Token #${activeToken.tokenNumber || activeToken.id}). Complete delivery before reserving a new slot.`);
      err.status = 409;
      err.code = 'ACTIVE_TOKEN_EXISTS';
      err.activeToken = {
        id: activeToken.id || activeToken.tokenNumber,
        tokenNumber: activeToken.tokenNumber || activeToken.id,
        mandiName: activeToken.mandiName,
        crop: activeToken.crop,
        quantity: activeToken.quantity,
        status: activeToken.status,
        slotDate: activeToken.slotDate,
        slotTime: activeToken.slotTime || activeToken.slotLabel
      };
      throw err;
    }
  } else {
    const memActiveToken = inMemoryFindActiveToken(assignedPhone);
    if (memActiveToken) {
      const err = new Error(`You already have an active booking (Token #${memActiveToken.tokenNumber || memActiveToken.id}). Complete delivery before reserving a new slot.`);
      err.status = 409;
      err.code = 'ACTIVE_TOKEN_EXISTS';
      err.activeToken = {
        id: memActiveToken.id || memActiveToken.tokenNumber,
        tokenNumber: memActiveToken.tokenNumber || memActiveToken.id,
        mandiName: memActiveToken.mandiName,
        crop: memActiveToken.crop,
        quantity: memActiveToken.quantity,
        status: memActiveToken.status,
        slotDate: memActiveToken.slotDate,
        slotTime: memActiveToken.slotTime || memActiveToken.slotLabel
      };
      throw err;
    }
  }

  // 5. Build 5-Stage Checkpoints
  let tokenStages = Array.isArray(stages) && stages.length > 0 ? stages : DEFAULT_STAGES;
  tokenStages = tokenStages.map((stg, idx) => ({
    stageIndex: stg.stageIndex !== undefined ? stg.stageIndex : idx,
    id: stg.id || DEFAULT_STAGES[idx]?.id || `STAGE_${idx}`,
    title: stg.title || stg.label || DEFAULT_STAGES[idx]?.title,
    label: stg.label || stg.title || DEFAULT_STAGES[idx]?.label,
    shortLabel: stg.shortLabel || DEFAULT_STAGES[idx]?.shortLabel,
    officerName: stg.officerName || stg.officer || DEFAULT_STAGES[idx]?.officerName,
    officer: stg.officer || stg.officerName || DEFAULT_STAGES[idx]?.officer,
    officerRole: stg.officerRole || stg.officerCode || DEFAULT_STAGES[idx]?.officerRole,
    officerCode: stg.officerCode || DEFAULT_STAGES[idx]?.officerCode,
    icon: stg.icon || DEFAULT_STAGES[idx]?.icon,
    status: stg.status || 'pending',
    timestamp: stg.timestamp || stg.completedAt || null,
    completedAt: stg.completedAt || stg.timestamp || null,
    officerSigId: stg.officerSigId || null,
    details: stg.details || {},
    grade: stg.grade || null,
    weight: stg.weight || null
  }));

  let savedToken = null;

  // 6. Persist to MongoDB or in-memory
  if (mongoose.connection.readyState === 1) {
    let existing = await Token.findOne({
      $or: [{ tokenNumber: assignedTokenNumber }, { id: assignedTokenNumber }]
    });

    if (existing) {
      const err = new Error(`Token with number ${assignedTokenNumber} already exists.`);
      err.status = 409;
      err.code = 'DUPLICATE_TOKEN';
      err.token = existing;
      throw err;
    }

    let activeQueueCount = await Token.countDocuments({
      mandiId: assignedMandiId,
      status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
    });
    const calculatedQueuePos = (queuePosition !== undefined && queuePosition !== null)
      ? Number(queuePosition)
      : (activeQueueCount + 1);

    const assignedFarmerId = authUser ? (authUser.id || authUser._id || authUser.farmerId) : (farmerId || undefined);

    const newToken = new Token({
      tokenNumber: assignedTokenNumber,
      id: assignedTokenNumber,
      farmerName: assignedFarmerName,
      farmerPhone: assignedPhone,
      farmerId: assignedFarmerId,
      phone: assignedPhone,
      mandiId: assignedMandiId,
      mandiName: mandiName || 'APMC Kopargaon',
      mandiCode: mandiCode || (assignedMandiId ? assignedMandiId.split('-')[0] : 'KPG'),
      crop: crop || 'Wheat',
      quantity: parsedQuantity,
      quantityBand: quantityBand || `${parsedQuantity} Quintals`,
      slotDate: slotDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      slotTime: slotTime || slotLabel || '08:00 – 11:00 AM',
      slotLabel: slotLabel || slotTime || '08:00 – 11:00 AM',
      status: 'Booked',
      currentStageIndex: 0,
      queuePosition: calculatedQueuePos,
      stages: tokenStages,
      latitude: effectiveLat,
      longitude: effectiveLng,
      channel,
      location: {
        type: 'Point',
        coordinates: [effectiveLng, effectiveLat]
      },
      createdAt: new Date()
    });

    savedToken = await newToken.save();
    logger.info(`[Tokens] New token booked and persisted to MongoDB: ${savedToken.tokenNumber} (Queue Pos: ${calculatedQueuePos})`);
  } else {
    let activeQueueCount = inMemoryGetActiveTokens(assignedMandiId).length;
    const calculatedQueuePos = (queuePosition !== undefined && queuePosition !== null)
      ? Number(queuePosition)
      : (activeQueueCount + 1);

    savedToken = {
      tokenNumber: assignedTokenNumber,
      id: assignedTokenNumber,
      farmerName: assignedFarmerName,
      farmerPhone: assignedPhone,
      farmerId: authUser ? (authUser.id || authUser._id || authUser.farmerId) : (farmerId || undefined),
      phone: assignedPhone,
      mandiId: assignedMandiId,
      mandiName: mandiName || 'APMC Kopargaon',
      mandiCode: mandiCode || (assignedMandiId ? assignedMandiId.split('-')[0] : 'KPG'),
      crop: crop || 'Wheat',
      quantity: parsedQuantity,
      quantityBand: quantityBand || `${parsedQuantity} Quintals`,
      slotDate: slotDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      slotTime: slotTime || slotLabel || '08:00 – 11:00 AM',
      slotLabel: slotLabel || slotTime || '08:00 – 11:00 AM',
      status: 'Booked',
      currentStageIndex: 0,
      queuePosition: calculatedQueuePos,
      stages: tokenStages,
      latitude: effectiveLat,
      longitude: effectiveLng,
      channel,
      location: {
        type: 'Point',
        coordinates: [effectiveLng, effectiveLat]
      },
      createdAt: new Date()
    };
    inMemoryStoreToken(assignedPhone, savedToken);
    logger.info(`[Tokens] New token stored in-memory (Atlas offline): ${savedToken.tokenNumber}`);
  }

  // 7. 500m AgriPool Proximity Engine
  let agriPoolMatch = null;
  try {
    const candidateTokens = mongoose.connection.readyState === 1
      ? await Token.find({
          _id: { $ne: savedToken._id },
          $or: [{ mandiId: assignedMandiId }, { mandiCode: mandiCode || 'KPG' }],
          slotDate: savedToken.slotDate,
          farmerPhone: { $ne: assignedPhone },
          status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
        })
      : inMemoryGetActiveTokens(assignedMandiId).filter((p) => (p.farmerPhone || p.phone) !== assignedPhone && p.slotDate === savedToken.slotDate);

    for (const peer of candidateTokens) {
      const peerLat = peer.latitude || 19.8928;
      const peerLng = peer.longitude || 74.4820;
      const distMeters = calculateHaversineDistanceMeters(effectiveLat, effectiveLng, peerLat, peerLng);

      if (distMeters <= 500) {
        const roundedDist = Math.max(25, Math.round(distMeters));
        const mandiLabel = savedToken.mandiName?.replace('APMC ', '') || 'Kopargaon';
        agriPoolMatch = {
          type: 'AGRIPOOL_OPPORTUNITY',
          title: '🤝 AgriPool Alert',
          message: `🤝 AgriPool Alert: Another farmer within 500m is heading to APMC ${mandiLabel} today. Connect to share transport!`,
          mandiName: savedToken.mandiName,
          mandiId: assignedMandiId,
          slotDate: savedToken.slotDate,
          distanceMeters: roundedDist,
          farmer1: { name: savedToken.farmerName, phone: assignedPhone, tokenNumber: savedToken.tokenNumber, crop: savedToken.crop, quantity: savedToken.quantity, latitude: effectiveLat, longitude: effectiveLng },
          farmer2: { name: peer.farmerName, phone: peer.farmerPhone || peer.phone, tokenNumber: peer.tokenNumber, crop: peer.crop, quantity: peer.quantity, latitude: peerLat, longitude: peerLng },
          estimatedSavings: '₹750 – ₹1,200 on shared freight'
        };
        break;
      }
    }
  } catch (poolErr) {
    logger.warn(`[AgriPool] Proximity calculation notice: ${poolErr.message}`);
  }

  // 8. WebSocket Broadcast & Unified Notification Dispatch
  if (io) {
    broadcastNewBooking(io, assignedMandiId, savedToken);
    if (agriPoolMatch) {
      broadcastAgriPoolMatch(io, agriPoolMatch);
    }
  }

  // Unified Notification Dispatch
  try {
    const farmerIdStr = (savedToken.farmerId || savedToken.phone || assignedPhone).toString();
    notificationService.notify(
      { id: farmerIdStr, type: 'farmer', phone: assignedPhone },
      'booking_confirmed',
      {
        tokenNumber: savedToken.tokenNumber,
        crop: savedToken.crop,
        quantity: savedToken.quantity,
        mandiName: savedToken.mandiName,
        slotTime: savedToken.slotTime,
        slotDate: savedToken.slotDate
      },
      { io, dedupeKey: `${farmerIdStr}_booking_confirmed_${savedToken.tokenNumber}` }
    ).catch((err) => logger.warn(`[Tokens] Notification dispatch notice: ${err.message}`));
  } catch (notifErr) {
    logger.warn(`[Tokens] Notification notice: ${notifErr.message}`);
  }

  return { savedToken, agriPoolMatch };
}

/**
 * @route   POST /api/tokens/book
 * @desc    Create and persist a new token in MongoDB Atlas & broadcast event
 * @access  Public
 */
router.post('/book', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.split(' ')[1];
      try {
        const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
        authUser = jwt.verify(rawToken, secret);
      } catch (e) {}
    }

    const { savedToken, agriPoolMatch } = await createTokenReservation({
      ...req.body,
      io: req.io,
      authUser,
      isInternalAdmin: Boolean(req.headers['x-internal-admin'])
    });

    const isAtlasMode = mongoose.connection.readyState === 1;
    return res.status(201).json({
      success: true,
      message: isAtlasMode ? 'Token booked successfully and saved to MongoDB Atlas' : 'Token booked successfully (in-memory fallback — Atlas IP whitelist may be required)',
      token: savedToken,
      agriPoolMatch
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.code || 'BOOKING_ERROR',
        code: error.code || 'BOOKING_ERROR',
        message: error.message,
        activeToken: error.activeToken,
        token: error.token
      });
    }
    logger.error(`[Tokens] Error booking token: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to book token',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tokens/my-tokens
 * @desc    Fetch active and owned tokens for the authenticated citizen farmer using verified JWT
 * @access  Private (Requires valid JWT session)
 */
router.get('/my-tokens', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Access denied. Valid authorization token required to fetch citizen tokens.'
      });
    }

    const rawToken = authHeader.split(' ')[1];
    let decoded = null;
    try {
      const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
      decoded = jwt.verify(rawToken, secret);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Access denied. Invalid or expired authorization session.'
      });
    }

    const farmerPhone = (decoded.phone || decoded.mobileNumber || decoded.mobile || '').toString().trim();
    const farmerId = decoded.id || decoded._id || decoded.farmerId;

    if (!farmerPhone && !farmerId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid session claims: No citizen farmer identity found.'
      });
    }

    const activeStatuses = [
      'Booked', 'In-Progress', 'Gate-Exit-Requested',
      'BOOKED', 'GATE_IN', 'INSPECTED', 'WEIGHED', 'PROCUREMENT', 'GATE_EXIT_REQUESTED'
    ];

    if (mongoose.connection.readyState === 1) {
      // 1. Build strict identity query filter
      const orConditions = [];
      if (farmerPhone) {
        orConditions.push({ farmerPhone: farmerPhone }, { phone: farmerPhone });
      }
      if (farmerId) {
        if (mongoose.Types.ObjectId.isValid(farmerId)) {
          orConditions.push({ farmerId: farmerId });
        }
        orConditions.push({ farmerId: farmerId.toString() });
      }

      // 2. Fetch all tokens for this specific farmer only
      const allFarmerTokens = await Token.find({ $or: orConditions }).sort({ createdAt: -1 });

      // 3. Clean up legacy test data / deduplicate multiple active tokens (Sanity enforcement)
      const activeTokens = allFarmerTokens.filter((t) => activeStatuses.includes(t.status));
      if (activeTokens.length > 1) {
        // Keep only the newest active token (index 0), mark older ones as Cancelled
        const duplicateActive = activeTokens.slice(1);
        for (const dup of duplicateActive) {
          dup.status = 'Cancelled';
          dup.cancellationReason = 'Purged duplicate active token (Strict Single-Active-Token Constraint)';
          dup.cancelledAt = new Date();
          await dup.save();
          logger.info(`[Sanity Cleanup] Auto-cancelled legacy duplicate active token ${dup.tokenNumber} for farmer ${farmerPhone || farmerId}`);
        }
      }

      // 4. Return strictly the authenticated farmer's clean tokens
      const cleanTokens = await Token.find({ $or: orConditions }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: cleanTokens.length,
        tokens: cleanTokens
      });
    }

    // In-memory fallback (when Atlas offline)
    const memTokens = [];
    if (farmerPhone) {
      const activeMem = inMemoryFindActiveToken(farmerPhone);
      if (activeMem) {
        memTokens.push(activeMem);
      }
    }

    return res.status(200).json({
      success: true,
      count: memTokens.length,
      tokens: memTokens
    });
  } catch (error) {
    logger.error(`[Tokens] Error fetching my-tokens: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens for authenticated farmer',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tokens/farmer/:phone
 * @desc    Fetch all tokens for the authenticated farmer (phone from JWT).
 *          Staff of the same centre may also read (role !== 'farmer').
 *          Farmer A cannot read Farmer B's tokens.
 * @access  Private (farmer JWT or staff JWT of same centre)
 */
router.get('/farmer/:phone', authenticate, async (req, res) => {
  try {
    const { phone } = req.params;
    const callerPhone = req.user.phone;
    const callerRole = req.user.role;

    // Enforce: farmer may only read their own data
    const isFarmer = !callerRole || callerRole === 'farmer';
    if (isFarmer && callerPhone !== phone) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: you can only view your own tokens.'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const tokens = await Token.find({
        $or: [
          { farmerPhone: phone },
          { phone: phone }
        ]
      }).sort({ createdAt: -1 });

      // Clean up legacy duplicates if any
      const activeStatuses = [
        'Booked', 'In-Progress', 'Gate-Exit-Requested',
        'BOOKED', 'GATE_IN', 'INSPECTED', 'WEIGHED', 'PROCUREMENT', 'GATE_EXIT_REQUESTED'
      ];
      const active = tokens.filter((t) => activeStatuses.includes(t.status));
      if (active.length > 1) {
        const staleActive = active.slice(1);
        for (const stale of staleActive) {
          stale.status = 'Cancelled';
          stale.cancellationReason = 'Purged duplicate active token (Strict Single-Active-Token Constraint)';
          stale.cancelledAt = new Date();
          await stale.save();
        }
      }

      const refreshed = await Token.find({
        $or: [
          { farmerPhone: phone },
          { phone: phone }
        ]
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: refreshed.length,
        tokens: refreshed
      });
    }

    // In-memory fallback
    const memTokens = [];
    const activeMem = inMemoryFindActiveToken(phone);
    if (activeMem) {
      memTokens.push(activeMem);
    }

    return res.status(200).json({
      success: true,
      count: memTokens.length,
      tokens: memTokens,
      note: 'Database offline, returned active in-memory session'
    });
  } catch (error) {
    logger.error(`[Tokens] Error fetching farmer tokens: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens for farmer',
      error: error.message
    });
  }
});


/**
 * @route   GET /api/tokens/:tokenNumber
 * @desc    Fetch full details and checkpoint status for a specific token
 * @access  Public
 */
router.get('/:tokenNumber', async (req, res) => {
  try {
    const { tokenNumber } = req.params;

    // Optional auth check to determine owner vs staff vs public stranger
    const authHeader = req.headers.authorization;
    let authUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const rawToken = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
        authUser = jwt.verify(rawToken, secret);
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      const token = await Token.findOne({
        $or: [
          { tokenNumber: tokenNumber },
          { id: tokenNumber }
        ]
      });

      if (!token) {
        return res.status(404).json({
          success: false,
          message: `Token '${tokenNumber}' not found`
        });
      }

      const isOwner = authUser && (
        (authUser.id && token.farmerId && authUser.id.toString() === token.farmerId.toString()) ||
        (authUser.phone && token.phone && authUser.phone === token.phone) ||
        (authUser.phone && token.farmerPhone && authUser.phone === token.farmerPhone)
      );
      const isStaff = authUser && (
        ['security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'operator', 'staff', 'supervisor', 'district_admin', 'auditor', 'resource_officer'].includes(authUser.role)
      );

      const waitInfo = getNonOverlappingWaitRange(token.queuePosition || 1);

      if (isOwner || isStaff) {
        const tokObj = token.toObject();
        tokObj.waitEstimate = waitInfo.waitEstimate;
        tokObj.waitMinutes = waitInfo.waitMinutes;
        return res.status(200).json({
          success: true,
          token: tokObj
        });
      }

      // Non-owner / unauthenticated: return sanitized minimal tracking view
      return res.status(200).json({
        success: true,
        token: {
          id: token.id || token._id,
          tokenNumber: token.tokenNumber,
          mandiId: token.mandiId,
          mandiName: token.mandiName,
          crop: token.crop,
          quantity: token.quantity,
          quantityBand: token.quantityBand,
          slotDate: token.slotDate,
          slotTime: token.slotTime,
          slotLabel: token.slotLabel,
          status: token.status,
          currentStageIndex: token.currentStageIndex,
          isFastTrack: token.isFastTrack || false,
          queuePosition: token.queuePosition || 1,
          waitEstimate: waitInfo.waitEstimate,
          waitMinutes: waitInfo.waitMinutes,
          farmerName: maskFarmerName(token.farmerName),
          farmerPhone: maskPhoneNumber(token.farmerPhone || token.phone),
          phone: maskPhoneNumber(token.phone || token.farmerPhone),
          vehicleNumber: maskVehiclePlate(token.vehicleNumber),
          stages: (token.stages || []).map((s) => ({
            stageIndex: s.stageIndex,
            id: s.id,
            title: s.title,
            status: s.status,
            timestamp: s.timestamp,
            completedAt: s.completedAt
          })),
          createdAt: token.createdAt,
          updatedAt: token.updatedAt
        }
      });
    }

    // In-memory fallback
    let memToken = null;
    for (const [, entry] of inMemoryTokenStore.entries()) {
      if (entry?.token && (entry.token.tokenNumber === tokenNumber || entry.token.id === tokenNumber)) {
        memToken = entry.token;
        break;
      }
    }

    if (memToken) {
      const waitInfo = getNonOverlappingWaitRange(memToken.queuePosition || 1);
      const isOwner = authUser && (
        (authUser.phone && memToken.phone && authUser.phone === memToken.phone) ||
        (authUser.phone && memToken.farmerPhone && authUser.phone === memToken.farmerPhone)
      );
      const isStaff = authUser && (
        ['security_gate', 'quality_assayer', 'weighmaster', 'procurement', 'accounts_settlement', 'operator', 'staff', 'supervisor', 'district_admin', 'auditor', 'resource_officer'].includes(authUser.role)
      );

      if (isOwner || isStaff) {
        return res.status(200).json({
          success: true,
          token: { ...memToken, waitEstimate: waitInfo.waitEstimate }
        });
      }

      return res.status(200).json({
        success: true,
        token: {
          id: memToken.id || memToken._id,
          tokenNumber: memToken.tokenNumber,
          mandiId: memToken.mandiId,
          mandiName: memToken.mandiName,
          crop: memToken.crop,
          quantity: memToken.quantity,
          slotDate: memToken.slotDate,
          slotTime: memToken.slotTime,
          status: memToken.status,
          currentStageIndex: memToken.currentStageIndex,
          queuePosition: memToken.queuePosition || 1,
          waitEstimate: waitInfo.waitEstimate,
          farmerName: maskFarmerName(memToken.farmerName),
          farmerPhone: maskPhoneNumber(memToken.farmerPhone || memToken.phone),
          vehicleNumber: maskVehiclePlate(memToken.vehicleNumber),
          createdAt: memToken.createdAt
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: `Token '${tokenNumber}' not found`
    });
  } catch (error) {
    logger.error(`[Tokens] Error fetching token details: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch token details',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/tokens/:tokenNumber/stage-progress
 * @desc    Updates currentStageIndex, marks target checkpoint as 'Completed', appends timestamp & officer sig
 * @access  Public
 */
router.patch('/:tokenNumber/stage-progress', async (req, res) => {
  try {
    const { tokenNumber } = req.params;
    const {
      stageId,
      stageIndex,
      officerSigId,
      officerName,
      status = 'Completed',
      details = {},
      grade,
      weight,
      grossWeight,
      tareWeight,
      netWeight,
      moisture,
      foreignMatter,
      poNumber,
      totalAmount,
      paymentRef
    } = req.body;

    let updatedToken = null;
    let targetStageTitle = 'Checkpoint';
    let assignedOfficer = officerName || 'Officer';

    const mergedDetails = {
      ...details,
      ...(grossWeight !== undefined && { grossWeight }),
      ...(tareWeight !== undefined && { tareWeight }),
      ...(netWeight !== undefined && { netWeight }),
      ...(moisture !== undefined && { moisture }),
      ...(foreignMatter !== undefined && { foreignMatter }),
      ...(poNumber !== undefined && { poNumber }),
      ...(totalAmount !== undefined && { totalAmount }),
      ...(paymentRef !== undefined && { paymentRef }),
    };

    // ─── RBAC ENFORCEMENT: VERIFY DESK ROLE CLAIMS ───────────────────────────
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
        const decoded = jwt.verify(authHeader.split(' ')[1], secret);
        req.user = decoded;

        const stageIdxNumber = Number(stageIndex !== undefined ? stageIndex : (
          stageId === 'GATE_CHECKIN' ? 0 :
          stageId === 'QUALITY_GRADING' ? 1 :
          stageId === 'WEIGHBRIDGE' ? 2 :
          stageId === 'PROCUREMENT' ? 3 :
          stageId === 'PAYOUT' ? 4 : -1
        ));

        const deskRoleMapping = {
          0: ['security_gate', 'operator', 'staff', 'supervisor', 'district_admin'],
          1: ['quality_assayer', 'operator', 'staff', 'supervisor', 'district_admin'],
          2: ['weighmaster', 'operator', 'staff', 'supervisor', 'district_admin'],
          3: ['procurement', 'operator', 'staff', 'supervisor', 'district_admin'],
          4: ['accounts_settlement', 'operator', 'staff', 'supervisor', 'district_admin']
        };

        if (stageIdxNumber >= 0 && deskRoleMapping[stageIdxNumber]) {
          const allowedRoles = deskRoleMapping[stageIdxNumber];
          if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).json({
              success: false,
              error: 'ROLE_UNAUTHORIZED',
              message: `Access forbidden: Officer role '${decoded.role}' cannot sign off Desk ${stageIdxNumber + 1}. Required roles: [${allowedRoles.join(', ')}]`
            });
          }
        }
      } catch (err) {
        // Continue if legacy token
      }
    }


// ─── STRICT SEQUENTIAL PIPELINE CONTINUITY VALIDATOR ────────────────────────
function validateSequentialPipeline(token, incomingStageIdx) {
  const stages = Array.isArray(token.stages) ? token.stages : [];

  if (incomingStageIdx === 1) {
    const stage0 = stages.find(s => s.stageIndex === 0 || s.id === 'GATE_CHECKIN');
    const isStage0Done = (stage0?.status || '').toLowerCase() === 'completed';
    if (!isStage0Done) {
      return {
        valid: false,
        error: 'PIPELINE_VIOLATION',
        message: 'PIPELINE_VIOLATION: Gate entry must be completed before quality assaying.'
      };
    }
  } else if (incomingStageIdx === 2) {
    const stage1 = stages.find(s => s.stageIndex === 1 || s.id === 'QUALITY_GRADING');
    const isStage1Done = (stage1?.status || '').toLowerCase() === 'completed';
    if (!isStage1Done) {
      return {
        valid: false,
        error: 'PIPELINE_VIOLATION',
        message: 'PIPELINE_VIOLATION: Quality assaying must be certified before weighbridge.'
      };
    }
  } else if (incomingStageIdx === 3) {
    const stage2 = stages.find(s => s.stageIndex === 2 || s.id === 'WEIGHBRIDGE');
    const isStage2Done = (stage2?.status || '').toLowerCase() === 'completed';
    if (!isStage2Done) {
      return {
        valid: false,
        error: 'PIPELINE_VIOLATION',
        message: 'PIPELINE_VIOLATION: Weighbridge reading must be locked before procurement PO.'
      };
    }
  } else if (incomingStageIdx === 4) {
    const stage3 = stages.find(s => s.stageIndex === 3 || s.id === 'PROCUREMENT');
    const isStage3Done = (stage3?.status || '').toLowerCase() === 'completed';
    if (!isStage3Done) {
      return {
        valid: false,
        error: 'PIPELINE_VIOLATION',
        message: 'PIPELINE_VIOLATION: Procurement PO must be signed before DBT payout.'
      };
    }
  }

  return { valid: true };
}

    if (mongoose.connection.readyState === 1) {
      let token = await Token.findOne({
        $or: [
          { tokenNumber: tokenNumber },
          { id: tokenNumber }
        ]
      });

      if (!token) {
        return res.status(404).json({
          success: false,
          message: `Token '${tokenNumber}' not found in MongoDB`
        });
      }

      // Locate target stage by ID or stageIndex
      let targetIdx = -1;
      if (stageId) {
        targetIdx = token.stages.findIndex((s) => s.id === stageId);
      }
      if (targetIdx === -1 && stageIndex !== undefined) {
        targetIdx = token.stages.findIndex((s) => s.stageIndex === Number(stageIndex));
      }
      if (targetIdx === -1) {
        targetIdx = stageIdxNumber;
      }

      // Strict Sequential Pipeline Check
      const pipelineCheck = validateSequentialPipeline(token, targetIdx);
      if (!pipelineCheck.valid) {
        logger.warn(`[Pipeline Guard] Token ${tokenNumber} rejected: ${pipelineCheck.message}`);
        return res.status(400).json({
          success: false,
          error: pipelineCheck.error,
          message: pipelineCheck.message
        });
      }

      const now = new Date();

      if (targetIdx !== -1) {
        const stage = token.stages[targetIdx];
        stage.status = status.toLowerCase() === 'completed' ? 'Completed' : status;
        stage.timestamp = req.body.timestamp ? new Date(req.body.timestamp) : now;
        stage.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : now;
        if (officerSigId) stage.officerSigId = officerSigId;
        if (officerName) stage.officerName = officerName;
        if (grade) stage.grade = grade;
        if (weight || netWeight) stage.weight = weight || netWeight;
        stage.details = { ...stage.details, ...mergedDetails };

        targetStageTitle = stage.title || stage.label || stage.shortLabel || 'Checkpoint';
        assignedOfficer = stage.officerName || stage.officer || officerName || 'Officer';

        // Update currentStageIndex
        token.currentStageIndex = Math.min(targetIdx + 1, token.stages.length);
      }

      // Recalculate overall status
      const completedCount = token.stages.filter(
        (s) => s.status === 'Completed' || s.status === 'completed'
      ).length;

      const isPayoutStage = stageId === 'PAYOUT' || targetIdx === 4 || completedCount >= 5;

      if (completedCount === 0) token.status = 'Booked';
      else if (completedCount === 1) token.status = 'GATE_IN';
      else if (completedCount === 2) token.status = 'INSPECTED';
      else if (completedCount === 3) token.status = 'WEIGHED';
      else if (completedCount === 4) token.status = 'PROCUREMENT';
      else if (isPayoutStage) token.status = 'Completed';

      // ─── Desk 5 (PAYOUT) Farmer Dues Auto-Deduction ────────────────────────
      let duesDeducted = 0;
      const farmerPhone = token.farmerPhone || token.phone;

      if (isPayoutStage && farmerPhone) {
        try {
          const farmer = await Farmer.findOne({ phone: farmerPhone });
          if (farmer && farmer.pendingDues > 0) {
            duesDeducted = farmer.pendingDues;
            farmer.pendingDues = 0;
            if (Array.isArray(farmer.cancellationHistory)) {
              farmer.cancellationHistory.forEach((r) => {
                if (r.status === 'DUE') r.status = 'DEDUCTED';
              });
            }
            await farmer.save();
            logger.info(`[Settlement] Auto-deducted ₹${duesDeducted} penalty dues from farmer ${farmerPhone}`);
          }
        } catch (dueErr) {
          logger.warn(`[Settlement] Error auto-deducting dues: ${dueErr.message}`);
        }

        // Also update in-memory dues store
        const memDeducted = inMemoryDeductDues(farmerPhone);
        if (!duesDeducted && memDeducted) duesDeducted = memDeducted;

        // Attach dues breakdown into Stage 5 details
        if (targetIdx !== -1) {
          token.stages[targetIdx].details = {
            ...token.stages[targetIdx].details,
            duesDeducted,
            netPaid: Math.max(0, (totalAmount || 58320) - duesDeducted),
            grossAmount: totalAmount || 58320
          };
        }
      }

      updatedToken = await token.save();

      // If token is completed, synchronize in-memory fallback store as well
      if (updatedToken.status === 'Completed') {
        const phone = updatedToken.farmerPhone || updatedToken.phone;
        if (phone) inMemoryUpdateTokenStatus(phone, 'Completed');
      }

      logger.info(`[Tokens] Stage progress updated for token: ${token.tokenNumber} (Status: ${updatedToken.status}, Completed stages: ${completedCount}/5)`);
    } else {
      // In-Memory store fallback
      let foundEntry = null;
      let foundPhone = null;
      for (const [phone, entry] of inMemoryTokenStore.entries()) {
        if ((entry.token?.tokenNumber === tokenNumber) || (entry.token?.id === tokenNumber)) {
          foundEntry = entry;
          foundPhone = phone;
          break;
        }
      }

      let duesDeducted = 0;
      const isPayoutStage = stageId === 'PAYOUT' || Number(stageIndex) === 4;

      if (foundEntry) {
        const memToken = foundEntry.token;
        let targetIdx = -1;
        if (stageId) targetIdx = memToken.stages.findIndex((s) => s.id === stageId);
        if (targetIdx === -1 && stageIndex !== undefined) targetIdx = memToken.stages.findIndex((s) => s.stageIndex === Number(stageIndex));
        if (targetIdx === -1) targetIdx = stageIdxNumber;

        // Strict Sequential Pipeline Check
        const pipelineCheck = validateSequentialPipeline(memToken, targetIdx);
        if (!pipelineCheck.valid) {
          logger.warn(`[Pipeline Guard - In-Memory] Token ${tokenNumber} rejected: ${pipelineCheck.message}`);
          return res.status(400).json({
            success: false,
            error: pipelineCheck.error,
            message: pipelineCheck.message
          });
        }

        const now = new Date();
        if (targetIdx !== -1) {
          const stage = memToken.stages[targetIdx];
          stage.status = status.toLowerCase() === 'completed' ? 'Completed' : status;
          stage.timestamp = req.body.timestamp ? new Date(req.body.timestamp) : now;
          stage.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : now;
          if (officerSigId) stage.officerSigId = officerSigId;
          if (officerName) stage.officerName = officerName;
          if (grade) stage.grade = grade;
          if (weight || netWeight) stage.weight = weight || netWeight;
          stage.details = { ...stage.details, ...mergedDetails };

          targetStageTitle = stage.title || stage.label || stage.shortLabel || 'Checkpoint';
          assignedOfficer = stage.officerName || stage.officer || officerName || 'Officer';
          memToken.currentStageIndex = Math.min(targetIdx + 1, memToken.stages.length);
        }

        const completedCount = memToken.stages.filter((s) => (s.status || '').toLowerCase() === 'completed').length;
        if (completedCount === 0) memToken.status = 'Booked';
        else if (completedCount === 1) memToken.status = 'GATE_IN';
        else if (completedCount === 2) memToken.status = 'INSPECTED';
        else if (completedCount === 3) memToken.status = 'WEIGHED';
        else if (completedCount === 4) memToken.status = 'PROCUREMENT';
        else if (completedCount >= 5 || isPayoutStage) {
          memToken.status = 'Completed';
          inMemoryUpdateTokenStatus(foundPhone, 'Completed');

          if (foundPhone) {
            duesDeducted = inMemoryDeductDues(foundPhone);
            if (targetIdx !== -1) {
              memToken.stages[targetIdx].details = {
                ...memToken.stages[targetIdx].details,
                duesDeducted,
                netPaid: Math.max(0, (totalAmount || 58320) - duesDeducted),
                grossAmount: totalAmount || 58320
              };
            }
          }
        }

        updatedToken = memToken;
      } else {
        if (isPayoutStage) {
          duesDeducted = inMemoryDeductDues(tokenNumber);
        }
        updatedToken = {
          tokenNumber,
          status: isPayoutStage ? 'Completed' : 'In-Progress',
          currentStageIndex: Number(stageIndex !== undefined ? Number(stageIndex) + 1 : 1)
        };
      }
    }

    // ─── Real-Time WebSocket Broadcasts ──────────────────────────────────────────
    if (req.io) {
      broadcastStageUpdated(req.io, tokenNumber, updatedToken?.mandiId, {
        token: updatedToken,
        tokenNumber,
        stageId,
        stageIndex: updatedToken?.currentStageIndex,
        stageTitle: targetStageTitle,
        officerName: assignedOfficer,
        officerSigId,
        status: updatedToken?.status || 'Completed'
      });

      if (updatedToken?.status === 'Completed' || stageId === 'PAYOUT') {
        broadcastTokenCompleted(req.io, tokenNumber, updatedToken?.mandiId, updatedToken);
        broadcastQueueSlotFreed(req.io, updatedToken?.mandiId, {
          freedTokenNumber: tokenNumber,
          message: `Queue slot cleared upon settlement of Token #${tokenNumber}`
        });
        const farmerPhone = updatedToken?.farmerPhone || updatedToken?.phone;
        if (farmerPhone) {
          broadcastFarmerDuesUpdated(req.io, farmerPhone, { pendingDues: 0, cancellationHistory: [] });
        }
      }
    }

    // ─── Unified Notification Dispatch per Checkpoint Event ────────────────────────
    try {
      const farmerIdStr = (updatedToken?.farmerId || updatedToken?.farmerPhone || updatedToken?.phone || 'farmer').toString();
      const farmerPhone = updatedToken?.farmerPhone || updatedToken?.phone;
      const targetMandi = updatedToken?.mandiName || 'APMC Mandi';

      const sIdx = Number(stageIndex !== undefined ? stageIndex : (
        stageId === 'GATE_CHECKIN' ? 0 :
        stageId === 'QUALITY_GRADING' ? 1 :
        stageId === 'WEIGHBRIDGE' ? 2 :
        stageId === 'PROCUREMENT' ? 3 :
        stageId === 'PAYOUT' ? 4 : -1
      ));

      if (sIdx === 0) {
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'gate_checkin',
          { tokenNumber, mandiName: targetMandi },
          { io: req.io, dedupeKey: `${farmerIdStr}_gate_checkin_${tokenNumber}_stage0` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Gate error: ${e.message}`));
      } else if (sIdx === 1) {
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'quality_assayed',
          { tokenNumber, mandiName: targetMandi, grade: grade || mergedDetails.grade || 'Grade A', moisture: moisture || mergedDetails.moisture || 12 },
          { io: req.io, dedupeKey: `${farmerIdStr}_quality_assayed_${tokenNumber}_stage1` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Quality error: ${e.message}`));
      } else if (sIdx === 2) {
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'weighbridge_done',
          { tokenNumber, mandiName: targetMandi, netWeight: netWeight || mergedDetails.netWeight || updatedToken?.quantity },
          { io: req.io, dedupeKey: `${farmerIdStr}_weighbridge_done_${tokenNumber}_stage2` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Weigh error: ${e.message}`));
      } else if (sIdx === 3) {
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'procurement_recorded',
          { tokenNumber, mandiName: targetMandi, totalAmount: totalAmount || mergedDetails.totalAmount || 58320 },
          { io: req.io, dedupeKey: `${farmerIdStr}_procurement_recorded_${tokenNumber}_stage3` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Procurement error: ${e.message}`));

        // Also trigger payout_ready
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'payout_ready',
          { tokenNumber, mandiName: targetMandi, totalAmount: totalAmount || mergedDetails.totalAmount || 58320 },
          { io: req.io, dedupeKey: `${farmerIdStr}_payout_ready_${tokenNumber}_stage3_ready` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Payout ready error: ${e.message}`));
      } else if (sIdx === 4 || isPayoutStage) {
        const netPaidAmt = mergedDetails.netPaid || totalAmount || 58320;
        notificationService.notify(
          { id: farmerIdStr, type: 'farmer', phone: farmerPhone },
          'payout_paid',
          { tokenNumber, mandiName: targetMandi, netPaid: netPaidAmt, amount: netPaidAmt },
          { io: req.io, dedupeKey: `${farmerIdStr}_payout_paid_${tokenNumber}_stage4_paid` }
        ).catch(e => logger.warn(`[Checkpoint Notif] Payout paid error: ${e.message}`));
      }
    } catch (notifErr) {
      logger.warn(`[Tokens] Checkpoint notification error: ${notifErr.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Checkpoint stage progress updated successfully in MongoDB Atlas',
      token: updatedToken
    });
  } catch (error) {
    logger.error(`[Tokens] Error updating stage progress: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to update checkpoint stage progress',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tokens/farmer/:phone/dues
 * @desc    Fetch authenticated farmer's pending dues and cancellation history.
 *          Farmer A cannot read Farmer B's dues.
 * @access  Private (farmer JWT matching :phone, or staff with non-farmer role)
 */
router.get(['/farmer/:phone/dues', '/farmer-dues/:phone'], authenticate, async (req, res) => {
  try {
    const { phone } = req.params;
    const callerPhone = req.user.phone;
    const callerRole = req.user.role;

    const isFarmer = !callerRole || callerRole === 'farmer';
    if (isFarmer && callerPhone !== phone) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: you can only view your own dues.'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const farmer = await Farmer.findOne({ phone });
      if (farmer) {
        return res.status(200).json({
          success: true,
          farmer: {
            name: farmer.name,
            phone: farmer.phone,
            pendingDues: farmer.pendingDues || 0,
            cancellationHistory: farmer.cancellationHistory || []
          }
        });
      }
    }

    // Fallback to in-memory dues store
    const memProfile = inMemoryGetFarmerDues(phone);
    return res.status(200).json({
      success: true,
      farmer: {
        name: memProfile.name || 'Farmer',
        phone: memProfile.phone,
        pendingDues: memProfile.pendingDues || 0,
        cancellationHistory: memProfile.cancellationHistory || []
      }
    });
  } catch (error) {
    logger.error(`[Dues] Error fetching farmer dues: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer dues',
      error: error.message
    });
  }
});


/**
 * @route   GET /api/tokens/:tokenNumber/cancellation-preview
 * @desc    Preview dynamic penalty and time-decay rules for a given token
 * @access  Public
 */
router.get('/:tokenNumber/cancellation-preview', async (req, res) => {
  try {
    const { tokenNumber } = req.params;
    let token = null;

    if (mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ tokenNumber }, { id: tokenNumber }]
      });
    }

    if (!token) {
      for (const [, entry] of inMemoryTokenStore.entries()) {
        if (entry.token?.tokenNumber === tokenNumber || entry.token?.id === tokenNumber) {
          token = entry.token;
          break;
        }
      }
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token '${tokenNumber}' not found`
      });
    }

    const penaltyInfo = calculateCancellationPenalty(token, new Date());
    const isGateIn = (token.status || '').toUpperCase() === 'GATE_IN' ||
      (token.stages && token.stages[0]?.status?.toLowerCase() === 'completed');

    return res.status(200).json({
      success: true,
      tokenNumber,
      isGateIn,
      requiresGateExitRequest: isGateIn,
      penaltyInfo
    });
  } catch (error) {
    logger.error(`[Cancellation] Error previewing penalty: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to preview cancellation penalty',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tokens/:tokenNumber/cancel
 * @desc    Pre-Gate Token Cancellation with Dynamic Time-Decay Penalty
 * @access  Public
 */
const handleTokenCancellation = async (req, res) => {
  try {
    const { tokenNumber } = req.params;
    const { reason = 'Farmer requested cancellation' } = req.body;
    const now = new Date();

    let token = null;
    let farmerPhone = null;

    if (mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ tokenNumber }, { id: tokenNumber }]
      });
    }

    if (!token) {
      for (const [ph, entry] of inMemoryTokenStore.entries()) {
        if (entry.token?.tokenNumber === tokenNumber || entry.token?.id === tokenNumber) {
          token = entry.token;
          farmerPhone = ph;
          break;
        }
      }
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token '${tokenNumber}' not found for cancellation`
      });
    }

    farmerPhone = token.farmerPhone || token.phone || farmerPhone;

    // Check if token has already passed Gate-In (Stage 1 Completed)
    const stage1Done = token.stages && token.stages[0] &&
      (token.stages[0].status || '').toLowerCase() === 'completed';
    const isGateIn = (token.status || '').toUpperCase() === 'GATE_IN' || stage1Done;

    if (isGateIn) {
      return res.status(400).json({
        success: false,
        error: 'GATE_IN_LOCKED',
        message: 'Vehicle has already passed Gate Check-In. Please use "Request Gate Exit / Produce Rejection" to notify the Gate Officer.'
      });
    }

    // Dynamic penalty calculation
    const penaltyInfo = calculateCancellationPenalty(token, now);
    const penaltyAmount = penaltyInfo.penalty;

    let updatedFarmer = null;

    // Update in MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      token.status = 'Cancelled';
      token.cancellationFee = penaltyAmount;
      token.cancelledAt = now;
      token.cancellationReason = reason;
      await token.save();
      await fastTrackAuctionService.handleLeaderCancellation(token.tokenNumber || tokenNumber, req.io);

      if (farmerPhone) {
        let farmer = await Farmer.findOne({ phone: farmerPhone });
        if (!farmer) {
          farmer = new Farmer({
            phone: farmerPhone,
            name: token.farmerName || 'Farmer'
          });
        }
        farmer.pendingDues = (farmer.pendingDues || 0) + penaltyAmount;
        farmer.cancellationHistory.unshift({
          tokenNumber: token.tokenNumber || tokenNumber,
          mandiName: token.mandiName || 'APMC Kopargaon',
          cancelledAt: now,
          penaltyAmount,
          reason,
          status: penaltyAmount > 0 ? 'DUE' : 'WAIVED'
        });
        updatedFarmer = await farmer.save();
      }
    }

    // Update In-Memory Store & Release single-active-token lock
    if (farmerPhone) {
      inMemoryUpdateTokenStatus(farmerPhone, 'Cancelled');
      inMemoryTokenStore.delete(farmerPhone); // Free up immediately

      const record = {
        tokenNumber: token.tokenNumber || tokenNumber,
        mandiName: token.mandiName || 'APMC Kopargaon',
        cancelledAt: now,
        penaltyAmount,
        reason,
        status: penaltyAmount > 0 ? 'DUE' : 'WAIVED'
      };
      const memProfile = inMemoryAddCancellation(farmerPhone, record, token.farmerName);
      if (!updatedFarmer) updatedFarmer = memProfile;
    }

    // ─── Real-Time WebSocket Broadcasts ──────────────────────────────────────────
    if (req.io) {
      broadcastTokenCancelled(req.io, tokenNumber, token.mandiId, {
        tokenNumber,
        status: 'Cancelled',
        penaltyAmount,
        penaltyInfo,
        reason
      });

      broadcastQueueSlotFreed(req.io, token.mandiId, {
        freedTokenNumber: tokenNumber,
        message: `Queue slot freed by token ${tokenNumber}`
      });

      if (farmerPhone) {
        broadcastFarmerDuesUpdated(req.io, farmerPhone, {
          phone: farmerPhone,
          pendingDues: updatedFarmer?.pendingDues || penaltyAmount,
          cancellationHistory: updatedFarmer?.cancellationHistory || []
        });
      }
    }

    logger.info(`[Cancellation] Token ${tokenNumber} cancelled. Penalty: ₹${penaltyAmount}. Single-active-token lock lifted for ${farmerPhone}`);

    return res.status(200).json({
      success: true,
      message: `Token cancelled successfully. Penalty of ₹${penaltyAmount} (${penaltyInfo.tier}) applied. Account unlocked!`,
      tokenNumber,
      status: 'Cancelled',
      penaltyAmount,
      penaltyInfo,
      pendingDues: updatedFarmer?.pendingDues || penaltyAmount
    });
  } catch (error) {
    logger.error(`[Cancellation] Error cancelling token: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel token',
      error: error.message
    });
  }
};

router.post('/:tokenNumber/cancel', handleTokenCancellation);
router.delete('/:tokenNumber/cancel', handleTokenCancellation);

/**
 * @route   POST /api/tokens/:tokenNumber/request-exit
 * @desc    Post Gate-In cancellation request from farmer (Produce Rejection / Emergency Gate Exit)
 * @access  Public
 */
router.post('/:tokenNumber/request-exit', async (req, res) => {
  try {
    const { tokenNumber } = req.params;
    const { reason = 'Produce rejection / Driver requested gate exit' } = req.body;
    const now = new Date();

    let token = null;

    if (mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ tokenNumber }, { id: tokenNumber }]
      });
      if (token) {
        token.status = 'Gate-Exit-Requested';
        token.cancellationReason = reason;
        await token.save();
      }
    }

    if (!token) {
      for (const [, entry] of inMemoryTokenStore.entries()) {
        if (entry.token?.tokenNumber === tokenNumber || entry.token?.id === tokenNumber) {
          token = entry.token;
          token.status = 'Gate-Exit-Requested';
          token.cancellationReason = reason;
          break;
        }
      }
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token '${tokenNumber}' not found`
      });
    }

    // Broadcast Priority Alert to Desk 1 Gate Officer
    if (req.io) {
      broadcastGateExitRequested(req.io, tokenNumber, token.mandiId, {
        tokenNumber,
        farmerName: token.farmerName,
        phone: token.farmerPhone || token.phone,
        crop: token.crop,
        reason,
        status: 'Gate-Exit-Requested',
        message: `Vehicle #${tokenNumber} (${token.farmerName}) requests gate exit after yard entry: ${reason}`
      });
    }

    logger.info(`[GateExit] Gate exit requested for token: ${tokenNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Gate exit request submitted to Security Desk #1. Officer must authorize before boom barrier opens.',
      tokenNumber,
      status: 'Gate-Exit-Requested'
    });
  } catch (error) {
    logger.error(`[GateExit] Error requesting gate exit: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit gate exit request',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tokens/:tokenNumber/approve-exit
 * @desc    Desk 1 Gate Officer authorizes gate exit, opens boom barrier, adds penalty dues, and unlocks account
 * @access  Public
 */
router.post('/:tokenNumber/approve-exit', async (req, res) => {
  try {
    const { tokenNumber } = req.params;
    const {
      officerName = 'Security Desk #1',
      officerSigId = 'SEC-D1-KPG-EXIT',
      penaltyAmount = 150,
      reason = 'Gate exit approved by officer'
    } = req.body;
    const now = new Date();

    let token = null;
    let farmerPhone = null;

    if (mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ tokenNumber }, { id: tokenNumber }]
      });
    }

    if (!token) {
      for (const [ph, entry] of inMemoryTokenStore.entries()) {
        if (entry.token?.tokenNumber === tokenNumber || entry.token?.id === tokenNumber) {
          token = entry.token;
          farmerPhone = ph;
          break;
        }
      }
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token '${tokenNumber}' not found`
      });
    }

    farmerPhone = token.farmerPhone || token.phone || farmerPhone;
    const finalPenalty = Number(penaltyAmount) >= 0 ? Number(penaltyAmount) : 150;
    let updatedFarmer = null;

    if (mongoose.connection.readyState === 1) {
      token.status = 'Cancelled';
      token.cancellationFee = finalPenalty;
      token.cancelledAt = now;
      token.gateExitApprovedBy = officerName;
      token.cancellationReason = reason;
      await token.save();

      if (farmerPhone) {
        let farmer = await Farmer.findOne({ phone: farmerPhone });
        if (!farmer) {
          farmer = new Farmer({ phone: farmerPhone, name: token.farmerName || 'Farmer' });
        }
        farmer.pendingDues = (farmer.pendingDues || 0) + finalPenalty;
        farmer.cancellationHistory.unshift({
          tokenNumber: token.tokenNumber || tokenNumber,
          mandiName: token.mandiName || 'APMC Kopargaon',
          cancelledAt: now,
          penaltyAmount: finalPenalty,
          reason,
          status: finalPenalty > 0 ? 'DUE' : 'WAIVED'
        });
        updatedFarmer = await farmer.save();
      }
    }

    // Free up in-memory single-active-token lock
    if (farmerPhone) {
      inMemoryUpdateTokenStatus(farmerPhone, 'Cancelled');
      inMemoryTokenStore.delete(farmerPhone);

      const record = {
        tokenNumber: token.tokenNumber || tokenNumber,
        mandiName: token.mandiName || 'APMC Kopargaon',
        cancelledAt: now,
        penaltyAmount: finalPenalty,
        reason,
        status: finalPenalty > 0 ? 'DUE' : 'WAIVED'
      };
      const memProfile = inMemoryAddCancellation(farmerPhone, record, token.farmerName);
      if (!updatedFarmer) updatedFarmer = memProfile;
    }

    // ─── Real-Time WebSocket Broadcasts ──────────────────────────────────────────
    if (req.io) {
      // 1. Open boom barrier
      broadcastHardwareEvent(req.io, token.mandiId || 'KPG-01', {
        device: 'BOOM_BARRIER',
        action: 'OPEN',
        tokenNumber,
        reason: 'Authorized Gate Exit'
      });

      // 2. Broadcast exit approved to token, mandi, admin, and global rooms
      broadcastExitApproved(req.io, tokenNumber, token.mandiId, {
        tokenNumber,
        status: 'Cancelled',
        penaltyAmount: finalPenalty,
        gateExitApprovedBy: officerName,
        reason
      });

      // 3. Broadcast token cancelled & single active token release
      broadcastTokenCancelled(req.io, tokenNumber, token.mandiId, {
        tokenNumber,
        status: 'Cancelled',
        penaltyAmount: finalPenalty,
        gateExitApprovedBy: officerName,
        reason
      });

      broadcastQueueSlotFreed(req.io, token.mandiId, {
        freedTokenNumber: tokenNumber,
        message: `Vehicle ${tokenNumber} exited yard.`
      });

      if (farmerPhone) {
        broadcastFarmerDuesUpdated(req.io, farmerPhone, {
          phone: farmerPhone,
          pendingDues: updatedFarmer?.pendingDues || finalPenalty,
          cancellationHistory: updatedFarmer?.cancellationHistory || []
        });
      }
    }

    logger.info(`[GateExit] Gate exit authorized by ${officerName} for token ${tokenNumber}. Barrier opened. Penalty: ₹${finalPenalty}`);

    return res.status(200).json({
      success: true,
      message: `Gate exit authorized by ${officerName}. Boom barrier opened and account unlocked.`,
      tokenNumber,
      status: 'Cancelled',
      penaltyAmount: finalPenalty,
      pendingDues: updatedFarmer?.pendingDues || finalPenalty
    });
  } catch (error) {
    logger.error(`[GateExit] Error approving gate exit: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to authorize gate exit',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tokens/hardware-event
 * @desc    Simulate and broadcast hardware event (boom barrier, digital scale)
 * @access  Public
 */
router.post('/hardware-event', (req, res) => {
  const { mandiId = 'KPG-01', device = 'BOOM_BARRIER', action = 'OPEN', value, tokenNumber } = req.body;

  if (req.io) {
    broadcastHardwareEvent(req.io, mandiId, {
      device,
      action,
      value,
      tokenNumber,
      mandiId
    });
  }

  return res.status(200).json({
    success: true,
    message: `Hardware event ${device}:${action} broadcast successfully`,
    event: { mandiId, device, action, value, tokenNumber, timestamp: new Date().toISOString() }
  });
});

/**
 * @route   GET /api/tokens/:tokenNumber/agripool-matches
 * @desc    Find active bookings within 500m radius heading to same mandi today
 * @access  Private (Farmer owner of token or staff)
 */
router.get('/:tokenNumber/agripool-matches', authenticate, async (req, res) => {
  try {
    const { tokenNumber } = req.params;

    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({ success: true, matches: [], message: 'Database offline' });
    }

    const currentToken = await Token.findOne({
      $or: [{ tokenNumber }, { id: tokenNumber }]
    });

    if (!currentToken) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    // Ownership enforcement for farmer callers
    const callerRole = req.user.role;
    const callerPhone = req.user.phone;
    const isFarmer = !callerRole || callerRole === 'farmer';
    const isOwner = (currentToken.farmerPhone === callerPhone) ||
      (currentToken.phone === callerPhone) ||
      (currentToken.farmerId && currentToken.farmerId.toString() === req.user.id);

    if (isFarmer && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only query AgriPool matches for your own confirmed token.'
      });
    }

    let currentLat = Number(currentToken.latitude) || 19.8928;
    let currentLng = Number(currentToken.longitude) || 74.4820;

    const farmerDoc = await Farmer.findOne({ phone: currentToken.farmerPhone || currentToken.phone });
    if (farmerDoc?.pickupLocation?.coordinates?.length === 2) {
      currentLng = Number(farmerDoc.pickupLocation.coordinates[0]);
      currentLat = Number(farmerDoc.pickupLocation.coordinates[1]);
    }


    const candidateTokens = await Token.find({
      _id: { $ne: currentToken._id },
      $or: [
        { mandiId: currentToken.mandiId },
        { mandiCode: currentToken.mandiCode }
      ],
      slotDate: currentToken.slotDate,
      farmerPhone: { $ne: currentToken.farmerPhone },
      status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
    });

    const matches = [];

    for (const peer of candidateTokens) {
      const peerLat = peer.latitude || (peer.location?.coordinates ? peer.location.coordinates[1] : 19.8928);
      const peerLng = peer.longitude || (peer.location?.coordinates ? peer.location.coordinates[0] : 74.4820);
      const distMeters = calculateHaversineDistanceMeters(currentLat, currentLng, peerLat, peerLng);

      if (distMeters <= 500) {
        const roundedDist = Math.max(25, Math.round(distMeters));
        matches.push({
          tokenNumber: peer.tokenNumber,
          farmerName: peer.farmerName,
          farmerPhone: peer.farmerPhone,
          crop: peer.crop,
          quantity: peer.quantity,
          mandiName: peer.mandiName,
          distanceMeters: roundedDist,
          latitude: peerLat,
          longitude: peerLng,
          message: `A farmer within ${roundedDist}m of your location is heading to APMC ${currentToken.mandiName.replace('APMC ', '')} today. Merge your load to save transport costs!`
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });
  } catch (error) {
    logger.error(`[AgriPool] Error fetching matches for token ${req.params.tokenNumber}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to search AgriPool matches', error: error.message });
  }
});

router.createTokenReservation = createTokenReservation;

module.exports = router;


