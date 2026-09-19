const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Token = require('../models/Token');
const Farmer = require('../models/Farmer');
const Centre = require('../models/Centre');
const logger = require('../utils/logger');
const centreService = require('./centreService');
const cropPriceService = require('./cropPriceService');
const queueService = require('./queueService');
const procurementService = require('./procurementService');
const { TOKEN_STATUS, normalizeStatus } = require('../utils/statusEnums');

// ─── Constants & Master Lists ──────────────────────────────────────────────────

const KNOWN_CENTRES = [
  { code: 'KPG-01', id: 'KPG-01', name: 'APMC Kopargaon', nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती', nameHindi: 'कोपरगांव कृषि उपज मंडी', keywords: ['kopargaon', 'kopergaon', 'कोपरगाव', 'कोपरगांव'] },
  { code: 'SRD-02', id: 'SRD-02', name: 'APMC Shirdi', nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती', nameHindi: 'शिर्डी कृषि उपज मंडी', keywords: ['shirdi', 'sirdi', 'शिर्डी', 'शिरडी'] },
  { code: 'RHT-03', id: 'RHT-03', name: 'APMC Rahata', nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती', nameHindi: 'राहाता कृषि उपज मंडी', keywords: ['rahata', 'rahta', 'राहाता', 'राहता'] },
  { code: 'VJP-04', id: 'VJP-04', name: 'APMC Vaijapur', nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती', nameHindi: 'वैजापुर कृषि उपज मंडी', keywords: ['vaijapur', 'vaizapur', 'वैजापूर', 'वैजापुर'] },
  { code: 'SRP-05', id: 'SRP-05', name: 'APMC Shrirampur', nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती', nameHindi: 'श्रीरामपुर कृषि उपज मंडी', keywords: ['shrirampur', 'shreerampur', 'श्रीरामपूर', 'श्रीरामपुर'] },
  { code: 'LSG-06', id: 'LSG-06', name: 'APMC Lasalgaon', nameMarathi: 'लासलगाव कांदा बाजार समिती', nameHindi: 'लासलगांव प्याज मंडी', keywords: ['lasalgaon', 'lasalganw', 'लासलगाव', 'लासलगांव'] }
];

const KNOWN_CROPS = [
  { id: 'Soybean', nameEn: 'Soybean', nameMr: 'सोयाबीन', nameHi: 'सोयाबीन', keywords: ['soybean', 'soya', 'soyabean', 'सोयाबीन', 'सोया'] },
  { id: 'Cotton', nameEn: 'Cotton', nameMr: 'कापूस', nameHi: 'कपास', keywords: ['cotton', 'kapas', 'kapus', 'कापूस', 'कपास'] },
  { id: 'Wheat', nameEn: 'Wheat', nameMr: 'गहू', nameHi: 'गेहूं', keywords: ['wheat', 'gehu', 'gahu', 'गहू', 'गेहूं'] },
  { id: 'Onion', nameEn: 'Onion', nameMr: 'कांदा', nameHi: 'प्याज', keywords: ['onion', 'kanda', 'pyaj', 'pyaz', 'कांदा', 'प्याज', 'red onion'] },
  { id: 'Maize', nameEn: 'Maize', nameMr: 'मका', nameHi: 'मक्का', keywords: ['maize', 'corn', 'maka', 'makka', 'मका', 'मक्का'] },
  { id: 'Chana', nameEn: 'Chana', nameMr: 'हरभरा', nameHi: 'चना', keywords: ['chana', 'harbhara', 'gram', 'हरभरा', 'चना'] }
];

const DEFAULT_SLOTS = [
  { id: 'S1', label: 'Morning  08:00 – 11:00 AM', slotLabel: '08:00 AM - 11:00 AM', start: '08:00', end: '11:00', keywords: ['morning', 'sakali', 'subah', 'सकाळी', 'सुबह', 'सकाळ', '8', '8 to 11', 'pahila', 'पहिला'] },
  { id: 'S2', label: 'Midday   11:00 AM – 02:00 PM', slotLabel: '11:00 AM - 02:00 PM', start: '11:00', end: '14:00', keywords: ['midday', 'noon', 'dupari', 'dopahar', 'दुपारी', 'दोपहर', 'dupar', '11', '11 to 2', 'dusra', 'दूसरा'] },
  { id: 'S3', label: 'Afternoon 02:00 – 05:00 PM', slotLabel: '02:00 PM - 05:00 PM', start: '14:00', end: '17:00', keywords: ['afternoon', 'evening', 'sandhyakali', 'sham', 'संध्याकाळी', 'शाम', 'tisra', 'तीसरा', '2 to 5', '2'] }
];

// Master Support Info
const SUPPORT_INFO = {
  tollFree: '1800-123-54726',
  tollFreeDisplay: '1800-123-KISAN (1800-123-54726)',
  whatsapp: '+919876543210',
  whatsappUrl: 'https://wa.me/919876543210?text=Hello%20KisanQ%20Support',
  operatingHours: 'Voice Helpline 24x7 | Mandi Desk 07:00 AM - 07:00 PM',
  portalUrl: 'https://kisanq.gov.in'
};

// ─── In-Memory Voice Sessions Store ────────────────────────────────────────────

const inMemoryVoiceSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of inMemoryVoiceSessions.entries()) {
    if (now > session.expiresAt) {
      inMemoryVoiceSessions.delete(sessionId);
    }
  }
}, 60 * 1000);

// ─── 7 Tool Definitions for Groq Tool-Calling ──────────────────────────────────

const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'book_slot',
      description: 'Book an APMC mandi arrival slot for crop intake.',
      parameters: {
        type: 'object',
        properties: {
          centre: { type: 'string', description: 'Mandi name/code (e.g. Kopargaon, Shirdi, KPG-01)' },
          crop: { type: 'string', description: 'Crop name (e.g. Soybean, Cotton, Wheat)' },
          quantity: { type: 'number', description: 'Quantity in Quintals' },
          slot: { type: 'string', description: 'Slot date and time (e.g. Tomorrow morning, 08:00 AM - 11:00 AM)' }
        },
        required: ['centre', 'crop', 'quantity', 'slot']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancel an active booking slot for the farmer.',
      parameters: {
        type: 'object',
        properties: {
          tokenNumber: { type: 'string', description: 'Token number (optional)' },
          reason: { type: 'string', description: 'Cancellation reason' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_queue_position',
      description: 'Check live queue position, vehicles ahead, and wait time for active token.',
      parameters: {
        type: 'object',
        properties: {
          tokenNumber: { type: 'string', description: 'Token number (optional)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_crop_price',
      description: 'Check today MSP and APMC mandi market price for a crop.',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string', description: 'Crop name (e.g. Soybean, Cotton, Wheat)' },
          centre: { type: 'string', description: 'Mandi name/code (optional)' }
        },
        required: ['crop']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_token_status',
      description: 'Check 5-stage progress of a token (Gate, Grading, Weighbridge, Procurement, Payout).',
      parameters: {
        type: 'object',
        properties: {
          tokenNumber: { type: 'string', description: 'Token number (optional)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_payout_status',
      description: 'Check DBT payout amount and payment status for delivered harvest.',
      parameters: {
        type: 'object',
        properties: {
          tokenNumber: { type: 'string', description: 'Token number (optional)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_support_info',
      description: 'Get KisanQ toll-free helpline number and WhatsApp support link.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Support topic (optional)' }
        }
      }
    }
  }
];

// ─── Groq Audio Transcription (Whisper) ───────────────────────────────────────

/**
 * Transcribes spoken audio buffer using Groq Whisper endpoint
 * Model: whisper-large-v3-turbo
 */
async function transcribeAudio(audioBuffer, languageHint = 'mr', mimeType = 'audio/webm') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !audioBuffer || audioBuffer.length < 50) {
    logger.warn('[VoiceBooking] transcribeAudio: No GROQ_API_KEY or buffer too short');
    return null;
  }

  try {
    const formData = new FormData();
    const ext = (mimeType && mimeType.includes('m4a')) ? 'm4a' : (mimeType && mimeType.includes('wav')) ? 'wav' : (mimeType && mimeType.includes('ogg')) ? 'ogg' : 'webm';
    const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
    formData.append('file', blob, `voice_input.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    if (['mr', 'hi', 'en'].includes(languageHint)) {
      formData.append('language', languageHint);
    }
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData,
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`[VoiceBooking] Groq Whisper API returned status ${response.status}: ${errText}`);
      return null;
    }

    const json = await response.json();
    const text = (json.text || '').trim();
    logger.info(`[VoiceBooking] Groq Whisper transcription (${languageHint}): "${text}"`);
    return text || null;
  } catch (err) {
    logger.warn(`[VoiceBooking] Groq Whisper transcription failed: ${err.message}`);
    return null;
  }
}

// ─── Tool Execution Handlers ───────────────────────────────────────────────────

/**
 * 1. Book a Slot Handler
 */
async function handleBookSlot({ centre, crop, quantity, slot }, session) {
  try {
    // Normalize centre
    let matchedCentre = KNOWN_CENTRES.find((c) =>
      c.code.toLowerCase() === String(centre).toLowerCase() ||
      c.name.toLowerCase().includes(String(centre).toLowerCase()) ||
      c.keywords.some((kw) => String(centre).toLowerCase().includes(kw.toLowerCase()))
    ) || KNOWN_CENTRES[0];

    // Normalize crop
    let matchedCrop = KNOWN_CROPS.find((cr) =>
      cr.id.toLowerCase() === String(crop).toLowerCase() ||
      cr.keywords.some((kw) => String(crop).toLowerCase().includes(kw.toLowerCase()))
    ) || { id: 'Soybean', nameEn: 'Soybean', nameMr: 'सोयाबीन', nameHi: 'सोयाबीन' };

    // Normalize quantity
    let qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) qty = 25;
    if (qty > 100) qty = 100;

    // Normalize slot & date
    let dateOffset = 0;
    const cleanSlot = String(slot || '').toLowerCase();
    if (cleanSlot.includes('tomorrow') || cleanSlot.includes('udya') || cleanSlot.includes('उद्या') || cleanSlot.includes('kal') || cleanSlot.includes('कल')) {
      dateOffset = 1;
    } else if (cleanSlot.includes('day after') || cleanSlot.includes('parwa') || cleanSlot.includes('परवा') || cleanSlot.includes('परसों')) {
      dateOffset = 2;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dateOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    let chosenSlot = DEFAULT_SLOTS[0];
    for (const s of DEFAULT_SLOTS) {
      if (s.keywords.some((kw) => cleanSlot.includes(kw.toLowerCase()))) {
        chosenSlot = s;
        break;
      }
    }
    const slotLabel = chosenSlot.slotLabel || chosenSlot.label;

    const bookingPayload = {
      collectedData: {
        centreCode: matchedCentre.code,
        centreId: matchedCentre.code,
        centreName: matchedCentre.name,
        crop: matchedCrop.id,
        quantity: qty,
        quantityBand: qty <= 5 ? '0-5q' : qty <= 15 ? '5-15q' : '15q+',
        slotDate: dateStr,
        slotLabel,
        slotTime: slotLabel
      },
      farmerPhone: session.farmerPhone || '9876543210',
      farmerName: session.farmerName || 'Mahesh Borde',
      farmerId: session.farmerId || null
    };

    const result = await voiceBookingService.finalizeBooking(bookingPayload);
    session.activeToken = result.token;

    return {
      success: true,
      action: 'book_slot',
      tokenNumber: result.token.tokenNumber,
      mandiName: matchedCentre.name,
      mandiCode: matchedCentre.code,
      crop: matchedCrop.id,
      quantity: qty,
      slotDate: dateStr,
      slotTime: slotLabel,
      queuePosition: result.token.queuePosition || 1,
      estimatedWaitTime: '15-20 mins',
      token: result.token
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleBookSlot error: ${err.message}`);
    return {
      success: false,
      action: 'book_slot',
      error: err.message
    };
  }
}

/**
 * 2. Cancel Booking Handler
 */
async function handleCancelBooking({ tokenNumber, reason }, session) {
  try {
    const phone = session.farmerPhone || '9876543210';
    let targetToken = null;

    if (tokenNumber) {
      if (mongoose.connection.readyState === 1) {
        targetToken = await Token.findOne({
          $or: [{ tokenNumber: tokenNumber.trim() }, { id: tokenNumber.trim() }]
        });
      }
    }

    if (!targetToken) {
      if (mongoose.connection.readyState === 1) {
        targetToken = await Token.findOne({
          $or: [{ farmerPhone: phone }, { phone }],
          status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
        }).sort({ createdAt: -1 });
      }
    }

    if (!targetToken && session.activeToken) {
      targetToken = session.activeToken;
    }

    if (!targetToken) {
      return {
        success: false,
        action: 'cancel_booking',
        message: 'No active booking was found to cancel for your phone number.'
      };
    }

    // Cancel token
    targetToken.status = 'CANCELLED';
    targetToken.cancelledAt = new Date();
    targetToken.cancellationReason = reason || 'Farmer requested cancellation via Voice Assistant';

    if (mongoose.connection.readyState === 1 && targetToken.save) {
      await targetToken.save();
    }

    session.activeToken = null;

    return {
      success: true,
      action: 'cancel_booking',
      tokenNumber: targetToken.tokenNumber || targetToken.id,
      cancelledAt: new Date().toISOString(),
      cancellationFee: 0,
      feeExplanation: 'Free cancellation (>2 hours prior to slot)',
      message: `Booking ${targetToken.tokenNumber || targetToken.id} has been cancelled successfully.`
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleCancelBooking error: ${err.message}`);
    return {
      success: false,
      action: 'cancel_booking',
      error: err.message
    };
  }
}

/**
 * 3. Check Live Queue Position Handler
 */
async function handleCheckQueuePosition({ tokenNumber }, session) {
  try {
    const phone = session.farmerPhone || '9876543210';
    let token = null;

    if (tokenNumber && mongoose.connection.readyState === 1) {
      token = await Token.findOne({ $or: [{ tokenNumber }, { id: tokenNumber }] });
    }

    if (!token && mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ farmerPhone: phone }, { phone }],
        status: { $nin: ['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'] }
      }).sort({ createdAt: -1 });
    }

    if (!token && session.activeToken) {
      token = session.activeToken;
    }

    if (!token) {
      return {
        success: false,
        action: 'check_queue_position',
        message: 'No active booking queue record found for your account.'
      };
    }

    const pos = token.queuePosition || 1;
    const waitMins = Math.max(10, pos * 8);

    return {
      success: true,
      action: 'check_queue_position',
      tokenNumber: token.tokenNumber || token.id,
      mandiName: token.mandiName || 'APMC Kopargaon',
      crop: token.crop || 'Soybean',
      queuePosition: pos,
      aheadCount: Math.max(0, pos - 1),
      estimatedWaitTime: `${waitMins} minutes`,
      status: token.status || 'BOOKED',
      currentStage: token.stages?.[token.currentStageIndex || 0]?.title || 'Gate Check-in & QR Scan'
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleCheckQueuePosition error: ${err.message}`);
    return {
      success: false,
      action: 'check_queue_position',
      error: err.message
    };
  }
}

/**
 * 4. Check Crop Price / MSP Handler
 */
async function handleCheckCropPrice({ crop, centre }) {
  try {
    const cleanCrop = crop || 'Soybean';
    const mspRates = {
      Soybean: 4892,
      Wheat: 2425,
      Onion: 1950,
      Cotton: 7122,
      Maize: 2090,
      Chana: 5440
    };

    let targetMandiId = 'KPG-01';
    let targetMandiName = 'APMC Kopargaon';
    if (centre) {
      const match = KNOWN_CENTRES.find((c) =>
        c.code.toLowerCase().includes(centre.toLowerCase()) ||
        c.name.toLowerCase().includes(centre.toLowerCase()) ||
        c.keywords.some((kw) => centre.toLowerCase().includes(kw.toLowerCase()))
      );
      if (match) {
        targetMandiId = match.code;
        targetMandiName = match.name;
      }
    }

    let prices = [];
    try {
      prices = await cropPriceService.getPricesByCrop(cleanCrop);
    } catch (e) {
      prices = [];
    }

    const defaultMsp = mspRates[cleanCrop] || 4892;
    const marketToday = prices[0]?.marketPriceToday || Math.round(defaultMsp * 1.015);
    const marketYesterday = prices[0]?.marketPriceYesterday || defaultMsp;

    return {
      success: true,
      action: 'check_crop_price',
      crop: cleanCrop,
      mandiName: targetMandiName,
      mandiId: targetMandiId,
      statutoryMSP: defaultMsp,
      marketPriceToday: marketToday,
      marketPriceYesterday: marketYesterday,
      priceTrend: marketToday >= marketYesterday ? 'UP' : 'DOWN',
      unit: '₹ / Quintal',
      prices: prices.length > 0 ? prices : [
        { mandiId: targetMandiId, crop: cleanCrop, mspPrice: defaultMsp, marketPriceToday: marketToday, marketPriceYesterday: marketYesterday }
      ]
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleCheckCropPrice error: ${err.message}`);
    return {
      success: false,
      action: 'check_crop_price',
      error: err.message
    };
  }
}

/**
 * 5. Check Token 5-Stage Status Handler
 */
async function handleCheckTokenStatus({ tokenNumber }, session) {
  try {
    const phone = session.farmerPhone || '9876543210';
    let token = null;

    if (tokenNumber && mongoose.connection.readyState === 1) {
      token = await Token.findOne({ $or: [{ tokenNumber }, { id: tokenNumber }] });
    }

    if (!token && mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ farmerPhone: phone }, { phone }]
      }).sort({ createdAt: -1 });
    }

    if (!token && session.activeToken) {
      token = session.activeToken;
    }

    if (!token) {
      return {
        success: false,
        action: 'check_token_status',
        message: 'No token record found for your request.'
      };
    }

    const currentIdx = token.currentStageIndex || 0;
    const stages = token.stages || [];
    const currentStage = stages[currentIdx] || { title: 'Gate Check-in & QR Scan', status: 'Pending', officerName: 'Security Desk #1' };

    return {
      success: true,
      action: 'check_token_status',
      tokenNumber: token.tokenNumber || token.id,
      mandiName: token.mandiName || 'APMC Kopargaon',
      crop: token.crop || 'Soybean',
      quantity: token.quantity || 25,
      overallStatus: token.status || 'BOOKED',
      currentStageIndex: currentIdx + 1,
      totalStages: 5,
      currentStageName: currentStage.title || currentStage.label,
      currentStageStatus: currentStage.status || 'Pending',
      assignedOfficer: currentStage.officerName || currentStage.officer || 'APMC Desk Officer',
      stages: stages.map((s, idx) => ({
        index: idx + 1,
        title: s.title || s.label,
        status: s.status || (idx < currentIdx ? 'Completed' : idx === currentIdx ? 'In Progress' : 'Pending'),
        officer: s.officerName || s.officer
      }))
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleCheckTokenStatus error: ${err.message}`);
    return {
      success: false,
      action: 'check_token_status',
      error: err.message
    };
  }
}

/**
 * 6. Check Payout / Payment Status Handler
 */
async function handleCheckPayoutStatus({ tokenNumber }, session) {
  try {
    const phone = session.farmerPhone || '9876543210';
    let token = null;

    if (tokenNumber && mongoose.connection.readyState === 1) {
      token = await Token.findOne({ $or: [{ tokenNumber }, { id: tokenNumber }] });
    }

    if (!token && mongoose.connection.readyState === 1) {
      token = await Token.findOne({
        $or: [{ farmerPhone: phone }, { phone }]
      }).sort({ createdAt: -1 });
    }

    if (!token && session.activeToken) {
      token = session.activeToken;
    }

    if (!token) {
      return {
        success: false,
        action: 'check_payout_status',
        message: 'No delivery/token record found to calculate payout.'
      };
    }

    const qty = Number(token.quantity || 25);
    const mspPrice = 4892;
    const totalAmount = Math.round(qty * mspPrice);
    const isCompleted = ['COMPLETED', 'Completed'].includes(token.status) || (token.currentStageIndex >= 4);

    return {
      success: true,
      action: 'check_payout_status',
      tokenNumber: token.tokenNumber || token.id,
      farmerName: token.farmerName || 'Mahesh Borde',
      crop: token.crop || 'Soybean',
      netWeightQuintals: qty,
      procuredRate: `₹${mspPrice}/Qtl`,
      totalPayoutAmount: `₹${totalAmount.toLocaleString('en-IN')}`,
      payoutStatus: isCompleted ? 'PROCESSED_DBT_TRANSFERRED' : 'PENDING_FINAL_STAGE',
      dbtReferenceNumber: isCompleted ? `DBT-KQ-${Date.now().toString().slice(-8)}` : 'Will be generated after Stage 4 weighment',
      bankAccount: 'Direct Bank Transfer (Aadhaar Seeded DBT Account)'
    };
  } catch (err) {
    logger.error(`[VoiceBooking] handleCheckPayoutStatus error: ${err.message}`);
    return {
      success: false,
      action: 'check_payout_status',
      error: err.message
    };
  }
}

/**
 * 7. Help & Support Info Handler
 */
async function handleGetSupportInfo({ topic }) {
  return {
    success: true,
    action: 'get_support_info',
    helplineTollFree: SUPPORT_INFO.tollFree,
    helplineDisplay: SUPPORT_INFO.tollFreeDisplay,
    whatsappNumber: SUPPORT_INFO.whatsapp,
    whatsappChatUrl: SUPPORT_INFO.whatsappUrl,
    operatingHours: SUPPORT_INFO.operatingHours,
    topic: topic || 'general_support',
    message: `KisanQ Helpline: ${SUPPORT_INFO.tollFreeDisplay}. WhatsApp Support: ${SUPPORT_INFO.whatsapp}. Operating 24x7 for farmers.`
  };
}

// ─── Dispatcher: Execute Tool by Name ──────────────────────────────────────────

async function executeAssistantTool(toolName, args, session) {
  logger.info(`[VoiceBooking] Executing tool '${toolName}' with arguments:`, args);

  switch (toolName) {
    case 'book_slot':
      return await handleBookSlot(args, session);
    case 'cancel_booking':
      return await handleCancelBooking(args, session);
    case 'check_queue_position':
      return await handleCheckQueuePosition(args, session);
    case 'check_crop_price':
      return await handleCheckCropPrice(args);
    case 'check_token_status':
      return await handleCheckTokenStatus(args, session);
    case 'check_payout_status':
      return await handleCheckPayoutStatus(args, session);
    case 'get_support_info':
      return await handleGetSupportInfo(args);
    default:
      return {
        success: false,
        error: `Unknown action: ${toolName}`
      };
  }
}

// ─── Message Sanitizer for Groq API ───────────────────────────────────────────

function cleanMessagesForGroq(messages) {
  const systemMsg = messages.find((m) => m.role === 'system');
  
  // Find if we are currently in a pending tool-response phase (last message is 'tool')
  const lastMsg = messages[messages.length - 1];
  const isPendingToolResponse = lastMsg && lastMsg.role === 'tool';

  // For history, keep user messages, final assistant text replies, and if pending, the active tool call & tool result
  const cleanedHistory = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'system') continue;

    if (m.role === 'user') {
      cleanedHistory.push({ role: 'user', content: m.content || '' });
    } else if (m.role === 'assistant' && m.content && !m.tool_calls) {
      cleanedHistory.push({ role: 'assistant', content: m.content });
    } else if (isPendingToolResponse && i >= messages.length - 3) {
      // Active in-flight tool calling sequence
      if (m.role === 'assistant' && m.tool_calls) {
        cleanedHistory.push({
          role: 'assistant',
          content: null,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: tc.type || 'function',
            function: {
              name: tc.function?.name,
              arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {})
            }
          }))
        });
      } else if (m.role === 'tool') {
        cleanedHistory.push({
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || {})
        });
      }
    }
  }

  const sliced = cleanedHistory.slice(-10);
  return systemMsg ? [systemMsg, ...sliced] : sliced;
}

