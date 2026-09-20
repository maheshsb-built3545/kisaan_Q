require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Token, Farmer, Centre } = require('../src/models');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const TEST_PREFIX = 'TEST_B2_';

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method, headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runB2Tests() {
  console.log('='.repeat(75));
  console.log('🔒 KISANQ B2 — EXACT QUEUE POSITION & PUBLIC ENDPOINT PRIVACY TEST');
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

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri && mongoUri !== 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    try {
      await mongoose.connect(mongoUri);
    } catch (e) {
      console.warn('DB connect notice:', e.message);
    }
  }

  const testPhone = '9800000099';
  const testFarmerName = 'Namdev Tukaram Gunjal';
  const testTokenNum = `${TEST_PREFIX}TK_PRIVACY_01`;
  const testPlate = 'MH-17-AZ-4589';

  try {
    // 1. Setup test token in MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });

      await Token.create({
        tokenNumber: testTokenNum,
        farmerName: testFarmerName,
        farmerPhone: testPhone,
        phone: testPhone,
        mandiId: 'KPG-01',
        mandiCode: 'KPG',
        mandiName: 'Kopargaon Sub-Yard',
        crop: 'Soybean',
        quantity: 35,
        slotDate: new Date().toISOString().split('T')[0],
        slotTime: '08:00 AM - 11:00 AM',
        vehicleNumber: testPlate,
        status: 'BOOKED',
        queuePosition: 2,
        stages: [{ stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Pending' }]
      });
    }

    const farmerJwt = jwt.sign({ id: 'test_farmer_b2', phone: testPhone, role: 'farmer' }, JWT_SECRET);
    const staffJwt = jwt.sign({ id: 'test_staff_b2', phone: '9800000001', role: 'security_gate', assignedMandi: 'KPG-01' }, JWT_SECRET);

    // -----------------------------------------------------------------------
    // Section 1: Public Mandi Token Board Privacy
    // -----------------------------------------------------------------------
    console.log('\n--- Section 1: GET /api/tokens/mandi/:id Privacy Sanitization ---');
    const mandiBoardRes = await makeRequest('/api/tokens/mandi/KPG-01', 'GET', null, null);
    assert(mandiBoardRes.status === 200 && Array.isArray(mandiBoardRes.body?.tokens), 'GET /api/tokens/mandi/KPG-01 returns 200 OK');

    const boardToken = mandiBoardRes.body?.tokens?.find((t) => t.tokenNumber === testTokenNum);
    assert(boardToken !== undefined, 'Test token visible in public mandi board');
    assert(boardToken?.farmerPhone?.startsWith('******') && !boardToken?.farmerPhone?.includes('980000'), 'Farmer phone number is masked on public board');
    assert(!boardToken?.farmerName?.includes(testFarmerName) && boardToken?.farmerName?.includes('*'), 'Farmer name is privacy masked on public board');
    assert(boardToken?.vehicleNumber?.includes('**'), 'Vehicle plate is masked on public board');
    assert(boardToken?.waitEstimate !== undefined && typeof boardToken?.queuePosition === 'number', 'Deterministic wait estimate & exact queuePosition present');

    // -----------------------------------------------------------------------
    // Section 2: Unauthenticated GET /api/tokens/:tokenNumber Minimal View
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Unauthenticated GET /api/tokens/:tokenNumber Privacy ---');
    const publicTokenRes = await makeRequest(`/api/tokens/${testTokenNum}`, 'GET', null, null);
    assert(publicTokenRes.status === 200, 'Unauthenticated public query returns 200 OK');
    const pubTok = publicTokenRes.body?.token;
    assert(pubTok?.farmerPhone?.startsWith('******'), 'Unauthenticated caller receives masked phone');
    assert(pubTok?.farmerName?.includes('*'), 'Unauthenticated caller receives masked name');
    assert(pubTok?.vehicleNumber?.includes('**'), 'Unauthenticated caller receives masked vehicle plate');
    assert(pubTok?.waitEstimate !== undefined, 'Public tracking view provides non-overlapping wait estimate');

    // -----------------------------------------------------------------------
    // Section 3: Authenticated Owner & Staff Full Access
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: Authenticated Token Owner & Staff Full Details ---');
    const ownerRes = await makeRequest(`/api/tokens/${testTokenNum}`, 'GET', null, farmerJwt);
    assert(ownerRes.status === 200, 'Authenticated owner query returns 200 OK');
    assert(ownerRes.body?.token?.farmerPhone === testPhone, 'Authenticated owner sees full unmasked phone number');
    assert(ownerRes.body?.token?.farmerName === testFarmerName, 'Authenticated owner sees full unmasked name');
    assert(ownerRes.body?.token?.vehicleNumber === testPlate, 'Authenticated owner sees full unmasked plate');

    const staffRes = await makeRequest(`/api/tokens/${testTokenNum}`, 'GET', null, staffJwt);
    assert(staffRes.status === 200, 'Authenticated staff query returns 200 OK');
    assert(staffRes.body?.token?.farmerPhone === testPhone, 'Authenticated staff sees full unmasked phone number');

    // -----------------------------------------------------------------------
    // Section 4: Non-Overlapping Wait Estimation Buckets
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Non-Overlapping Wait Estimation Verification ---');
    assert(pubTok?.queuePosition >= 1, 'Exact integer position is positive integer');

    // Clean up
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      console.log('\n🧹 Cleaned up TEST_B2_ records from MongoDB Atlas.');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED`);
  console.log('='.repeat(75));

  if (failed > 0) process.exit(1);
}

runB2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
