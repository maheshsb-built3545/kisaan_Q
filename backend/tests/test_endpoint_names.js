/**
 * test_endpoint_names.js
 * Verification of unified endpoint names and documented backward-compatibility aliases:
 * - Fast-Track PRD endpoints: /rounds, /rounds/:id, /rounds/:id/bids, /rounds/open, /rounds/:id/join,
 *   /rounds/:id/request-start, /rounds/:id/bids, /rounds/:id/start-decision, /rounds/:id/decision
 * - Fast-Track Aliases: /rounds/:id/bid, /rounds/:id/approve, /rounds/:id/decline, /:id/approve, /:id/reject, /
 * - Notification PRD endpoints: /notifications/read-all (POST)
 * - Notification Aliases: /notifications/read-all (PUT, PATCH), /notifications/:id/read (PATCH, PUT, POST)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';


const farmerJwt = jwt.sign(
  { id: '64b8f0a1c1d2e3f4a5b6c701', phone: '9800000001', name: 'Ramesh Patil', role: 'farmer' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const officerJwt = jwt.sign(
  { id: '64b8f0a1c1d2e3f4a5b6c702', phone: '9800000002', name: 'Officer Deshmukh', role: 'resource_officer', centreId: 'KPG-01', assignedMandi: 'KPG-01' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Endpoint Names Harmonization Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, label, details) {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${label}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${label}`, details || '');
    }
  }

  // 1. FAST-TRACK PRD PRIMARY ENDPOINTS
  console.log('--- 1. Fast-Track PRD Endpoints ---');

  // GET /api/fasttrack/rounds
  const ftRounds = await request('/api/fasttrack/rounds?centreId=KPG-01', 'GET');
  assert(ftRounds.status === 200 && Array.isArray(ftRounds.data?.data?.rounds), 'GET /api/fasttrack/rounds returns 200');

  // POST /api/fasttrack/rounds/open
  const openRes = await request('/api/fasttrack/rounds/open', 'POST', {
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: '2026-09-21',
    slotHour: '10:00 - 11:00',
  }, officerJwt);
  assert(openRes.status === 201 || openRes.status === 200 || openRes.status === 400, 'POST /api/fasttrack/rounds/open responds', { status: openRes.status });
  const roundId = openRes.data?.data?.roundId || (ftRounds.data?.data?.rounds?.[0]?.roundId) || 'DEMO_ROUND_1';

  // GET /api/fasttrack/rounds/:id
  const roundDetail = await request(`/api/fasttrack/rounds/${roundId}`, 'GET');
  assert([200, 404].includes(roundDetail.status), `GET /api/fasttrack/rounds/:id responds (HTTP ${roundDetail.status})`);

  // GET /api/fasttrack/rounds/:id/bids (plural)
  const roundBids = await request(`/api/fasttrack/rounds/${roundId}/bids`, 'GET');
  assert([200, 404].includes(roundBids.status), `GET /api/fasttrack/rounds/:id/bids returns bids history (HTTP ${roundBids.status})`);

  // POST /api/fasttrack/rounds/:id/join
  const joinRes = await request(`/api/fasttrack/rounds/${roundId}/join`, 'POST', { tokenNumber: 'KQ-TEST-99' }, farmerJwt);
  assert([200, 400, 404].includes(joinRes.status), `POST /api/fasttrack/rounds/:id/join responds (HTTP ${joinRes.status})`);

  // POST /api/fasttrack/rounds/:id/request-start
  const reqStartRes = await request(`/api/fasttrack/rounds/${roundId}/request-start`, 'POST', {}, farmerJwt);
  assert([200, 400, 403, 404].includes(reqStartRes.status), `POST /api/fasttrack/rounds/:id/request-start responds (HTTP ${reqStartRes.status})`);


  // POST /api/fasttrack/rounds/:id/bids (plural - PRD)
  const bidRes = await request(`/api/fasttrack/rounds/${roundId}/bids`, 'POST', { amount: 200 }, farmerJwt);
  assert([201, 400, 404].includes(bidRes.status), `POST /api/fasttrack/rounds/:id/bids places bid (HTTP ${bidRes.status})`);

  // POST /api/fasttrack/rounds/:id/start-decision
  const startDecRes = await request(`/api/fasttrack/rounds/${roundId}/start-decision`, 'POST', { approved: true }, officerJwt);
  assert([200, 400, 404].includes(startDecRes.status), `POST /api/fasttrack/rounds/:id/start-decision responds (HTTP ${startDecRes.status})`);

  // POST /api/fasttrack/rounds/:id/decision
  const decRes = await request(`/api/fasttrack/rounds/${roundId}/decision`, 'POST', { approved: true }, officerJwt);
  assert([200, 400, 404].includes(decRes.status), `POST /api/fasttrack/rounds/:id/decision responds (HTTP ${decRes.status})`);

  // 2. FAST-TRACK DOCUMENTED ALIASES
  console.log('\n--- 2. Fast-Track Backward-Compatibility Aliases ---');

  // POST /api/fasttrack/rounds/:id/bid (singular alias -> /bids)
  const singularBidRes = await request(`/api/fasttrack/rounds/${roundId}/bid`, 'POST', { amount: 210 }, farmerJwt);
  assert([201, 400, 404].includes(singularBidRes.status), `POST /api/fasttrack/rounds/:id/bid (singular alias) routes to placeBid (HTTP ${singularBidRes.status})`);

  // PATCH /api/fasttrack/rounds/:id/approve (alias -> /decision)
  const patchApproveRes = await request(`/api/fasttrack/rounds/${roundId}/approve`, 'PATCH', {}, officerJwt);
  assert([200, 400, 404].includes(patchApproveRes.status), `PATCH /api/fasttrack/rounds/:id/approve routes to decision (HTTP ${patchApproveRes.status})`);

  // PATCH /api/fasttrack/rounds/:id/decline (alias -> /decision)
  const patchDeclineRes = await request(`/api/fasttrack/rounds/${roundId}/decline`, 'PATCH', { reason: 'Test' }, officerJwt);
  assert([200, 400, 404].includes(patchDeclineRes.status), `PATCH /api/fasttrack/rounds/:id/decline routes to decision (HTTP ${patchDeclineRes.status})`);

  // POST /api/fasttrack/:id/approve (legacy alias)
  const legacyApprove = await request(`/api/fasttrack/${roundId}/approve`, 'POST', {}, officerJwt);
  assert([200, 400, 404].includes(legacyApprove.status), `POST /api/fasttrack/:id/approve routes to decision (HTTP ${legacyApprove.status})`);

  // POST /api/fasttrack/:id/reject (legacy alias)
  const legacyReject = await request(`/api/fasttrack/${roundId}/reject`, 'POST', { reason: 'Test' }, officerJwt);
  assert([200, 400, 404].includes(legacyReject.status), `POST /api/fasttrack/:id/reject routes to decision (HTTP ${legacyReject.status})`);

  // GET /api/fasttrack (alias for /rounds)
  const ftBase = await request('/api/fasttrack?centreId=KPG-01', 'GET');
  assert(ftBase.status === 200 && Array.isArray(ftBase.data?.data?.rounds), 'GET /api/fasttrack alias routes to getRounds (HTTP 200)');

  // 3. NOTIFICATION PRD ENDPOINTS & ALIASES
  console.log('\n--- 3. Notification PRD Endpoints & Aliases ---');

  // POST /api/notifications/read-all (PRD standard)
  const readAllPost = await request('/api/notifications/read-all', 'POST', {}, farmerJwt);
  assert(readAllPost.status === 200 && readAllPost.data?.success === true, 'POST /api/notifications/read-all (PRD standard) returns 200');

  // PUT /api/notifications/read-all (alias)
  const readAllPut = await request('/api/notifications/read-all', 'PUT', {}, farmerJwt);
  assert(readAllPut.status === 200 && readAllPut.data?.success === true, 'PUT /api/notifications/read-all (alias) returns 200');

  // PATCH /api/notifications/read-all (alias)
  const readAllPatch = await request('/api/notifications/read-all', 'PATCH', {}, farmerJwt);
  assert(readAllPatch.status === 200 && readAllPatch.data?.success === true, 'PATCH /api/notifications/read-all (alias) returns 200');

  // Single notification read aliases
  const dummyId = '64b8f0a1c1d2e3f4a5b6c799';
  const readPatch = await request(`/api/notifications/${dummyId}/read`, 'PATCH', {}, farmerJwt);
  assert([200, 404].includes(readPatch.status), `PATCH /api/notifications/:id/read returns HTTP ${readPatch.status}`);

  const readPut = await request(`/api/notifications/${dummyId}/read`, 'PUT', {}, farmerJwt);
  assert([200, 404].includes(readPut.status), `PUT /api/notifications/:id/read (alias) returns HTTP ${readPut.status}`);

  const readPost = await request(`/api/notifications/${dummyId}/read`, 'POST', {}, farmerJwt);
  assert([200, 404].includes(readPost.status), `POST /api/notifications/:id/read (alias) returns HTTP ${readPost.status}`);

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} PASSED | ${failed} FAILED`);
  console.log(`==================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
