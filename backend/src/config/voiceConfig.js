/**
 * KisanQ Voice Booking Central Configuration & Normalization Engine
 * 
 * Hierarchy:
 * 1. Groq (Primary STT: whisper-large-v3-turbo, Primary NLU: openai/gpt-oss-20b)
 * 2. Gemini (Fallback NLU: gemini-3.6-flash)
 * 3. Deterministic Rule-Based Engine (Regex & Dictionary as last resort)
 * 
 * Safety: Never crashes on empty/missing API keys or malformed inputs.
 */

const logger = require('../utils/logger');

// ─── Environment & Model Configuration ──────────────────────────────────────────

const VOICE_CONFIG = {
  // STT Configuration
  stt: {
    provider: process.env.VOICE_STT_PROVIDER || 'groq',
    groqModel: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
    timeoutMs: Number(process.env.VOICE_STT_TIMEOUT_MS) || 12000
  },

  // NLU / LLM Configuration
  nlu: {
    primaryProvider: 'groq',
    groqModels: (process.env.GROQ_NLU_MODELS || 'openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b').split(',').map((s) => s.trim()),
    groqTemperature: 0.1,
    fallbackProvider: 'gemini',
    geminiModel: process.env.GEMINI_NLU_MODEL || 'gemini-3.6-flash',
    geminiTemperature: 0.1,
    ruleBasedFallback: true
  }
};

// ─── Canonical Master Data ─────────────────────────────────────────────────────

const CANONICAL_CENTRES = [
  {
    code: 'KPG-01',
    id: 'KPG-01',
    canonicalName: 'APMC Kopargaon',
    nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती',
    nameHindi: 'कोपरगांव कृषि उपज मंडी',
    keywords: [
      'kopargaon', 'kopergaon', 'kopargao', 'kopergao', 'kopergav', 'kopargav', 'kopargaon apmc',
      'कोपरगाव', 'कोपरगांव', 'कोपरगांवा', 'कोपरगावात', 'कोपरगावला', 'कोपरगावं', 'कोपरगाँव', 'कोपरगाव मंडी', 'कोपरगाव बाजार'
    ]
  },
  {
    code: 'SRD-02',
    id: 'SRD-02',
    canonicalName: 'APMC Shirdi',
    nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती',
    nameHindi: 'शिर्डी कृषि उपज मंडी',
    keywords: [
      'shirdi', 'sirdi', 'shiridi', 'shirdi apmc', 'sainagar shirdi',
      'शिर्डी', 'शिरडी', 'शिरडीला', 'शिर्डीला', 'शिर्डीत', 'शिरडीत', 'शिर्डी मंडी', 'शिरडी मंडी', 'साईनगर शिर्डी', 'शिरडी बाजार', 'शिर्डी बाजार'
    ]
  },
  {
    code: 'RHT-03',
    id: 'RHT-03',
    canonicalName: 'APMC Rahata',
    nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती',
    nameHindi: 'राहाता कृषि उपज मंडी',
    keywords: [
      'rahata', 'rahta', 'rahata apmc', 'rahat',
      'रहाता', 'राहाता', 'राहता', 'रहात्याला', 'राहात्याला', 'राहात्यात', 'राहत्याला', 'राहत्यात', 'रहाता मंडी', 'राहाता मंडी', 'राहता मंडी', 'रहाता बाजार', 'राहाता बाजार', 'राहता बाजार'
    ]
  },
  {
    code: 'VJP-04',
    id: 'VJP-04',
    canonicalName: 'APMC Vaijapur',
    nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती',
    nameHindi: 'वैजापुर कृषि उपज मंडी',
    keywords: [
      'vaijapur', 'vaizapur', 'vyjapur', 'vaijapur apmc',
      'वैजापूर', 'वैजापुर', 'वैजापूरला', 'वैजापुरात', 'वैजापुरला', 'वैजापुरात', 'वैजापूर मंडी', 'वैजापुर मंडी', 'वैजापूर बाजार'
    ]
  },
  {
    code: 'SRP-05',
    id: 'SRP-05',
    canonicalName: 'APMC Shrirampur',
    nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती',
    nameHindi: 'श्रीरामपुर कृषि उपज मंडी',
    keywords: [
      'shrirampur', 'shreerampur', 'srirampur', 'shrirampur apmc', 'sangamner', 'sangamner apmc',
      'श्रीरामपूर', 'श्रीरामपुर', 'श्रीरामपूरला', 'श्रीरामपुरात', 'श्रीरामपुरला', 'श्रीरामपुरात', 'श्रीरामपूर मंडी', 'श्रीरामपुर मंडी', 'संगमनेर', 'संगमनेरला'
    ]
  },
  {
    code: 'LSG-06',
    id: 'LSG-06',
    canonicalName: 'APMC Lasalgaon',
    nameMarathi: 'लासलगाव कांदा बाजार समिती',
    nameHindi: 'लासलगांव प्याज मंडी',
    keywords: [
      'lasalgaon', 'lasalganw', 'lasalgoan', 'lasalgaon apmc',
      'लासलगाव', 'लासलगांव', 'लासलगावात', 'लासलगावला', 'लासलगावं', 'लासलगांवला', 'लासलगाव मंडी', 'लासलगाव बाजार'
    ]
  }
];

