// Integration Test for KisanQ Voice-Based Slot Booking (Phase A)
const http = require('http');

function makeRequest(options, postData = null, isMultipart = false, boundary = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let data = buffer.toString('utf8');
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(data);
          } catch (e) {}
        }
        resolve({ status: res.statusCode, headers: res.headers, data, buffer });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

function postJson(path, data) {
  const body = JSON.stringify(data);
  return makeRequest({
    hostname: 'localhost',
    port: 5000,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
}

function postMultipartAudio(path, fieldName, filename, audioBuffer, extraFields = {}) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let parts = [];

  for (const [key, val] of Object.entries(extraFields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  if (audioBuffer) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const fullBody = Buffer.concat(parts);

  return makeRequest({
    hostname: 'localhost',
    port: 5000,
    path,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBody.length
    }
  }, fullBody);
}

function getRequest(path) {
  return makeRequest({
    hostname: 'localhost',
    port: 5000,
    path,
    method: 'GET'
  });
}

// Generate dummy PCM audio buffer
function createTestAudioBuffer(size = 512) {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = i % 256;
  return buf;
}

async function runVoiceBookingTests() {
  console.log('================================================================');
  console.log('🌾 KISANQ VOICE-BASED SLOT BOOKING INTEGRATION TESTS (PHASE A)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ─── TEST 1: Session Initiation (Marathi) ──────────────────────────────────
    console.log('--- TEST 1: POST /api/voice-booking/start (Language: Marathi) ---');
    const testPhone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    const startRes = await postJson('/api/voice-booking/start', {
      phone: testPhone,
      farmerName: 'Mahesh Borde',
      language: 'mr'
    });

    assert(startRes.status === 200, `Start session returned HTTP 200 (Got: ${startRes.status})`);
    assert(startRes.data.success === true, 'Response contains success: true');
    assert(typeof startRes.data.sessionId === 'string', `SessionId generated: ${startRes.data.sessionId}`);
    assert(startRes.data.step === 1, 'Initial step is 1');
    assert(startRes.data.field === 'centre', 'Initial field is centre');
    assert(startRes.data.questionText.includes('खरेदी केंद्रासाठी') || startRes.data.questionText.includes('कोपरगाव'), 'Marathi question prompt returned');
    assert(startRes.data.questionAudioUrl.includes('/audio/1'), 'Audio URL points to step 1');

    const sessionId = startRes.data.sessionId;

    // ─── TEST 2: Audio Stream Endpoint ─────────────────────────────────────────
    console.log('\n--- TEST 2: GET /api/voice-booking/:sessionId/audio/1 ---');
    const audioRes = await getRequest(`/api/voice-booking/${sessionId}/audio/1?type=question`);
    assert(audioRes.status === 200, `Audio endpoint returned HTTP 200 (Got: ${audioRes.status})`);
    assert(audioRes.headers['content-type'] === 'audio/wav', `Content-Type is audio/wav (Got: ${audioRes.headers['content-type']})`);
    assert(audioRes.buffer.length > 44, `Audio payload size valid (${audioRes.buffer.length} bytes)`);

    // ─── TEST 3: Step 1 Answer (Centre - APMC Kopargaon) ──────────────────────
    console.log('\n--- TEST 3: POST /api/voice-booking/:sessionId/answer (Step 1: Centre) ---');
    const audioStep1 = createTestAudioBuffer(1024);
    const step1Res = await postMultipartAudio(
      `/api/voice-booking/${sessionId}/answer`,
      'audio',
      'step1_centre.webm',
      audioStep1,
      { textAnswer: 'कोपरगाव' }
    );

    assert(step1Res.status === 200, `Step 1 answer returned HTTP 200 (Got: ${step1Res.status})`);
    assert(step1Res.data.complete === false, 'complete is false (more steps remain)');
    assert(step1Res.data.step === 2, `Advanced to Step 2 (Got: ${step1Res.data.step})`);
    assert(step1Res.data.field === 'crop', 'Next field is crop');
    assert(step1Res.data.extractedValue?.code === 'KPG-01', `Recognized centre KPG-01 (Got: ${step1Res.data.extractedValue?.code})`);

    // ─── TEST 4: Step 2 Answer (Crop - Soybean) ────────────────────────────────
    console.log('\n--- TEST 4: POST /api/voice-booking/:sessionId/answer (Step 2: Crop) ---');
    const audioStep2 = createTestAudioBuffer(1024);
    const step2Res = await postMultipartAudio(
      `/api/voice-booking/${sessionId}/answer`,
      'audio',
      'step2_crop.webm',
      audioStep2,
      { textAnswer: 'सोयाबीन' }
    );

    assert(step2Res.status === 200, `Step 2 answer returned HTTP 200 (Got: ${step2Res.status})`);
    assert(step2Res.data.step === 3, `Advanced to Step 3 (Got: ${step2Res.data.step})`);
    assert(step2Res.data.field === 'quantity', 'Next field is quantity');
    assert(step2Res.data.extractedValue === 'Soybean', `Recognized crop Soybean (Got: ${step2Res.data.extractedValue})`);

    // ─── TEST 5: Retry / Clarify Handling on Unclear Answer ────────────────────
    console.log('\n--- TEST 5: Clarify & Retry flow on Unclear Quantity Answer ---');
    const step3BadRes = await postJson(`/api/voice-booking/${sessionId}/answer`, {
      textAnswer: 'blah blah unparseable gibberish 99999'
    });

    assert(step3BadRes.status === 200, `Unclear input returned HTTP 200 (Got: ${step3BadRes.status})`);
    assert(step3BadRes.data.retry === true, 'retry is true for unclear input');
    assert(step3BadRes.data.retriesLeft === 1, `retriesLeft is 1 (Got: ${step3BadRes.data.retriesLeft})`);
    assert(typeof step3BadRes.data.clarifyText === 'string', 'Clarification text prompt returned');
    assert(step3BadRes.data.clarifyAudioUrl.includes('type=clarify'), 'Clarify audio URL provided');

    // ─── TEST 6: Step 3 Valid Answer (Quantity - 25 Quintals) ─────────────────
    console.log('\n--- TEST 6: POST /api/voice-booking/:sessionId/answer (Step 3: Quantity) ---');
    const step3ValidRes = await postJson(`/api/voice-booking/${sessionId}/answer`, {
      textAnswer: 'पंचवीस क्विंटल'
    });

    assert(step3ValidRes.status === 200, `Step 3 answer returned HTTP 200 (Got: ${step3ValidRes.status})`);
    assert(step3ValidRes.data.step === 4, `Advanced to Step 4 (Got: ${step3ValidRes.data.step})`);
    assert(step3ValidRes.data.field === 'slot', 'Next field is slot');
    assert(step3ValidRes.data.extractedValue === 25, `Recognized quantity 25 quintals (Got: ${step3ValidRes.data.extractedValue})`);

    // ─── TEST 7: Step 4 Answer (Slot) & Final Booking Generation ──────────────
    console.log('\n--- TEST 7: POST /api/voice-booking/:sessionId/answer (Step 4: Slot -> Final Token) ---');
    const step4Res = await postJson(`/api/voice-booking/${sessionId}/answer`, {
      textAnswer: 'उद्या सकाळी'
    });

    assert(step4Res.status === 200, `Step 4 answer returned HTTP 200 (Got: ${step4Res.status})`);
    assert(step4Res.data.complete === true, 'complete is true on final step');
    assert(typeof step4Res.data.token === 'object', 'Token object returned');
    assert(step4Res.data.token?.tokenNumber?.startsWith('KQ-KPG-'), `Token number has correct format: ${step4Res.data.token?.tokenNumber}`);
    assert(step4Res.data.token?.crop === 'Soybean', `Token crop is Soybean: ${step4Res.data.token?.crop}`);
    assert(step4Res.data.token?.quantity === 25, `Token quantity is 25: ${step4Res.data.token?.quantity}`);
    assert(Array.isArray(step4Res.data.token?.stages) && step4Res.data.token.stages.length === 5, 'Token has 5-stage procurement checkpoints');

    // ─── TEST 8: Session Expiry / Cleanup Check ───────────────────────────────
    console.log('\n--- TEST 8: Completed session lookup check ---');
    const completedSessionCheck = await getRequest(`/api/voice-booking/${sessionId}/status`);
    assert(completedSessionCheck.status === 404, `Completed session cleared from active sessions (HTTP ${completedSessionCheck.status})`);

    // ─── TEST 9: Multi-language Hindi Session ──────────────────────────────────
    console.log('\n--- TEST 9: Full Session in Hindi (Language: hi) ---');
    const hiStart = await postJson('/api/voice-booking/start', {
      phone: '9811223344',
      farmerName: 'सुनील शिंदे',
      language: 'hi'
    });
    assert(hiStart.data.language === 'hi', 'Language is Hindi');
    assert(hiStart.data.questionText.includes('खरीद केंद्र') || hiStart.data.questionText.includes('मंडी'), 'Hindi prompt verified');

    console.log('\n================================================================');
    console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed === 0) {
      console.log('🎉 ALL PHASE A BACKEND INTEGRATION TESTS PASSED PERFECTLY!');
      process.exit(0);
    } else {
      console.error('❌ Some tests failed. Please review the output above.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  }
}

// Ensure server is running or run directly
runVoiceBookingTests();