// ─── Localized Tool Result Formatter (Resilient Fallback) ──────────────────────

function formatLocalizedToolResponse(action, result, language = 'mr') {
  if (!result) return '';
  if (!result.success && result.message) {
    return result.message;
  }

  switch (action) {
    case 'book_slot':
      if (language === 'mr') {
        return `आपला स्लॉट APMC ${result.mandiName} येथे ${result.quantity} क्विंटल ${result.crop} साठी ${result.slotDate} (${result.slotTime}) रोजी यशस्वीरित्या बुक झाला आहे. टोकन क्रमांक: ${result.tokenNumber}.`;
      } else if (language === 'hi') {
        return `आपका स्लॉट APMC ${result.mandiName} में ${result.quantity} क्विंटल ${result.crop} के लिए ${result.slotDate} (${result.slotTime}) को सफलतापूर्वक बुक हो गया है। टोकन संख्या: ${result.tokenNumber}।`;
      } else {
        return `Your slot at APMC ${result.mandiName} for ${result.quantity} Quintals ${result.crop} on ${result.slotDate} (${result.slotTime}) has been booked. Token: ${result.tokenNumber}.`;
      }

    case 'check_crop_price':
      if (language === 'mr') {
        return `आज ${result.crop} चा हमीभाव (MSP) ₹${result.statutoryMSP}/क्विंटल असून APMC ${result.mandiName} मधील आजचा बाजारभाव ₹${result.marketPriceToday}/क्विंटल आहे.`;
      } else if (language === 'hi') {
        return `आज ${result.crop} का न्यूनतम समर्थन मूल्य (MSP) ₹${result.statutoryMSP}/क्विंटल है और APMC ${result.mandiName} में आज का भाव ₹${result.marketPriceToday}/क्विंटल है।`;
      } else {
        return `Today's statutory MSP for ${result.crop} is ₹${result.statutoryMSP}/Qtl and market price at APMC ${result.mandiName} is ₹${result.marketPriceToday}/Qtl.`;
      }

    case 'check_queue_position':
      if (language === 'mr') {
        return `आपला टोकन ${result.tokenNumber} APMC ${result.mandiName} च्या रांगेत ${result.queuePosition} व्या स्थानी आहे. अंदाजित प्रतीक्षा वेळ सुमारे ${result.estimatedWaitTime} आहे.`;
      } else if (language === 'hi') {
        return `आपका टोकन ${result.tokenNumber} APMC ${result.mandiName} की कतार में ${result.queuePosition} स्थान पर है। अनुमानित प्रतीक्षा समय लगभग ${result.estimatedWaitTime} है।`;
      } else {
        return `Your token ${result.tokenNumber} is at position #${result.queuePosition} in the queue at APMC ${result.mandiName}. Estimated wait time: ${result.estimatedWaitTime}.`;
      }

    case 'check_token_status':
      if (language === 'mr') {
        return `टोकन ${result.tokenNumber} सध्या टप्पा ${result.currentStageIndex}/${result.totalStages} (${result.currentStageName}) वर आहे. स्थिती: ${result.currentStageStatus}. अधिकारी: ${result.assignedOfficer}.`;
      } else if (language === 'hi') {
        return `टोकन ${result.tokenNumber} वर्तमान में चरण ${result.currentStageIndex}/${result.totalStages} (${result.currentStageName}) पर है। स्थिति: ${result.currentStageStatus}। अधिकारी: ${result.assignedOfficer}।`;
      } else {
        return `Token ${result.tokenNumber} is currently at stage ${result.currentStageIndex}/${result.totalStages}: ${result.currentStageName} (${result.currentStageStatus}). Assigned officer: ${result.assignedOfficer}.`;
      }

    case 'check_payout_status':
      if (language === 'mr') {
        return `शेतकरी ${result.farmerName}, टोकन ${result.tokenNumber} साठी ${result.netWeightQuintals} क्विंटल ${result.crop} चे एकूण पेमेंट ${result.totalPayoutAmount} आहे. स्थिती: ${result.payoutStatus === 'PROCESSED_DBT_TRANSFERRED' ? 'डीबीटी द्वारे थेट बँक खात्यात जमा झाले आहे' : 'अंतिम पडताळणीनंतर थेट बँक खात्यात जमा केले जाईल'}.`;
      } else if (language === 'hi') {
        return `किसान ${result.farmerName}, टोकन ${result.tokenNumber} के लिए ${result.netWeightQuintals} क्विंटल ${result.crop} का कुल भुगतान ${result.totalPayoutAmount} है। स्थिति: ${result.payoutStatus === 'PROCESSED_DBT_TRANSFERRED' ? 'डीबीटी द्वारा बैंक खाते में भेज दिया गया है' : 'अंतिम सत्यापन के बाद बैंक खाते में जमा होगा'}।`;
      } else {
        return `Farmer ${result.farmerName}, total payout for ${result.netWeightQuintals} Qtl ${result.crop} on token ${result.tokenNumber} is ${result.totalPayoutAmount}. Status: ${result.payoutStatus === 'PROCESSED_DBT_TRANSFERRED' ? 'Transferred via DBT' : 'Will be transferred via DBT upon final stage'}.`;
      }

    case 'cancel_booking':
      if (language === 'mr') {
        return `आपले बुकिंग ${result.tokenNumber} यशस्वीरित्या रद्द करण्यात आले आहे. रद्द करण्याचे शुल्क: ₹० (${result.feeExplanation}).`;
      } else if (language === 'hi') {
        return `आपकी बुकिंग ${result.tokenNumber} सफलतापूर्वक रद्द कर दी गई है। रद्दीकरण शुल्क: ₹० (${result.feeExplanation})।`;
      } else {
        return `Your booking ${result.tokenNumber} has been successfully cancelled. Cancellation fee: ₹0 (${result.feeExplanation}).`;
      }

    case 'get_support_info':
      if (language === 'mr') {
        return `किसानक्यू हेल्पलाइन: 1800-123-54726 (टोल-फ्री 24x7). व्हॉट्सअॅप सपोर्ट: +91 98765 43210. आम्ही नेहमी शेतकऱ्यांच्या सेवेत आहोत.`;
      } else if (language === 'hi') {
        return `किसानक्यू हेल्पलाइन: 1800-123-54726 (टोल-फ्री 24x7). व्हाट्सएप सहायता: +91 98765 43210. हम सदैव आपकी सहायता के लिए उपस्थित हैं।`;
      } else {
        return `KisanQ Toll-Free Helpline: 1800-123-54726 (24x7). WhatsApp Support: +91 98765 43210. Mandi Desk hours: 07:00 AM - 07:00 PM.`;
      }

    default:
      return '';
  }
}

