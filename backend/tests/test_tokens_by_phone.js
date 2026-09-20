/**
 * test_tokens_by_phone.js
 * Verifies that GET /api/tokens/farmer/:phone and /dues:
 *   - Require a valid JWT (401 without token)
 *   - Return 403 when Farmer A tries to read Farmer B's tokens
 *   - Return 200 when farmer reads own tokens
 *   - Return 200 for staff reading any farmer's tokens (staff role != 'farmer')
 */

require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

let passed = 0;
let failed = 0;

function assert(condition, message, evidence = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    if (evidence) console.log(`     ↳ ${evidence}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    if (evidence) console.error(`     ↳ ${evidence}`);
    failed++;
  }
}

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

async function runTests() {
  console.log('='.repeat(70));
  console.log('🔐 TOKENS BY PHONE — IDENTITY ENFORCEMENT TEST SUITE');
  console.log('='.repeat(70));
  console.log('\nBoth /api/tokens/farmer/:phone routes now require JWT.\n');

  // Synthetic tokens for two different farmers
  const farmerAPhone = '9800009101';
  const farmerBPhone = '9800009102';
  const staffPhone = '9800000006';

  const tokenA = jwt.sign({ phone: farmerAPhone, role: 'farmer', id: 'fid-a' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign({ phone: farmerBPhone, role: 'farmer', id: 'fid-b' }, JWT_SECRET, { expiresIn: '1h' });
  const staffToken = jwt.sign({ phone: staffPhone, role: 'resource_officer', assignedMandi: 'KPG-01', id: 'sid-1' }, JWT_SECRET, { expiresIn: '1h' });

  // -----------------------------------------------------------------------
  // 1. No JWT → 401
  // -----------------------------------------------------------------------
  console.log('--- Check 1: No JWT → 401 ---');
  const noAuth = await makeRequest(`/api/tokens/farmer/${farmerAPhone}`);
  assert(noAuth.status === 401, 'GET /tokens/farmer/:phone without JWT returns 401', `status=${noAuth.status}`);

  const noAuthDues = await makeRequest(`/api/tokens/farmer/${farmerAPhone}/dues`);
  assert(noAuthDues.status === 401, 'GET /tokens/farmer/:phone/dues without JWT returns 401', `status=${noAuthDues.status}`);

  // -----------------------------------------------------------------------
  // 2. Farmer A reads own tokens → 200
  // -----------------------------------------------------------------------
  console.log('\n--- Check 2: Farmer reads own tokens → 200 ---');
  const ownTokens = await makeRequest(`/api/tokens/farmer/${farmerAPhone}`, 'GET', null, tokenA);
  assert(ownTokens.status === 200, 'Farmer A reads own /tokens/farmer/A → 200', `status=${ownTokens.status}, count=${ownTokens.body?.count ?? 'n/a'}`);

  const ownDues = await makeRequest(`/api/tokens/farmer/${farmerAPhone}/dues`, 'GET', null, tokenA);
  assert(ownDues.status === 200, 'Farmer A reads own /tokens/farmer/A/dues → 200', `status=${ownDues.status}`);

  // -----------------------------------------------------------------------
  // 3. Farmer A reads Farmer B's tokens → 403
  // -----------------------------------------------------------------------
  console.log('\n--- Check 3: Farmer A cannot read Farmer B tokens → 403 ---');
  const crossTokens = await makeRequest(`/api/tokens/farmer/${farmerBPhone}`, 'GET', null, tokenA);
  assert(crossTokens.status === 403, 'Farmer A cannot read Farmer B /tokens/farmer/B → 403', `status=${crossTokens.status}, msg=${crossTokens.body?.message}`);

  const crossDues = await makeRequest(`/api/tokens/farmer/${farmerBPhone}/dues`, 'GET', null, tokenA);
  assert(crossDues.status === 403, 'Farmer A cannot read Farmer B /tokens/farmer/B/dues → 403', `status=${crossDues.status}, msg=${crossDues.body?.message}`);

  // -----------------------------------------------------------------------
  // 4. Staff reads any farmer → 200 (staff role ≠ 'farmer')
  // -----------------------------------------------------------------------
  console.log('\n--- Check 4: Staff reads farmer B tokens → 200 (staff privilege) ---');
  const staffTokens = await makeRequest(`/api/tokens/farmer/${farmerBPhone}`, 'GET', null, staffToken);
  assert(staffTokens.status === 200, 'Staff reads /tokens/farmer/B → 200', `status=${staffTokens.status}, count=${staffTokens.body?.count ?? 'n/a'}`);

  const staffDues = await makeRequest(`/api/tokens/farmer/${farmerBPhone}/dues`, 'GET', null, staffToken);
  assert(staffDues.status === 200, 'Staff reads /tokens/farmer/B/dues → 200', `status=${staffDues.status}`);

  // -----------------------------------------------------------------------
  // Results
  // -----------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`📊 TOKENS BY PHONE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
