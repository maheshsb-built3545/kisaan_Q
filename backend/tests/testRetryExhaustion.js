// Test for KisanQ Voice Booking Retry Exhaustion Path
// Tests:
// 1. Step 1 (Centre): Valid answer -> advances to Step 2
// 2. Step 2 (Crop): 
//    - Attempt 1: Unclear input -> retry: true, retriesLeft: 1, clarify prompt
//    - Attempt 2: Unclear input -> retry: false, fallbackToManual: true, retriesLeft: 0, fallback prompt
//    - Attempt 3: Type fallback "सोयाबीन" -> Validated, advances to Step 3
// 3. Step 3 (Quantity): Valid answer -> advances to Step 4
// 4. Step 4 (Slot): Valid answer -> Booking completed & Token created!

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
  console.log('🌾 KISANQ RETRY-EXHAUSTION (2 CONSECUTIVE UNCLEAR ANSWERS) TEST');
  console.log('================================================================\n');

  const testPhone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
  console.log(`[TEST SESSION START] Phone: ${testPhone}, Language: Marathi (mr)`);

  // Start session
  const startRes = await postJson('/api/voice-booking/start', {
    phone: testPhone,
    farmerName: 'महेश बोरडे',
    language: 'mr'
  });

  const sessionId = startRes.data.sessionId;
  console.log('Session ID:', sessionId);

  // 1. Step 1: Valid answer
  console.log('\n--- STEP 1: Centre (Valid Answer) ---');
  const step1Res = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: 'कोपरगाव' });
  console.log('Step 1 Result -> Advanced to Step:', step1Res.data.step, 'Field:', step1Res.data.field);

  // 2. Step 2: Unclear Attempt 1 (1st Unclear Answer)
  console.log('\n--- STEP 2: Crop -> UNCLEAR ATTEMPT 1 ---');
  console.log('[Farmer speaks]: "अस्पष्ट गोंधळ १"');
  const step2Attempt1 = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: 'अस्पष्ट गोंधळ १' });
  console.log('Attempt 1 Response:', {
    success: step2Attempt1.data.success,
    retry: step2Attempt1.data.retry,
    fallbackToManual: step2Attempt1.data.fallbackToManual,
    retriesLeft: step2Attempt1.data.retriesLeft,
    step: step2Attempt1.data.step,
    field: step2Attempt1.data.field,
    clarifyText: step2Attempt1.data.clarifyText
  });

  if (!step2Attempt1.data.retry || step2Attempt1.data.retriesLeft !== 1) {
    console.error('❌ FAIL: Attempt 1 should have retry: true and retriesLeft: 1');
    process.exit(1);
  }
  console.log('✅ Attempt 1 PASSED: Clarification prompt returned, retriesLeft: 1, stays on Step 2');

  // 3. Step 2: Unclear Attempt 2 (2nd Unclear Answer in a row -> Exhaustion!)
  console.log('\n--- STEP 2: Crop -> UNCLEAR ATTEMPT 2 (EXHAUSTION) ---');
  console.log('[Farmer speaks]: "अस्पष्ट गोंधळ २"');
  const step2Attempt2 = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: 'अस्पष्ट गोंधळ २' });
  console.log('Attempt 2 Response:', {
    success: step2Attempt2.data.success,
    retry: step2Attempt2.data.retry,
    fallbackToManual: step2Attempt2.data.fallbackToManual,
    retriesLeft: step2Attempt2.data.retriesLeft,
    step: step2Attempt2.data.step,
    field: step2Attempt2.data.field,
    message: step2Attempt2.data.message
  });

  if (step2Attempt2.data.retry !== false || step2Attempt2.data.fallbackToManual !== true || step2Attempt2.data.retriesLeft !== 0) {
    console.error('❌ FAIL: Attempt 2 should have retry: false, fallbackToManual: true, and retriesLeft: 0');
    process.exit(1);
  }
  console.log('✅ Attempt 2 PASSED: Gracefully transitioned to fallbackToManual with retriesLeft: 0');

  // 4. Step 2: Farmer uses Type Instead fallback to submit "सोयाबीन"
  console.log('\n--- STEP 2: Farmer uses "Type Instead" / Tap Option ---');
  console.log('[Farmer types]: "सोयाबीन"');
  const step2Typed = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: 'सोयाबीन' });
  console.log('Typed Answer Result:', {
    success: step2Typed.data.success,
    extractedValue: step2Typed.data.extractedValue,
    nextStep: step2Typed.data.step,
    nextField: step2Typed.data.field,
    nextQuestion: step2Typed.data.nextQuestionText
  });

  if (step2Typed.data.step !== 3 || step2Typed.data.extractedValue !== 'Soybean') {
    console.error('❌ FAIL: Typed answer did not advance to Step 3');
    process.exit(1);
  }
  console.log('✅ Step 2 Recovery PASSED: Accepted typed value "Soybean" and resumed flow to Step 3');

  // 5. Step 3: Quantity Valid Answer
  console.log('\n--- STEP 3: Quantity (Valid Answer) ---');
  const step3Res = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: '२५ क्विंटल' });
  console.log('Step 3 Result -> Advanced to Step:', step3Res.data.step, 'Field:', step3Res.data.field);

  // 6. Step 4: Slot Valid Answer -> Final Token
  console.log('\n--- STEP 4: Slot (Valid Answer) ---');
  const step4Res = await postJson(`/api/voice-booking/${sessionId}/answer`, { textAnswer: 'उद्या सकाळी' });
  console.log('Step 4 Final Result:', {
    success: step4Res.data.success,
    complete: step4Res.data.complete,
    tokenNumber: step4Res.data.token?.tokenNumber,
    crop: step4Res.data.token?.crop,
    quantity: step4Res.data.token?.quantity,
    mandiName: step4Res.data.token?.mandiName
  });

  if (!step4Res.data.complete || !step4Res.data.token?.tokenNumber) {
    console.error('❌ FAIL: Booking was not completed');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('🎉 RETRY EXHAUSTION & MANUAL RECOVERY TEST PASSED 100% PERFECTLY!');
  console.log(`🎟️ FINAL TOKEN: ${step4Res.data.token.tokenNumber}`);
  console.log('================================================================\n');
})();
