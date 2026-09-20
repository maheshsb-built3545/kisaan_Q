/**
 * Test Step 5: Strict Session Isolation & Cross-Area Rejection Test
 * Proves that:
 * 1. Staff-area API calls carrying only a farmer token are rejected by the backend (401/403).
 * 2. Farmer-area API calls carrying only a staff token are rejected by the backend (401/403).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = {
    method: method.toUpperCase(),
    headers
  };
  if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  return { status: res.status, data };
}

async function runSessionTests() {
  console.log('=== RUNNING STRICT CROSS-AREA SESSION REJECTION TESTS ===');
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

  // Farmer token (citizen farmer session)
  const farmerToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d1',
    phone: '9800000101',
    name: 'Farmer Test',
    role: 'farmer'
  });

  // Staff token (mandi staff / supervisor session)
  const staffToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d2',
    phone: '9800000007',
    name: 'V. Pawar',
    role: 'supervisor',
    assignedMandi: 'KPG-01',
    mandiId: 'KPG-01'
  });

  console.log('\n--- Part 1: Staff-Area Calls carrying ONLY Farmer Token (Must be 401/403) ---');

  // 1a. Fast-track round open (Staff only)
  const r1 = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    slotDate: '2026-09-28',
    slotHour: 10
  }, farmerToken);
  assert(r1.status === 403, `Farmer token to POST /fasttrack/rounds/open rejected: [${r1.status}] ${r1.data?.message}`);

  // 1b. Complaints resolve (Supervisor only)
  const r2 = await apiRequest('patch', '/complaints/64b8f0a1c1d2e3f4a5b6c7d1/resolve', {
    resolutionReason: 'Test resolution'
  }, farmerToken);
  assert(r2.status === 403, `Farmer token to POST /complaints/:id/resolve rejected: [${r2.status}] ${r2.data?.message}`);

  // 1c. SMS stats oversight (Supervisor/Admin only)
  const r3 = await apiRequest('get', '/notifications/sms-stats', null, farmerToken);
  assert(r3.status === 403, `Farmer token to GET /notifications/sms-stats rejected: [${r3.status}] ${r3.data?.message}`);

  // 1d. Fast-track decision alias (Officer only)
  const r4 = await apiRequest('patch', '/fasttrack/rounds/FTR-2026-0001/approve', {}, farmerToken);
  assert(r4.status === 403, `Farmer token to PATCH /fasttrack/rounds/:id/approve rejected: [${r4.status}] ${r4.data?.message}`);

  console.log('\n--- Part 2: Farmer-Area Calls carrying ONLY Staff Token (Must be 401/403) ---');

  // 2a. Farmer pickup location update (Farmer only)
  const f1 = await apiRequest('patch', '/farmers/pickup-location', {
    latitude: 19.88,
    longitude: 74.47,
    address: 'Kopargaon Farm Gate'
  }, staffToken);
  assert(f1.status === 403, `Staff token to PATCH /farmers/pickup-location rejected: [${f1.status}] ${f1.data?.message}`);

  // 2b. Farmer push token registration (Farmer only)
  const f2 = await apiRequest('patch', '/farmers/push-token', {
    pushToken: 'ExponentPushToken[xxxx]'
  }, staffToken);
  assert(f2.status === 403, `Staff token to PATCH /farmers/push-token rejected: [${f2.status}] ${f2.data?.message}`);

  // 2c. Farmer join fast-track round (Farmer only)
  const f3 = await apiRequest('post', '/fasttrack/rounds/FTR-2026-0001/join', {
    tokenNumber: 'KQ-101'
  }, staffToken);
  assert(f3.status === 403, `Staff token to POST /fasttrack/rounds/:id/join rejected: [${f3.status}] ${f3.data?.message}`);

  // 2d. Farmer place bid on canonical route (Farmer only)
  const f4 = await apiRequest('post', '/fasttrack/rounds/FTR-2026-0001/bids', {
    amount: 350
  }, staffToken);
  assert(f4.status === 403, `Staff token to POST /fasttrack/rounds/:id/bids rejected: [${f4.status}] ${f4.data?.message}`);

  // 2e. Farmer place bid on alias route (Farmer only)
  const f5 = await apiRequest('post', '/fasttrack/rounds/FTR-2026-0001/bid', {
    amount: 350
  }, staffToken);
  assert(f5.status === 403, `Staff token to POST /fasttrack/rounds/:id/bid rejected: [${f5.status}] ${f5.data?.message}`);

  console.log('\n=============================================');
  console.log(`STRICT SESSION REJECTION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
}

runSessionTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
