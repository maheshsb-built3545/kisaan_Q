require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const {
  VOICE_CONFIG,
  CANONICAL_CENTRES,
  CANONICAL_CROPS,
  CANONICAL_SLOTS,
  normalizeCentre,
  normalizeCrop,
  normalizeQuantity,
  normalizeSlot,
  extractRuleBasedBookingFields
} = require('../src/config/voiceConfig');
const voiceBookingService = require('../src/services/voiceBookingService');

async function runVoiceConfigTests() {
  console.log('='.repeat(75));
  console.log('🎙️ KISANQ VOICE CONFIG & CANONICAL NORMALIZATION TEST SUITE');
  console.log('='.repeat(75));

  let passed = 0;
  let failed = 0;
  let notChecked = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------------
  // Section 1: Configuration & Hierarchy
  // -----------------------------------------------------------------------
  console.log('\n--- Section 1: Voice Config & Hierarchy ---');
  assert(VOICE_CONFIG.stt.groqModel === 'whisper-large-v3-turbo', 'Primary STT model configured to whisper-large-v3-turbo');
  assert(VOICE_CONFIG.nlu.groqModels.includes('openai/gpt-oss-20b'), 'Primary NLU models include openai/gpt-oss-20b');
  assert(VOICE_CONFIG.nlu.geminiModel === 'gemini-3.6-flash', 'Fallback NLU model configured to gemini-3.6-flash');
  assert(VOICE_CONFIG.nlu.ruleBasedFallback === true, 'Rule-based fallback enabled');

  // -----------------------------------------------------------------------
  // Section 2: Canonical Centre Normalizer (En / Mr / Hi)
  // -----------------------------------------------------------------------
  console.log('\n--- Section 2: Canonical Centre Normalizer ---');
  const cEn = normalizeCentre('I want to book at Kopargaon mandi');
  assert(cEn?.success && cEn?.centre?.code === 'KPG-01', 'English centre text maps to KPG-01');

  const cMr = normalizeCentre('मला कोपरगाव कृषी उत्पन्न बाजार समितीत यायचे आहे');
  assert(cMr?.success && cMr?.centre?.code === 'KPG-01', 'Marathi centre text maps to KPG-01');

  const cHi = normalizeCentre('मुझे कोपरगांव कृषि उपज मंडी में स्लॉट चाहिए');
  assert(cHi?.success && cHi?.centre?.code === 'KPG-01', 'Hindi centre text maps to KPG-01');

  const cShirdi = normalizeCentre('शिर्डी');
  assert(cShirdi?.success && cShirdi?.centre?.code === 'SRD-02', 'Marathi "शिर्डी" maps to SRD-02');

  const cLasalgaon = normalizeCentre('लासलगाव');
  assert(cLasalgaon?.success && cLasalgaon?.centre?.code === 'LSG-06', 'Marathi "लासलगाव" maps to LSG-06');

  // -----------------------------------------------------------------------
  // Section 3: Rejection of Multiple Centres (Never accept list as one centre)
  // -----------------------------------------------------------------------
  console.log('\n--- Section 3: Multi-Centre Ambiguity Rejection ---');
  const multi1 = normalizeCentre('Kopargaon or Shirdi');
  assert(!multi1?.success && multi1?.error === 'ambiguous_multiple_centres', 'English multi-centre rejected as ambiguous');

  const multi2 = normalizeCentre('कोपरगाव किंवा शिर्डी');
  assert(!multi2?.success && multi2?.error === 'ambiguous_multiple_centres', 'Marathi multi-centre (कोपरगाव किंवा शिर्डी) rejected as ambiguous');

  const multi3 = normalizeCentre('Lasalgaon and Rahata APMC');
  assert(!multi3?.success && multi3?.error === 'ambiguous_multiple_centres', 'English list of centres rejected as ambiguous');

  // -----------------------------------------------------------------------
  // Section 4: Canonical Crop Normalizer (En / Mr / Hi)
  // -----------------------------------------------------------------------
  console.log('\n--- Section 4: Canonical Crop Normalizer ---');
  assert(normalizeCrop('soybean')?.id === 'Soybean', 'English "soybean" maps to Soybean');
  assert(normalizeCrop('सोयाबीन')?.id === 'Soybean', 'Marathi/Hindi "सोयाबीन" maps to Soybean');
  assert(normalizeCrop('कापूस')?.id === 'Cotton', 'Marathi "कापूस" maps to Cotton');
  assert(normalizeCrop('कपास')?.id === 'Cotton', 'Hindi "कपास" maps to Cotton');
  assert(normalizeCrop('गहू')?.id === 'Wheat', 'Marathi "गहू" maps to Wheat');
  assert(normalizeCrop('कांदा')?.id === 'Onion', 'Marathi "कांदा" maps to Onion');
  assert(normalizeCrop('मका')?.id === 'Maize', 'Marathi "मका" maps to Maize');
  assert(normalizeCrop('हरभरा')?.id === 'Chana', 'Marathi "हरभरा" maps to Chana');

  // -----------------------------------------------------------------------
  // Section 5: Quantity String to Numeric Normalizer
  // -----------------------------------------------------------------------
  console.log('\n--- Section 5: Quantity String Normalizer ---');
  assert(normalizeQuantity('25 Quintal') === 25, '"25 Quintal" converts to number 25');
  assert(normalizeQuantity('25 quintals') === 25, '"25 quintals" converts to number 25');
  assert(normalizeQuantity('२५ क्विंटल') === 25, '"२५ क्विंटल" (Devanagari) converts to number 25');
  assert(normalizeQuantity('50 Q') === 50, '"50 Q" converts to number 50');
  assert(normalizeQuantity('30 ton') === 300, '"30 ton" converts to number 300 Quintals');
  assert(normalizeQuantity('500 kg') === 5, '"500 kg" converts to number 5 Quintals');
  assert(normalizeQuantity(45) === 45, 'Raw number 45 passes through as 45');

  // -----------------------------------------------------------------------
  // Section 6: Rule-Based Extraction Fallback (Labeled rule-based, not AI)
  // -----------------------------------------------------------------------
  console.log('\n--- Section 6: Rule-Based Fallback Engine ---');
  const ruleExt = extractRuleBasedBookingFields('मला कोपरगाव येथे २५ क्विंटल सोयाबीन विकायचे आहे', 'mr');
  assert(ruleExt.engine === 'rule-based', 'Engine explicitly labeled "rule-based", not AI');
  assert(ruleExt.centre?.code === 'KPG-01', 'Rule-based extracts centre KPG-01');
  assert(ruleExt.crop?.id === 'Soybean', 'Rule-based extracts crop Soybean');
  assert(ruleExt.quantity === 25, 'Rule-based extracts quantity 25');

  // -----------------------------------------------------------------------
  // Section 7: Crash-Proof Empty Key Handling
  // -----------------------------------------------------------------------
  console.log('\n--- Section 7: Crash-Proof Empty Key Safety ---');
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  try {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const dummySession = {
      sessionId: 'test_empty_keys',
      farmerPhone: '9876543210',
      farmerName: 'Mahesh Borde',
      language: 'mr',
      messages: []
    };

    const sessionStart = await voiceBookingService.startSession({
      phone: '9876543210',
      farmerName: 'Mahesh Borde',
      language: 'mr'
    });
    assert(sessionStart.success === true, 'startSession succeeds even with no API keys in environment');

    const reply = await voiceBookingService.processAnswer(sessionStart.sessionId, {
      text: 'मला कोपरगाव येथे २५ क्विंटल सोयाबीन स्लॉट हवा आहे',
      language: 'mr'
    });
    assert(reply.success === true, 'processAnswer handles request gracefully via rule-based fallback with no keys');
    assert(reply.replyText && reply.replyText.length > 5, 'Fallback generates polite spoken reply');
  } finally {
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
  }

  // Real voice audio note
  console.log('\n--- Section 8: Audio Real Testing ---');
  console.log('  ⚠️ Real SMS dispatch: NOT CHECKED (no Fast2SMS key)');
  console.log('  ⚠️ Real audio speech from farmer: NOT CHECKED (no audio clips in backend/tests/audio-real/)');
  notChecked += 2;

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED`);
  console.log('='.repeat(75));

  if (failed > 0) process.exit(1);
}

runVoiceConfigTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