const CANONICAL_CROPS = [
  {
    id: 'Soybean',
    canonicalName: 'Soybean',
    nameMarathi: 'सोयाबीन',
    nameHindi: 'सोयाबीन',
    keywords: [
      'soybean', 'soya', 'soyabean', 'soya bean', 'soya-bean', 'soybeans',
      'सोयाबीन', 'सोया', 'सोयाबिन', 'सोयाबीनची', 'सोयाबीनचे', 'सोयाबीनला'
    ]
  },
  {
    id: 'Cotton',
    canonicalName: 'Cotton',
    nameMarathi: 'कापूस',
    nameHindi: 'कपास',
    keywords: [
      'cotton', 'kapas', 'kapus', 'raw cotton',
      'कापूस', 'कपास', 'कापसाची', 'कापसाचे', 'कापुस', 'कपाशी', 'कपाशीची'
    ]
  },
  {
    id: 'Wheat',
    canonicalName: 'Wheat',
    nameMarathi: 'गहू',
    nameHindi: 'गेहूं',
    keywords: [
      'wheat', 'gehu', 'gahu', 'lokwan', 'sharbati',
      'गहू', 'गेहूं', 'गव्हाची', 'गव्हाचे', 'गव्हा', 'गेहू', 'गहूची', 'गहूचे'
    ]
  },
  {
    id: 'Onion',
    canonicalName: 'Onion',
    nameMarathi: 'कांदा',
    nameHindi: 'प्याज',
    keywords: [
      'onion', 'kanda', 'pyaj', 'pyaz', 'red onion', 'lal kanda', 'onion red', 'onions',
      'कांदा', 'प्याज', 'कांद्याची', 'कांदे', 'कांद्याचे', 'लाल कांदा', 'कांद्या'
    ]
  },
  {
    id: 'Maize',
    canonicalName: 'Maize',
    nameMarathi: 'मका',
    nameHindi: 'मक्का',
    keywords: [
      'maize', 'corn', 'maka', 'makka', 'yellow corn',
      'मका', 'मक्का', 'मक्याची', 'मक्याचे', 'मकाची', 'मकाचे'
    ]
  },
  {
    id: 'Chana',
    canonicalName: 'Chana',
    nameMarathi: 'हरभरा',
    nameHindi: 'चना',
    keywords: [
      'chana', 'harbhara', 'gram', 'bengal gram', 'chana dal', 'chana-dal', 'harbara',
      'हरभरा', 'चना', 'हरभऱ्याची', 'हरभरे', 'हरभऱ्याचे', 'हरबरा', 'हरबऱ्याची', 'चने'
    ]
  }
];