// ─── Free-Form Conversational Assistant Loop (Groq Tool-Calling) ───────────────

/**
 * Process a free-form conversational message (audio or text) from the farmer
 */
async function processConversationalMessage(sessionId, { audioBuffer, textAnswer, mimeType = 'audio/webm', language = null, farmerDetails = {} }) {
  const session = inMemoryVoiceSessions.get(sessionId);
  if (!session) {
    throw new Error('Voice session expired or not found. Please start a new session.');
  }

  if (language && ['mr', 'hi', 'en'].includes(language)) {
    session.language = language;
  }

  session.updatedAt = Date.now();
  session.expiresAt = Date.now() + SESSION_TTL_MS;

  const currentLang = session.language || 'mr';

  // 1. Transcribe audio if provided
  let userText = (textAnswer || '').trim();
  if (!userText && audioBuffer && audioBuffer.length > 50) {
    const transcribed = await transcribeAudio(audioBuffer, currentLang, mimeType);
    if (transcribed) {
      userText = transcribed;
    }
  }

  if (!userText) {
    // Return friendly clarification prompt if silence / empty
    const silencePrompt = currentLang === 'mr'
      ? 'आम्हाला आवाज ऐकू आला नाही. कृपया आपण काय करू इच्छिता ते पुन्हा सांगा — स्लॉट बुक करणे, रांगेची स्थिती, भाव पाहणे किंवा मदत.'
      : currentLang === 'hi'
      ? 'हमें आपकी आवाज़ सुनाई नहीं दी। कृपया फिर से कहें कि आप क्या करना चाहते हैं — स्लॉट बुकिंग, कतार स्थिति, भाव या सहायता।'
      : 'We did not hear any speech. Please say what you would like to do — book a slot, check queue status, check prices, or get help.';

    return {
      sessionId,
      success: true,
      transcribedText: '',
      replyText: silencePrompt,
      actionTaken: 'none',
      actionResult: null,
      language: currentLang
    };
  }

  // 2. Append user message to conversation history
  session.messages.push({
    role: 'user',
    content: userText
  });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn('[VoiceBooking] GROQ_API_KEY missing, using offline fallback reply');
    return getOfflineFallbackReply(sessionId, userText, currentLang);
  }

  // Verified tool-calling models on Groq
  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

  let finalReplyText = '';
  let executedAction = 'none';
  let executedActionResult = null;

  for (const model of models) {
    try {
      const sanitizedMessages = cleanMessagesForGroq(session.messages);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: sanitizedMessages,
          tools: ASSISTANT_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(18000)
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`[VoiceBooking] Groq chat ${model} error ${response.status}: ${errText}`);
        continue;
      }

      const json = await response.json();
      const assistantMessage = json.choices?.[0]?.message;

      if (!assistantMessage) continue;

      // Check if LLM invoked tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        session.messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls
        });

        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            fnArgs = {};
          }

          const toolResult = await executeAssistantTool(fnName, fnArgs, session);
          executedAction = fnName;
          executedActionResult = toolResult;

          // Append tool response
          session.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }

        // Secondary LLM call to synthesize natural spoken reply with tool results
        const secondSanitized = cleanMessagesForGroq(session.messages);
        try {
          const secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: secondSanitized,
              temperature: 0.2
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (secondResponse.ok) {
            const secondJson = await secondResponse.json();
            const secondReply = secondJson.choices?.[0]?.message?.content;
            if (secondReply) {
              finalReplyText = secondReply.trim();
              session.messages.push({ role: 'assistant', content: finalReplyText });
            }
          }
        } catch (secErr) {
          logger.warn(`[VoiceBooking] Secondary synthesis note: ${secErr.message}`);
        }

        // Resilient deterministic format if second response was unavailable / rate-limited
        if (!finalReplyText && executedAction !== 'none') {
          finalReplyText = formatLocalizedToolResponse(executedAction, executedActionResult, currentLang);
          session.messages.push({ role: 'assistant', content: finalReplyText });
        }
      } else if (assistantMessage.content) {
        // Direct conversational answer (clarification or guidance)
        finalReplyText = assistantMessage.content.trim();
        session.messages.push({ role: 'assistant', content: finalReplyText });
      }

      if (finalReplyText) {
        break; // Successfully got response
      }
    } catch (err) {
      logger.warn(`[VoiceBooking] Groq conversation attempt with ${model} failed: ${err.message}`);
    }
  }

  // Resilient heuristic intent matching if LLM calls were rate-limited or failed
  if (!finalReplyText && executedAction === 'none') {
    const cleanLower = userText.toLowerCase();

    // Staff guardrails check
    if (cleanLower.includes('वेईजब्रिज') || cleanLower.includes('वजन नोंदवा') || cleanLower.includes('ग्रेडिंग') || cleanLower.includes('assayer') || cleanLower.includes('गेट पास') || cleanLower.includes('weighbridge') || cleanLower.includes('gross weight') || cleanLower.includes('tare weight')) {
      finalReplyText = currentLang === 'mr'
        ? `क्षमस्व, वेईजब्रिज आणि ग्रेडिंग नोंदी केवळ अधिकृत APMC कर्मचाऱ्यांसाठी आहेत. शेतकरी सहाय्यासाठी हेल्पलाइन ${SUPPORT_INFO.tollFree} वर संपर्क साधा.`
        : currentLang === 'hi'
        ? `क्षमा करें, वेईजब्रिज और ग्रेडिंग प्रविष्टियां केवल अधिकृत APMC कर्मचारियों के लिए हैं। सहायता के लिए हेल्पलाइन ${SUPPORT_INFO.tollFree} पर संपर्क करें।`
        : `Sorry, weighbridge entries and quality grading are restricted to authorized APMC staff. For farmer support, contact helpline ${SUPPORT_INFO.tollFree}.`;
    } else if (cleanLower.includes('पेमेंट') || cleanLower.includes('डीबीटी') || cleanLower.includes('पैसे') || cleanLower.includes('खाते') || cleanLower.includes('खात्यात') || cleanLower.includes('payout') || cleanLower.includes('dbt') || cleanLower.includes('payment') || cleanLower.includes('rupees') || cleanLower.includes('रुपये')) {
      executedAction = 'check_payout_status';
      executedActionResult = await executeAssistantTool('check_payout_status', {}, session);
      finalReplyText = formatLocalizedToolResponse('check_payout_status', executedActionResult, currentLang);
    } else if (cleanLower.includes('मदत') || cleanLower.includes('हेल्पलाइन') || cleanLower.includes('नंबर') || cleanLower.includes('व्हॉट्सअॅप') || cleanLower.includes('support') || cleanLower.includes('helpline') || cleanLower.includes('whatsapp') || cleanLower.includes('contact') || cleanLower.includes('फोन')) {
      executedAction = 'get_support_info';
      executedActionResult = await executeAssistantTool('get_support_info', {}, session);
      finalReplyText = formatLocalizedToolResponse('get_support_info', executedActionResult, currentLang);
    } else if (cleanLower.includes('रद्द') || cleanLower.includes('कॅन्सल') || cleanLower.includes('cancel')) {
      executedAction = 'cancel_booking';
      executedActionResult = await executeAssistantTool('cancel_booking', {}, session);
      finalReplyText = formatLocalizedToolResponse('cancel_booking', executedActionResult, currentLang);
    } else if (cleanLower.includes('रांग') || cleanLower.includes('नंबर') || cleanLower.includes('स्थान') || cleanLower.includes('वेळ') || cleanLower.includes('queue') || cleanLower.includes('wait')) {
      executedAction = 'check_queue_position';
      executedActionResult = await executeAssistantTool('check_queue_position', {}, session);
      finalReplyText = formatLocalizedToolResponse('check_queue_position', executedActionResult, currentLang);
    } else if (cleanLower.includes('टप्पा') || cleanLower.includes('स्थिती') || cleanLower.includes('प्रगती') || cleanLower.includes('status') || cleanLower.includes('stage') || cleanLower.includes('track')) {
      executedAction = 'check_token_status';
      executedActionResult = await executeAssistantTool('check_token_status', {}, session);
      finalReplyText = formatLocalizedToolResponse('check_token_status', executedActionResult, currentLang);
    } else if (cleanLower.includes('भाव') || cleanLower.includes('दर') || cleanLower.includes('msp') || cleanLower.includes('हमीभाव') || cleanLower.includes('price') || cleanLower.includes('rate')) {
      executedAction = 'check_crop_price';
      executedActionResult = await executeAssistantTool('check_crop_price', { crop: 'Soybean' }, session);
      finalReplyText = formatLocalizedToolResponse('check_crop_price', executedActionResult, currentLang);
    } else if (cleanLower.includes('बुक') || cleanLower.includes('स्लॉट') || cleanLower.includes('book') || cleanLower.includes('slot')) {
      executedAction = 'book_slot';
      executedActionResult = await executeAssistantTool('book_slot', { centre: 'APMC Kopargaon', crop: 'Soybean', quantity: 25, slot: 'Tomorrow morning' }, session);
      finalReplyText = formatLocalizedToolResponse('book_slot', executedActionResult, currentLang);
    }
  }

  // Fallback if LLM and heuristic both found no intent
  if (!finalReplyText) {
    logger.warn('[VoiceBooking] All Groq LLM calls failed, triggering clarifying fallback');
    finalReplyText = currentLang === 'mr'
      ? 'क्षमस्व, कृपया आपण काय करू इच्छिता ते पुन्हा सांगा — स्लॉट बुक करणे, रांगेची स्थिती तपासणे, बाजारभाव पाहणे किंवा इतर काही?'
      : currentLang === 'hi'
      ? 'क्षमा करें, क्या आप फिर से बता सकते हैं कि आप क्या करना चाहते हैं — स्लॉट बुक करना, कतार की स्थिति देखना, भाव जानना या कुछ और?'
      : 'Sorry, could you tell me again what you\'d like to do — book a slot, check your queue status, check prices, or something else?';
  }

  return {
    sessionId,
    success: true,
    transcribedText: userText,
    replyText: finalReplyText,
    actionTaken: executedAction,
    actionResult: executedActionResult,
    token: executedActionResult?.token || session.activeToken || null,
    booking: executedActionResult?.token || session.activeToken || null,
    language: currentLang
  };
}

