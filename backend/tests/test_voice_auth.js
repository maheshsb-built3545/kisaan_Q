try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch(e) {}
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function apiRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api${endpoint}`,
      method: method.toUpperCase(),
      headers
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(rawData); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json, raw: rawData });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING VOICE BOOKING AUTH SECURITY TEST SUITE ===');

  const farmerToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c701',
    phone: '9822012345',
    name: 'Ramesh Patil',
    role: 'farmer'
  });

  const staffToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c706',
    phone: '9800000006',
    name: 'S. Kulkarni',
    role: 'resource_officer',
    assignedMandi: 'KPG-01'
  });

  // 1. Unauthenticated calls to POST /api/voice-booking/* -> MUST BE 401
  console.log('\n--- 1. Testing Unauthenticated Access (Must be 401) ---');
  
  const resStartNoToken = await apiRequest('post', '/voice-booking/start', {
    phone: '9822012345',
    farmerName: 'Ramesh Patil'
  });
  assert(resStartNoToken.status === 401, `POST /voice-booking/start without token refused with 401 (Got: ${resStartNoToken.status})`);

  const resAnswerNoToken = await apiRequest('post', '/voice-booking/FAKE_SESSION/answer', {
    textAnswer: 'कोपरगाव'
  });
  assert(resAnswerNoToken.status === 401, `POST /voice-booking/:sessionId/answer without token refused with 401 (Got: ${resAnswerNoToken.status})`);

  const resMessageNoToken = await apiRequest('post', '/voice-booking/FAKE_SESSION/message', {
    textAnswer: 'कोपरगाव'
  });
  assert(resMessageNoToken.status === 401, `POST /voice-booking/:sessionId/message without token refused with 401 (Got: ${resMessageNoToken.status})`);

  // 2. Malformed / Invalid token -> MUST BE 401
  console.log('\n--- 2. Testing Invalid Token Access (Must be 401) ---');
  const resBadToken = await apiRequest('post', '/voice-booking/start', {
    phone: '9822012345'
  }, 'INVALID_TOKEN_STRING');
  assert(resBadToken.status === 401, `POST /voice-booking/start with invalid token refused with 401 (Got: ${resBadToken.status})`);

  // 3. Authenticated Farmer Access -> MUST BE 200
  console.log('\n--- 3. Testing Authenticated Farmer Access ---');
  const resFarmerStart = await apiRequest('post', '/voice-booking/start', {
    language: 'mr'
  }, farmerToken);
  assert(resFarmerStart.status === 200, `POST /voice-booking/start with valid farmer JWT succeeded (Got: ${resFarmerStart.status})`);
  assert(resFarmerStart.data?.sessionId, `Session created with ID: ${resFarmerStart.data?.sessionId}`);

  const activeSessionId = resFarmerStart.data?.sessionId;

  // 4. Authenticated Farmer can call /answer and /message
  console.log('\n--- 4. Testing Authenticated Farmer Utterance Processing ---');
  if (activeSessionId) {
    const resFarmerAnswer = await apiRequest('post', `/voice-booking/${activeSessionId}/answer`, {
      textAnswer: 'कोपरगाव'
    }, farmerToken);
    assert(resFarmerAnswer.status === 200, `POST /voice-booking/:sessionId/answer with farmer JWT succeeded (Got: ${resFarmerAnswer.status})`);

    const resFarmerMessage = await apiRequest('post', `/voice-booking/${activeSessionId}/message`, {
      textAnswer: 'सोयाबीन'
    }, farmerToken);
    assert(resFarmerMessage.status === 200, `POST /voice-booking/:sessionId/message with farmer JWT succeeded (Got: ${resFarmerMessage.status})`);
  }

  // 5. Authenticated Staff Assisting Farmer Access -> MUST BE 200
  console.log('\n--- 5. Testing Staff Assisting Farmer Access ---');
  const resStaffStart = await apiRequest('post', '/voice-booking/start', {
    phone: '9822998877',
    farmerName: 'Assisted Farmer',
    farmerId: '64b8f0a1c1d2e3f4a5b6c702',
    language: 'mr'
  }, staffToken);
  assert(resStaffStart.status === 200, `POST /voice-booking/start with staff assisting JWT succeeded (Got: ${resStaffStart.status})`);

  console.log('\n=============================================');
  console.log(`VOICE AUTH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