const CANONICAL_SLOTS = [
  {
    id: 'S1',
    label: 'Morning  08:00 – 11:00 AM',
    slotLabel: '08:00 AM - 11:00 AM',
    start: '08:00',
    end: '11:00',
    keywords: ['morning', 'sakali', 'subah', 'सकाळी', 'सुबह', 'सकाळ', '8', '8 to 11', '8-11', 'pahila', 'पहिला', 'पहिली', 'पहिला स्लॉट']
  },
  {
    id: 'S2',
    label: 'Midday   11:00 AM – 02:00 PM',
    slotLabel: '11:00 AM - 02:00 PM',
    start: '11:00',
    end: '14:00',
    keywords: ['midday', 'noon', 'dupari', 'dopahar', 'दुपारी', 'दोपहर', 'dupar', '11', '11 to 2', '11-2', 'dusra', 'दूसरा', 'दुसरी', 'दुपारचा']
  },
  {
    id: 'S3',
    label: 'Afternoon 02:00 – 05:00 PM',
    slotLabel: '02:00 PM - 05:00 PM',
    start: '14:00',
    end: '17:00',
    keywords: ['afternoon', 'evening', 'sandhyakali', 'sham', 'संध्याकाळी', 'शाम', 'tisra', 'तीसरा', 'तीसरी', '2 to 5', '2-5', '2']
  }
];

// ─── Normalizer Utilities ──────────────────────────────────────────────────────

/**
 * Convert Devanagari numerals to standard Arabic numerals
 */
function convertDevanagariDigits(str) {
  if (!str) return str;
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(devanagariDigits[i], 'g'), String(i));
  }
  return result;
}

/**
 * Checks if a keyword matches within a given text string using strict word boundary rules.
 * Latin tokens match only on ASCII word boundaries \b, preventing substrings like 'gram' matching 'kilogram'.
 * Non-ASCII (Devanagari/Indic) tokens match on Unicode / whitespace / punctuation boundaries.
 */
function matchesKeyword(text, kw) {
  if (!text || !kw) return false;
  const clean = text.toLowerCase();
  const kwLower = kw.toLowerCase().trim();
  if (clean === kwLower) return true;

  // Latin tokens (letters, numbers, hyphens, spaces)
  if (/^[a-z0-9\s-]+$/i.test(kwLower)) {
    const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(clean);
  }

  // Devanagari / Indic tokens: match on start/end, whitespace, or punctuation
  const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu');
  return regex.test(clean);
}

/**
 * Normalizes centre name or text input.
 * CRITICAL RULE: Never accept a list of multiple centres as one centre.
 * Returns:
 * - { success: true, centre: { code, id, name, nameMarathi, nameHindi } } when exactly one centre matched
 * - { success: false, error: 'ambiguous_multiple_centres', candidates: [...] } when multiple centres found
 * - null when no centre matched
 */
function normalizeCentre(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  // First check exact code match
  for (const c of CANONICAL_CENTRES) {
    if (clean === c.code.toLowerCase() || clean === c.id.toLowerCase()) {
      return {
        success: true,
        centre: {
          code: c.code,
          id: c.id,
          name: c.canonicalName,
          nameMarathi: c.nameMarathi,
          nameHindi: c.nameHindi
        }
      };
    }
  }

  // Find all matched distinct centres in the text
  const matchedList = [];
  for (const c of CANONICAL_CENTRES) {
    const isMatched = c.keywords.some((kw) => matchesKeyword(clean, kw));

    if (isMatched && !matchedList.some((m) => m.code === c.code)) {
      matchedList.push({
        code: c.code,
        id: c.id,
        name: c.canonicalName,
        nameMarathi: c.nameMarathi,
        nameHindi: c.nameHindi
      });
    }
  }

  if (matchedList.length === 1) {
    return {
      success: true,
      centre: matchedList[0]
    };
  }

  if (matchedList.length > 1) {
    // Explicitly reject a list of multiple centres as a single selection
    return {
      success: false,
      error: 'ambiguous_multiple_centres',
      message: 'Multiple centres detected in input. Please select a single centre.',
      candidates: matchedList
    };
  }

  return null;
}

/**
 * Normalizes crop text input to canonical crop.
 * Uses strict word boundary matching to ensure 'gram' does not match 'kilogram'.
 */