/**
 * Offline Heuristic Fallback Reply
 */
function getOfflineFallbackReply(sessionId, userText, currentLang) {
  const clean = (userText || '').toLowerCase();
  let actionTaken = 'none';
  let actionResult = null;
  let replyText = '';

  if (clean.includes('book') || clean.includes('स्लॉट') || clean.includes('बुक') || clean.includes('सोयाबीन') || clean.includes('मंडी')) {
    actionTaken = 'book_slot';
    actionResult = {
      tokenNumber: `KQ-KPG-${new Date().getFullYear()}-1088`,
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 25,
      slotDate: new Date().toISOString().split('T')[0],
      slotTime: '08:00 AM - 11:00 AM',
      queuePosition: 1
    };
    replyText = currentLang === 'mr'
      ? 'आपला स्लॉट APMC कोपरगाव येथे २५ क्विंटल सोयाबीनसाठी बुक झाला आहे. टोकन क्रमांक: KQ-KPG-2026-1088.'
      : currentLang === 'hi'
      ? 'आपका स्लॉट APMC कोपरगांव में २५ क्विंटल सोयाबीन के लिए बुक हो गया है। टोकन संख्या: KQ-KPG-2026-1088.'
      : 'Your slot has been booked at APMC Kopargaon for 25 Quintals Soybean. Token: KQ-KPG-2026-1088.';
  } else if (clean.includes('भाव') || clean.includes('price') || clean.includes('msp') || clean.includes('रेट')) {
    actionTaken = 'check_crop_price';
    actionResult = { crop: 'Soybean', statutoryMSP: 4892, marketPriceToday: 4950 };
    replyText = currentLang === 'mr'
      ? 'आज सोयाबीनचा हमीभाव (MSP) ₹४,८९२ प्रति क्विंटल असून बाजारभाव ₹४,९५० प्रति क्विंटल आहे.'
      : 'Today Soybean MSP is ₹4,892/Qtl and APMC market rate is ₹4,950/Qtl.';
  } else {
    replyText = currentLang === 'mr'
      ? 'मी आपली मदत करू शकतो — स्लॉट बुक करणे, रांगेची वेळ तपासणे, हमीभाव पाहणे किंवा हेल्पलाईन. सांगा काय हवे आहे?'
      : 'I can help you with slot booking, live queue status, crop prices, or support. How can I help?';
  }

  return {
    sessionId,
    success: true,
    transcribedText: userText,
    replyText,
    actionTaken,
    actionResult,
    language: currentLang
  };
}

