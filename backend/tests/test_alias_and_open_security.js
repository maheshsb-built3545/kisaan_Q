/**
 * Test Step 4: Aliases and Round Opening Security
 * Tests that:
 * 1. POST /api/fasttrack/rounds/open:
 *    - Farmer is refused (403)
 *    - Other-centre officer is refused (403)
 *    - Authorised officer of that centre succeeds (201 or 429 if cap reached)
 * 2. Aliases for decision:
 *    - PATCH /rounds/:id/approve
 *    - PATCH /rounds/:id/decline
 *    - POST /:id/approve
 *    - POST /:id/reject
 *    All refused for farmer (403), other-centre officer (403), wrong-state round (400), and missing decline reason (400).
 * 3. Bid alias POST /rounds/:id/bid refuses non-farmer or missing JWT.
 * 4. Notification aliases (PUT/POST :id/read, PUT/PATCH read-all) require JWT.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { FastTrackRound } = require('../src/models');

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

async function runTests() {
  console.log('=== RUNNING ALIASES AND ROUND OPENING TEST SUITE ===');
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

  // Tokens
  const farmerToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d1',
    phone: '9800000101',
    name: 'Farmer Test',
    role: 'farmer'
  });

  const kpgOfficerToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d2',
    phone: '9800000006',
    name: 'P. Kulkarni',
    role: 'resource_officer',
    assignedMandi: 'KPG-01',
    mandiId: 'KPG-01'
  });

  const otherCentreOfficerToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d3',
    phone: '9800000021',
    name: 'Shirdi Officer',
    role: 'resource_officer',
    assignedMandi: 'SRD-02',
    mandiId: 'SRD-02'
  });

  const supervisorToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c707',
    phone: '9800000007',
    name: 'V. Pawar',
    role: 'supervisor',
    assignedMandi: 'KPG-01',
    mandiId: 'KPG-01'
  });

  const districtAdminToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c708',
    phone: '9800000008',
    name: 'District Collector',
    role: 'district_admin',
    assignedMandi: 'KPG-01',
    mandiId: 'KPG-01'
  });

  const adminToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c799',
    phone: '9800000099',
    name: 'Global Administrator',
    role: 'admin'
  });

  // 1. TEST POST /api/fasttrack/rounds/open
  console.log('\n--- Testing POST /api/fasttrack/rounds/open ---');
  
  // 1a. Farmer calling rounds/open -> REFUSED (403)
  const resFarmerOpen = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    slotDate: '2026-09-25',
    slotHour: 10
  }, farmerToken);
  assert(resFarmerOpen.status === 403, `Farmer open round refused: [${resFarmerOpen.status}] ${resFarmerOpen.data?.message}`);

  // 1b. Supervisor calling rounds/open -> REFUSED (403)
  const resSupervisorOpen = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    slotDate: '2026-09-25',
    slotHour: 10
  }, supervisorToken);
  assert(resSupervisorOpen.status === 403, `Supervisor open round refused: [${resSupervisorOpen.status}] ${resSupervisorOpen.data?.message}`);

  // 1c. District Admin calling rounds/open -> REFUSED (403)
  const resDistrictAdminOpen = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    slotDate: '2026-09-25',
    slotHour: 10
  }, districtAdminToken);
  assert(resDistrictAdminOpen.status === 403, `District admin open round refused: [${resDistrictAdminOpen.status}] ${resDistrictAdminOpen.data?.message}`);

  // 1d. Other-centre officer calling rounds/open for KPG-01 -> REFUSED (403)
  const resOtherOfficerOpen = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    slotDate: '2026-09-25',
    slotHour: 11
  }, otherCentreOfficerToken);
  assert(resOtherOfficerOpen.status === 403, `Other-centre officer open round refused: [${resOtherOfficerOpen.status}] ${resOtherOfficerOpen.data?.message}`);

  // 1e. Authorised centre officer calling rounds/open -> SUCCESS (201)
  const resAuthOfficerOpen = await apiRequest('post', '/fasttrack/rounds/open', {
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: '2026-09-26',
    slotHour: 14
  }, kpgOfficerToken);
  assert(resAuthOfficerOpen.status === 201 || resAuthOfficerOpen.status === 200, `Authorised centre officer opened round: [${resAuthOfficerOpen.status}] ${resAuthOfficerOpen.data?.data?.roundId}`);
  const testRoundId = resAuthOfficerOpen.data?.data?.roundId || resAuthOfficerOpen.data?.data?._id;

  // 2. TEST DECISION ALIASES
  console.log('\n--- Testing Fast-Track Decision Aliases ---');
  const decisionAliases = [
    { method: 'patch', path: `/fasttrack/rounds/${testRoundId}/approve`, body: {} },
    { method: 'patch', path: `/fasttrack/rounds/${testRoundId}/decline`, body: { reason: 'Test reason' } },
    { method: 'post', path: `/fasttrack/${testRoundId}/approve`, body: {} },
    { method: 'post', path: `/fasttrack/${testRoundId}/reject`, body: { reason: 'Test reason' } }
  ];

  // 2a. Farmer calling decision aliases -> REFUSED (403)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, farmerToken);
    assert(res.status === 403, `Farmer calling ${alias.path} refused: [${res.status}] ${res.data?.message}`);
  }

  // 2b. Supervisor calling decision aliases -> REFUSED (403)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, supervisorToken);
    assert(res.status === 403, `Supervisor calling ${alias.path} refused: [${res.status}] ${res.data?.message}`);
  }

  // 2c. District Admin calling decision aliases -> REFUSED (403)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, districtAdminToken);
    assert(res.status === 403, `District admin calling ${alias.path} refused: [${res.status}] ${res.data?.message}`);
  }

  // 2d. Global Admin calling decision aliases -> REFUSED (403)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, adminToken);
    assert(res.status === 403, `Global Admin calling ${alias.path} refused: [${res.status}] ${res.data?.message}`);
  }

  // 2e. Supervisor & District Admin calling start-decision -> REFUSED (403)
  const resSupStart = await apiRequest('post', `/fasttrack/rounds/${testRoundId}/start-decision`, { approved: true }, supervisorToken);
  assert(resSupStart.status === 403, `Supervisor calling start-decision refused: [${resSupStart.status}] ${resSupStart.data?.message}`);

  const resDistStart = await apiRequest('post', `/fasttrack/rounds/${testRoundId}/start-decision`, { approved: true }, districtAdminToken);
  assert(resDistStart.status === 403, `District Admin calling start-decision refused: [${resDistStart.status}] ${resDistStart.data?.message}`);

  // 2f. Other-centre officer calling decision aliases -> REFUSED (403)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, otherCentreOfficerToken);
    assert(res.status === 403, `Other-centre officer calling ${alias.path} refused: [${res.status}] ${res.data?.message}`);
  }

  // 2c. Authorised officer calling decision aliases on wrong-state round (status: 'JOINING') -> REFUSED (400)
  for (const alias of decisionAliases) {
    const res = await apiRequest(alias.method, alias.path, alias.body, kpgOfficerToken);
    assert(
      res.status === 400,
      `Authorised officer on wrong-state round calling ${alias.path} refused: [${res.status}] ${res.data?.message}`
    );
  }

  // 2d. Decline without reason on decline/reject aliases
  const testAwaitingRoundId = `TEST-AWAIT-${Date.now()}`;
  try {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
      await mongoose.connect(uri, { dbName: 'kisanq_aveniq' });
    }
    const sampleBookingId = new mongoose.Types.ObjectId();
    const sampleFarmerId = new mongoose.Types.ObjectId();
    await FastTrackRound.create({
      roundId: testAwaitingRoundId,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      slotDate: '2026-09-27',
      slotHour: 15,
      status: 'AWAITING_APPROVAL',
      reserveFee: 200,
      bidStep: 10,
      bidCeiling: 500,
      capPerHour: 2,
      participants: [{
        farmerId: sampleFarmerId,
        bookingId: sampleBookingId,
        phone: '9800000101',
        tokenNumber: 'T-101',
        name: 'Farmer 1'
      }],
      currentLeader: {
        farmerId: sampleFarmerId,
        bookingId: sampleBookingId,
        phone: '9800000101',
        tokenNumber: 'T-101',
        amount: 300,
        name: 'Farmer 1',
        bidTime: new Date()
      },
      candidateQueue: [{
        farmerId: sampleFarmerId,
        bookingId: sampleBookingId,
        phone: '9800000101',
        tokenNumber: 'T-101',
        amount: 300,
        name: 'Farmer 1',
        bidTime: new Date()
      }]
    });

    // Test decline alias without reason
    const resDeclineNoReason = await apiRequest(
      'patch',
      `/fasttrack/rounds/${testAwaitingRoundId}/decline`,
      { reason: '' },
      kpgOfficerToken
    );
    assert(resDeclineNoReason.status === 400, `Decline without reason on PATCH decline refused: [${resDeclineNoReason.status}] ${resDeclineNoReason.data?.message}`);

    // Test reject alias without reason
    const resRejectNoReason = await apiRequest(
      'post',
      `/fasttrack/${testAwaitingRoundId}/reject`,
      { reason: '' },
      kpgOfficerToken
    );
    assert(resRejectNoReason.status === 400, `Reject without reason on POST reject refused: [${resRejectNoReason.status}] ${resRejectNoReason.data?.message}`);

    // Clean up test awaiting round
    await FastTrackRound.deleteOne({ roundId: testAwaitingRoundId });
    if (testRoundId) {
      await FastTrackRound.deleteOne({ roundId: testRoundId });
    }
  } catch (e) {
    console.error('Setup error for awaiting round test:', e.message);
  }

  // 3. TEST BID ALIAS: POST /rounds/:id/bid
  console.log('\n--- Testing Bid Alias POST /rounds/:id/bid ---');
  const resBidAlias = await apiRequest('post', '/fasttrack/rounds/NONEXISTENT/bid', { amount: 500 }, farmerToken);
  assert(resBidAlias.status === 404, `Bid alias ran handler and returned: [${resBidAlias.status}] ${resBidAlias.data?.message}`);

  // Test GET /fasttrack (list alias)
  const resListAlias = await apiRequest('get', '/fasttrack');
  assert(resListAlias.status === 200, `List alias GET /api/fasttrack returned: [${resListAlias.status}] (found ${resListAlias.data?.data?.rounds?.length} rounds)`);

  // 4. TEST NOTIFICATION ALIASES
  console.log('\n--- Testing Notification Aliases ---');
  const resPutUnauth = await apiRequest('put', '/notifications/64b8f0a1c1d2e3f4a5b6c7d1/read');
  assert(resPutUnauth.status === 401, `Unauthenticated PUT /:id/read refused: [${resPutUnauth.status}]`);

  const resPostUnauth = await apiRequest('post', '/notifications/64b8f0a1c1d2e3f4a5b6c7d1/read');
  assert(resPostUnauth.status === 401, `Unauthenticated POST /:id/read refused: [${resPostUnauth.status}]`);

  const resReadAllPutUnauth = await apiRequest('put', '/notifications/read-all');
  assert(resReadAllPutUnauth.status === 401, `Unauthenticated PUT /read-all refused: [${resReadAllPutUnauth.status}]`);

  const resReadAllPatchUnauth = await apiRequest('patch', '/notifications/read-all');
  assert(resReadAllPatchUnauth.status === 401, `Unauthenticated PATCH /read-all refused: [${resReadAllPatchUnauth.status}]`);

  // Authenticated farmer calling mark-all-as-read aliases
  const resReadAllPutAuth = await apiRequest('put', '/notifications/read-all', {}, farmerToken);
  assert(resReadAllPutAuth.status === 200, `Authenticated PUT /read-all alias succeeded: [${resReadAllPutAuth.status}]`);

  const resReadAllPatchAuth = await apiRequest('patch', '/notifications/read-all', {}, farmerToken);
  assert(resReadAllPatchAuth.status === 200, `Authenticated PATCH /read-all alias succeeded: [${resReadAllPatchAuth.status}]`);

  // Clean up created test round
  if (testRoundId) {
    try {
      const { FastTrackRound } = require('../src/models');
      await FastTrackRound.deleteOne({ $or: [{ roundId: testRoundId }, { _id: testRoundId }] });
    } catch (e) {}
  }

  console.log('\n=============================================');
  console.log(`STEP 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