function normalizeCrop(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  for (const c of CANONICAL_CROPS) {
    const isMatched = c.keywords.some((kw) => matchesKeyword(clean, kw));

    if (isMatched) {
      return {
        id: c.id,
        name: c.canonicalName,
        nameMarathi: c.nameMarathi,
        nameHindi: c.nameHindi
      };
    }
  }

  return null;
}

/**
 * Normalizes quantity strings like "25 Quintal", "25 क्विंटल", "२५ क्विंटल", "30 tons", "500 kg" into numeric Quintals.
 * Short Latin tokens like 'q', 'qt', 'qtl' are strictly bounded to avoid matching words like 'quick'.
 */
function normalizeQuantity(textOrNum) {
  if (typeof textOrNum === 'number' && !isNaN(textOrNum) && textOrNum > 0) {
    return Math.round(textOrNum * 100) / 100;
  }
  if (!textOrNum) return null;

  let str = convertDevanagariDigits(String(textOrNum)).toLowerCase().trim();

  // Check ton / tonne multiplier (1 ton = 10 quintals)
  const tonMatch = str.match(/([\d.]+)\s*(?:\b(?:ton|tons|tonnes?)\b|टन)/i);
  if (tonMatch) {
    const val = parseFloat(tonMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 10 * 100) / 100;
  }

  // Check kg multiplier (100 kg = 1 quintal)
  const kgMatch = str.match(/([\d.]+)\s*(?:\b(?:kg|kgs|kilo|kilos|kilograms?)\b|किलो|किग्र|किलोग्रॅम|किलोग्राम)/i);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round((val / 100) * 100) / 100;
  }

  // Check standard quintal / pure numeric match (e.g. "25 Quintal", "25 Q", "25 क्विंटल", "25")
  const qMatch = str.match(/([\d.]+)\s*(?:\b(?:quintals?|quintal|qtl|qt|q)\b|क्विंटल|क्विंटल्स|कट्टा|पोती)?/i);
  if (qMatch) {
    const val = parseFloat(qMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 100) / 100;
  }

  // Number words mapping
  const wordMap = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'ten': 10, 'twenty': 20, 'twenty five': 25, 'thirty': 30, 'fifty': 50,
    'एक': 1, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पाच': 5, 'दहा': 10,
    'वीस': 20, 'पंचवीस': 25, 'तीस': 30, 'पन्नास': 50, 'शंभर': 100
  };

  for (const [w, num] of Object.entries(wordMap)) {
    if (str.includes(w)) return num;
  }

  return null;
}

/**
 * Normalizes slot text to canonical slot object
 */
function normalizeSlot(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  for (const s of CANONICAL_SLOTS) {
    if (s.keywords.some((kw) => matchesKeyword(clean, kw) || clean.includes(kw.toLowerCase()))) {
      return s;
    }
  }

  return null;
}

// ─── Rule-Based Extraction Engine (Last Resort Fallback) ────────────────────────

/**
 * Deterministic rule-based extraction from raw speech transcript.
 * Labeled: "rule-based", not AI.
 */
function extractRuleBasedBookingFields(text, language = 'mr') {
  if (!text || typeof text !== 'string') {
    return {
      engine: 'rule-based',
      centre: null,
      crop: null,
      quantity: null,
      slot: null,
      isAmbiguous: false
    };
  }

  const centreResult = normalizeCentre(text);
  const cropResult = normalizeCrop(text);
  const quantityResult = normalizeQuantity(text);
  const slotResult = normalizeSlot(text);

  let isAmbiguous = false;
  let centreObj = null;

  if (centreResult && centreResult.success) {
    centreObj = centreResult.centre;
  } else if (centreResult && centreResult.error === 'ambiguous_multiple_centres') {
    isAmbiguous = true;
  }

  return {
    engine: 'rule-based',
    centre: centreObj,
    crop: cropResult,
    quantity: quantityResult,
    slot: slotResult,
    isAmbiguous,
    candidateCentres: centreResult?.candidates || []
  };
}

module.exports = {
  VOICE_CONFIG,
  CANONICAL_CENTRES,
  CANONICAL_CROPS,
  CANONICAL_SLOTS,
  normalizeCentre,
  normalizeCrop,
  normalizeQuantity,
  normalizeSlot,
  extractRuleBasedBookingFields
};