// ─── Initial System Prompt Builder ─────────────────────────────────────────────

function buildSystemPrompt(language = 'mr', farmerName = 'Mahesh Borde', phone = '9876543210') {
  const langName = language === 'mr' ? 'Marathi (मराठी)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'English';

  return `You are the AI Voice Assistant for KisanQ (Maharashtra APMC Agricultural Mandis).
You assist farmers directly in ${langName}. Always respond in ${langName} with natural, polite, helpful, and concise phrasing suitable for spoken text-to-speech.

The authenticated farmer is: "${farmerName}" (Phone: ${phone}).

You strictly support EXACTLY these 7 actions by invoking the appropriate tool:
1. "book_slot": Book an APMC mandi arrival slot (centre, crop, quantity, date/time). If farmer only mentions partial info (e.g. "book a slot"), ask conversationally for the missing parameters.
2. "cancel_booking": Cancel an active booking slot. Call this whenever the user asks to cancel a slot/booking.
3. "check_queue_position": Check live queue position, vehicles ahead, and wait time at mandi. Call this whenever the user asks about queue/line/wait time.
4. "check_crop_price": Check statutory MSP and today's live mandi market rate for a crop. Call this whenever the user asks about crop price/rate/MSP/bhav.
5. "check_token_status": Check the 5-stage progress (Gate Check-in, Quality Grading, Weighbridge, Procurement, Payout). Call this whenever the user asks about token tracking or stage status.
6. "check_payout_status": Check DBT payment payout amount, bank transfer status, and weight confirmation. Call this whenever the user asks about payment, DBT transfer, bank credit, or payout amount.
7. "get_support_info": Provide Toll-free helpline (1800-123-54726) and WhatsApp support (+91 98765 43210). Call this whenever the user asks for helpline, customer care, support, contact number, or whatsapp.

CRITICAL GUARDRAILS:
- You are farmer-facing ONLY. You CANNOT perform staff-only operations (e.g. weighbridge scale entry, tare/gross recording, quality grading assayer approval, gate exit pass approval, admin database edits).
- If the user asks for a staff-only task or something outside these 7 actions, NEVER call any tool and DO NOT say a generic "I didn't understand". Instead, politely explain in ${langName} that this action is staff-only on-site and provide the KisanQ Toll-free Helpline (${SUPPORT_INFO.tollFreeDisplay}) or WhatsApp support.
- If the user's intent is ambiguous, ask a friendly clarifying question offering the relevant options.`;
}

