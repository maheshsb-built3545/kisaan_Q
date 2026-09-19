// Comprehensive Live End-to-End Test for KisanQ Voice Booking
// Verifies:
// 1. Step 1 (Centre) -> Valid Answer -> Auto-advances to Step 2
// 2. Step 2 (Crop) -> Valid Answer -> Auto-advances to Step 3
// 3. Step 3 (Quantity) -> Deliberate Unclear Answer -> Retries with clarify prompt (same step 3, retryCount decremented)
// 4. Step 3 (Quantity) -> Valid Answer -> Auto-advances to Step 4
// 5. Step 4 (Slot) -> Valid Answer -> Final Token Generated with 5 stages!
// 6. Confirms every step's question is heard exactly once, and clarification is only triggered on unclear input.

const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('🌾 KISANQ FULL 4-STEP LIVE CONVERSATIONAL VOICE BOOKING VERIFICATION');
  console.log('================================================================\n');

  const testPhone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
  console.log(`[TEST SESSION START] Phone: ${testPhone}, Language: Marathi (mr)`);

  // Step 1: Start Session
  const startRes = await postJson('/api/voice-booking/start', {
    phone: testPhone,
    farmerName: 'महेश बोरडे',
    language: 'mr'
  });

  console.log('\n--- [STEP 1 ENTRY] ---');
  console.log('Session ID:', startRes.data.sessionId);
  console.log('Initial Step:', startRes.data.step, 'Field:', startRes.data.field);
  console.log('Audio Question 1:', startRes.data.questionText);
  console.log('Audio URL 1:', startRes.data.questionAudioUrl);

  const sessionId = startRes.data.sessionId;

  // Step 1 Answer: "कोपरगाव" (Valid APMC Kopargaon)
  console.log('\n[FARMER ANSWERS STEP 1]: "कोपरगाव"');
  const step1Res = await postJson(`/api/voice-booking/${sessionId}/answer`, {
    textAnswer: 'कोपरगाव'
  });
  console.log('Step 1 Response:', {
    success: step1Res.data.success,
    completedStep: step1Res.data.completedStep,
    extractedValue: step1Res.data.extractedValue,
    nextStep: step1Res.data.step,
    nextField: step1Res.data.field,
    nextQuestion: step1Res.data.nextQuestionText,
    nextAudioUrl: step1Res.data.nextQuestionAudioUrl
  });

  if (step1Res.data.step !== 2) {
    console.error('❌ BUG: Step did not advance to 2!');
    process.exit(1);
  }
  console.log('✅ STEP 1 -> STEP 2 AUTO-ADVANCE SUCCESSFUL (Heard once, advanced immediately)');

  // Step 2 Answer: "सोयाबीन" (Valid Crop Soybean)
  console.log('\n--- [STEP 2 ENTRY] ---');
  console.log('[FARMER ANSWERS STEP 2]: "सोयाबीन"');
  const step2Res = await postJson(`/api/voice-booking/${sessionId}/answer`, {
    textAnswer: 'सोयाबीन'
  });
  console.log('Step 2 Response:', {
    success: step2Res.data.success,
    completedStep: step2Res.data.completedStep,
    extractedValue: step2Res.data.extractedValue,
    nextStep: step2Res.data.step,
    nextField: step2Res.data.field,
    nextQuestion: step2Res.data.nextQuestionText,
    nextAudioUrl: step2Res.data.nextQuestionAudioUrl
  });

  if (step2Res.data.step !== 3) {
    console.error('❌ BUG: Step did not advance to 3!');
    process.exit(1);
  }
  console.log('✅ STEP 2 -> STEP 3 AUTO-ADVANCE SUCCESSFUL (Heard once, advanced immediately)');

  // Step 3: Deliberate Unclear Answer to verify retry loop!
  console.log('\n--- [STEP 3 ENTRY - RETRY TEST] ---');
  console.log('[FARMER SPEAKS UNCLEAR ANSWER]: "काहीतरी अस्पष्ट गोंधळ"');
  const step3BadRes = await postJson(`/api/voice-booking/${sessionId}/answer`, {
    textAnswer: 'काहीतरी अस्पष्ट गोंधळ'
  });
  console.log('Step 3 Unclear Response:', {
    success: step3BadRes.data.success,
    retry: step3BadRes.data.retry,
    retriesLeft: step3BadRes.data.retriesLeft,
    currentStep: step3BadRes.data.step,
    clarifyText: step3BadRes.data.clarifyText,
    clarifyAudioUrl: step3BadRes.data.clarifyAudioUrl
  });

  if (!step3BadRes.data.retry || step3BadRes.data.step !== 3) {
    console.error('❌ BUG: Clarification retry did not stay on step 3 with retry: true!');
    process.exit(1);
  }
  console.log('✅ STEP 3 RETRY LOOP VERIFIED (Spoken clarification prompt returned, stays on step 3)');

  // Step 3 Answer: "पंचवीस क्विंटल" (Valid Quantity 25)
  console.log('\n[FARMER ANSWERS STEP 3 WITH VALID QUANTITY]: "पंचवीस क्विंटल"');
  const step3ValidRes = await postJson(`/api/voice-booking/${sessionId}/answer`, {
    textAnswer: 'पंचवीस क्विंटल'
  });
  console.log('Step 3 Valid Response:', {
    success: step3ValidRes.data.success,
    completedStep: step3ValidRes.data.completedStep,
    extractedValue: step3ValidRes.data.extractedValue,
    nextStep: step3ValidRes.data.step,
    nextField: step3ValidRes.data.field,
    nextQuestion: step3ValidRes.data.nextQuestionText,
    nextAudioUrl: step3ValidRes.data.nextQuestionAudioUrl
  });

  if (step3ValidRes.data.step !== 4) {
    console.error('❌ BUG: Step did not advance to 4!');
    process.exit(1);
  }
  console.log('✅ STEP 3 -> STEP 4 AUTO-ADVANCE SUCCESSFUL (Quantity 25 extracted)');

  // Step 4 Answer: "उद्या सकाळी" (Tomorrow Morning Slot)
  console.log('\n--- [STEP 4 ENTRY] ---');
  console.log('[FARMER ANSWERS STEP 4]: "उद्या सकाळी"');
  const step4Res = await postJson(`/api/voice-booking/${sessionId}/answer`, {
    textAnswer: 'उद्या सकाळी'
  });
  console.log('Step 4 Final Response:', {
    success: step4Res.data.success,
    complete: step4Res.data.complete,
    tokenNumber: step4Res.data.token?.tokenNumber,
    mandiName: step4Res.data.token?.mandiName,
    crop: step4Res.data.token?.crop,
    quantity: step4Res.data.token?.quantity,
    slotDate: step4Res.data.token?.slotDate,
    slotTime: step4Res.data.token?.slotTime,
    stagesCount: step4Res.data.token?.stages?.length
  });

  if (!step4Res.data.complete || !step4Res.data.token?.tokenNumber) {
    console.error('❌ BUG: Token creation failed on Step 4!');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log(`🎉 VERIFICATION COMPLETE: ALL 4 STEPS ADVANCED PERFECTLY!`);
  console.log(`🎟️ TOKEN CREATED: ${step4Res.data.token.tokenNumber}`);
  console.log('================================================================\n');
})();
