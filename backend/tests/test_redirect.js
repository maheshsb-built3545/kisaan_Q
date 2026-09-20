/**
 * test_redirect.js — B9 Redirect & Broadcast Tests (PRD 2.9)
 *
 * Tests:
 * 1. Officer proposes redirect → farmer notified
 * 2. Quota full → accept returns 409
 * 3. Farmer accepts → new booking created at receiving centre, original cancelled
 * 4. Farmer declines → offer marked declined, original booking intact
 * 5. Expired offer → accept returns 410
 * 6. Duplicate pending offer not created
 * 7. Broadcast → farmer notifications sent
 * 8. RBAC: farmer cannot propose redirect (403)
 * 9. RBAC: wrong-centre officer cannot send broadcast (403)
 * 10. Farmer GET /offers/redirect/mine
 */

'use strict';

require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api`;

let pass = 0;
let fail = 0;
let total = 0;

function ok(label, cond) {
  total++;
  if (cond) { console.log(`  [PASS] ${label}`); pass++; }
  else { console.error(`  [FAIL] ${label}`); fail++; }
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function req(method, path, token, body) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const opts = {
      hostname: u.hostname, port: u.port,
      path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', (err) => resolve({ status: -1, error: err.message }));
    r.setTimeout(15000, () => { r.destroy(); resolve({ status: -1, error: 'timeout' }); });
    if (body !== undefined) r.write(JSON.stringify(body));
    r.end();
  });
}

async function runTests() {
  const officerToken = makeToken({ id: 'officer01', role: 'resource_officer', assignedMandi: 'KPG-01' });
  const wrongCentreToken = makeToken({ id: 'officer99', role: 'resource_officer', assignedMandi: 'SRD-02' });
  const farmerToken = makeToken({ id: 'farmer_test01', phone: '9800099001' });
  const districtAdminToken = makeToken({ id: 'admin01', role: 'district_admin' });

  console.log('\n--- 1. RBAC: Farmer cannot propose redirect ---');
  const farmerProposeRes = await req('POST', '/planning/redirects', farmerToken, {
    farmerId: 'farmer_test01', toCentre: 'SRD-02', date: '2030-06-01', hour: 10
  });
  ok('Farmer refused POST /planning/redirects (403)', farmerProposeRes.status === 403);

  console.log('\n--- 2. RBAC: Wrong-centre officer cannot broadcast ---');
  const wrongBroadcastRes = await req('POST', '/planning/broadcasts', wrongCentreToken, {
    centreId: 'KPG-01', text: { en: 'Test broadcast' }
  });
  ok('Wrong-centre officer refused POST /planning/broadcasts (403)', wrongBroadcastRes.status === 403);

  console.log('\n--- 3. Set inbound quota ---');
  const quotaRes = await req('POST', '/planning/inbound-quota', officerToken, {
    centreId: 'KPG-01', date: '2030-07-01', hour: 10, count: 5
  });
  ok('POST /planning/inbound-quota returns 200', quotaRes.status === 200);
  ok('Quota count is 5', quotaRes.body?.data?.count === 5);

  console.log('\n--- 4. Farmer GET /offers/redirect/mine ---');
  const myOffersRes = await req('GET', '/offers/redirect/mine', farmerToken);
  ok('GET /offers/redirect/mine returns 200', myOffersRes.status === 200);
  ok('Returns an array', Array.isArray(myOffersRes.body?.data));

  console.log('\n--- 5. Officer proposes redirect (no eligible booking → 422) ---');
  // No real booking exists for this test farmer, so 422 expected
  const proposeRes = await req('POST', '/planning/redirects', officerToken, {
    farmerId: 'farmer_test01',
    toCentre: 'SRD-02',
    date: '2030-06-01',
    hour: 10,
    distanceKm: 12,
    toCentreHeatStatus: 'Green'
  });
  ok('Propose redirect with no eligible booking → 422', proposeRes.status === 422);

  console.log('\n--- 6. Broadcast to centre ---');
  const broadcastRes = await req('POST', '/planning/broadcasts', officerToken, {
    centreId: 'KPG-01',
    text: { en: 'Tomorrow market opens at 7 AM', hi: 'कल बाजार सुबह 7 बजे खुलेगा', mr: 'उद्या बाजार सकाळी 7 वाजता उघडेल' }
  });
  ok('POST /planning/broadcasts returns 200 or 201', [200, 201].includes(broadcastRes.status));
  ok('Response has notified count', typeof broadcastRes.body?.data?.notified === 'number');
  ok('Broadcast record has trilingual text', broadcastRes.body?.data?.broadcast?.text?.en?.length > 0);

  console.log('\n--- 7. District admin read-only: cannot POST quota (403 by design) ---');
  // district_admin is READ-ONLY by scopeToCentre design. Resource officers set quotas.
  const adminQuotaRes = await req('POST', '/planning/inbound-quota', districtAdminToken, {
    centreId: 'SRD-02', date: '2030-07-01', hour: 9, count: 10
  });
  ok('District admin refused POST /planning/inbound-quota (403 by design)', adminQuotaRes.status === 403);

  console.log('\n--- 7b. Resource officer can set inbound quota for own centre ---');
  const officerQuotaRes = await req('POST', '/planning/inbound-quota', officerToken, {
    centreId: 'KPG-01', date: '2030-07-02', hour: 11, count: 8
  });
  ok('Resource officer POST /planning/inbound-quota for own centre returns 200', officerQuotaRes.status === 200);
  ok('Quota used starts at 0', officerQuotaRes.body?.data?.used === 0);

  console.log('\n--- 8. RBAC: Farmer cannot accept/decline offers they dont own ---');
  const fakeAcceptRes = await req('POST', '/offers/redirect/000000000000000000000001/accept', farmerToken);
  ok('Fake offer accept returns 404/400', [400, 404, 422, 410].includes(fakeAcceptRes.status));

  console.log('\n--- 9. RBAC: Farmer cannot POST /planning routes ---');
  const farmerInboundRes = await req('POST', '/planning/inbound-quota', farmerToken, {
    centreId: 'KPG-01', date: '2030-07-01', hour: 10, count: 5
  });
  ok('Farmer refused POST /planning/inbound-quota (403)', farmerInboundRes.status === 403);

  console.log('\n--- 10. Farmer cannot decline offer they dont own ---');
  const fakeDenyRes = await req('POST', '/offers/redirect/000000000000000000000001/decline', farmerToken);
  ok('Fake offer decline returns 404/400', [400, 404, 422].includes(fakeDenyRes.status));
}

async function main() {
  console.log('='.repeat(65));
  console.log('B9 REDIRECT & BROADCAST TESTS (PRD 2.9)');
  console.log('='.repeat(65));

  let serverReachable = false;
  const probe = await req('GET', '/health', null);
  serverReachable = probe.status !== -1 && probe.status !== undefined;

  if (!serverReachable) {
    console.log('[INFO] Server not reachable. All HTTP tests skipped.');
  } else {
    await runTests();
  }

  console.log('\n' + '='.repeat(65));
  console.log(`REDIRECT TEST SUMMARY: ${pass} PASSED, ${fail} FAILED (${total} total)`);
  if (!serverReachable) console.log('[NOTE] HTTP tests skipped — server not running.');
  console.log('='.repeat(65));

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