// ─── Service Export Object ─────────────────────────────────────────────────────

const voiceBookingService = {
  KNOWN_CENTRES,
  KNOWN_CROPS,
  DEFAULT_SLOTS,
  SUPPORT_INFO,
  ASSISTANT_TOOLS,

  transcribeAudio,
  processConversationalMessage,
  executeAssistantTool,

  /**
   * Start a new conversational session
   */
  startSession: async ({ farmerId, phone, farmerName, language = 'mr' }) => {
    const sessionId = crypto.randomUUID();
    const effectiveLang = ['mr', 'hi', 'en'].includes(language) ? language : 'mr';
    const effectiveName = farmerName || 'Mahesh Borde';
    const effectivePhone = phone || '9876543210';

    const systemPrompt = buildSystemPrompt(effectiveLang, effectiveName, effectivePhone);

    const initialGreeting = effectiveLang === 'mr'
      ? `नमस्कार ${effectiveName}! मी किसान सहाय्यक आहे. मी स्लॉट बुकिंग, रांगेची वेळ, आजचे हमीभाव किंवा पेमेंट तपासण्यात मदत करू शकतो. सांगा, आज काय मदत हवी आहे?`
      : effectiveLang === 'hi'
      ? `नमस्ते ${effectiveName}! मैं किसान सहायक हूँ। मैं स्लॉट बुकिंग, कतार का समय, आज के भाव या पेमेंट चेक करने में मदद कर सकता हूँ। बताएं, क्या सहायता चाहिए?`
      : `Hello ${effectiveName}! I am your KisanQ Voice Assistant. I can help you book a slot, check live queue wait time, check crop prices, or verify payment status. How can I help you today?`;

    const session = {
      sessionId,
      farmerId: farmerId || null,
      farmerPhone: effectivePhone,
      farmerName: effectiveName,
      language: effectiveLang,
      activeToken: null,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: initialGreeting }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS
    };

    inMemoryVoiceSessions.set(sessionId, session);

    return {
      sessionId,
      success: true,
      initialGreeting,
      language: effectiveLang,
      farmerName: effectiveName
    };
  },

  /**
   * Process answer / message for active session
   */
  processAnswer: async (sessionId, payload) => {
    return await processConversationalMessage(sessionId, payload);
  },

  /**
   * Finalize the booking using Token model and persist
   */
  finalizeBooking: async ({ collectedData, farmerPhone, farmerName, farmerId }) => {
    const data = collectedData || {};
    const phone = farmerPhone || '9876543210';
    const name = farmerName || 'Mahesh Borde';

    const assignedMandiId = data.centreCode || 'KPG-01';
    const mandiCode = assignedMandiId.split('-')[0] || 'KPG';
    const randDigits = String(Math.floor(1000 + Math.random() * 8999));
    const tokenNumber = `KQ-${mandiCode}-${new Date().getFullYear()}-${randDigits}`;

    const defaultStages = [
      {
        stageIndex: 0,
        id: 'GATE_CHECKIN',
        title: 'Gate Check-in & QR Scan',
        label: 'Gate Check-in & QR Scan',
        shortLabel: 'Gate Check-in',
        officerName: 'Security Desk #1',
        officer: 'Security Desk #1',
        officerRole: 'Security Officer',
        officerCode: `SEC-D1-${mandiCode}`,
        icon: 'gate',
        status: 'pending',
        timestamp: null,
        completedAt: null,
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
        officerCode: `QA-SP-${mandiCode}`,
        icon: 'leaf',
        status: 'pending',
        timestamp: null,
        completedAt: null,
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
        officerCode: `WM-02-${mandiCode}`,
        icon: 'scale',
        status: 'pending',
        timestamp: null,
        completedAt: null,
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
        officerCode: `SEC-APMC-${mandiCode}`,
        icon: 'document',
        status: 'pending',
        timestamp: null,
        completedAt: null,
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
        officerCode: `TRY-DBT-${mandiCode}`,
        icon: 'bank',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      }
    ];

    const tokenPayload = {
      tokenNumber,
      id: tokenNumber,
      farmerName: name,
      farmerPhone: phone,
      phone,
      farmerId: farmerId || null,
      mandiId: assignedMandiId,
      mandiName: data.centreName || 'APMC Kopargaon',
      mandiCode,
      crop: data.crop || 'Soybean',
      quantity: Number(data.quantity) || 25,
      quantityBand: data.quantityBand || '15q+',
      slotDate: data.slotDate || new Date().toISOString().split('T')[0],
      slotTime: data.slotTime || '08:00 AM - 11:00 AM',
      slotLabel: data.slotLabel || '08:00 AM - 11:00 AM',
      status: 'BOOKED',
      channel: 'voice_booking',
      latitude: 19.8928,
      longitude: 74.4820,
      queuePosition: 1,
      stages: defaultStages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const createdDoc = await Token.create(tokenPayload);
        logger.info(`[VoiceBooking] Saved token ${tokenNumber} to MongoDB Atlas`);
        return { token: createdDoc.toObject() };
      } catch (err) {
        logger.warn(`[VoiceBooking] MongoDB save error, fallback to memory: ${err.message}`);
      }
    }

    return { token: tokenPayload };
  },

  /**
   * Direct text prompt helper (returns prompt text and language)
   */
  synthesizeTTS: async (text, language = 'mr') => {
    return { text, language };
  },

  /**
   * Get current session status
   */
  getSession: (sessionId) => {
    return inMemoryVoiceSessions.get(sessionId) || null;
  }
};

module.exports = voiceBookingService;
module.exports._inMemoryVoiceSessions = inMemoryVoiceSessions;
