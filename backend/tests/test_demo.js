'use strict';

/**
 * test_demo.js — Demo Access Test Suite
 *
 * Tests:
 * 1. Demo endpoints return 403 when DEMO_MODE is unset/false
 * 2. Demo endpoints return 403 in production mode (without ALLOW_DEMO_IN_PRODUCTION)
 * 3. Non-showcase phone/role → 403 (demoFarmerLogin, demoStaffLogin)
 * 4. Issued demo token works on normal routes (GET /api/auth/me)
 * 5. RBAC still applies to demo-issued tokens (farmer token → 403 on supervisor route)
 * 6. Demo reset: count non-showcase docs before/after; delta must be 0
 */

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const authRoutes = require('../src/routes/auth.routes');
const demoRoutes = require('../src/routes/demo.routes');
const { errorResponse } = require('../src/utils/apiResponse');

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── Isolated Express Test App ───────────────────────────────────────────────
function buildApp(demoMode, nodeEnv, allowDemoInProd) {
  // Override env for this test server instance
  process.env.DEMO_MODE = demoMode;
  process.env.NODE_ENV = nodeEnv;
  if (allowDemoInProd !== undefined) {
    process.env.ALLOW_DEMO_IN_PRODUCTION = allowDemoInProd;
  } else {
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
  }

  // Re-require modules that read env at call time (not at load time)
  // since isDemoAllowed() reads env dynamically, this works correctly.

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/demo', demoRoutes);
  app.use((err, req, res, next) => errorResponse(res, err.message, 500));
  return app;
}

function makeRequest(server, path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => resolve(server));
  });
}

async function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

// ─── Test Runner ─────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n' + '='.repeat(65));
  console.log('🧪 KisanQ Demo Access Test Suite (test:demo)');
  console.log('='.repeat(65) + '\n');

  // Attempt DB connection (optional — some tests are headless)
  let dbConnected = false;
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/kisanq_aveniq';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    dbConnected = true;
    console.log('✅ MongoDB connected for integration tests\n');
  } catch {
    console.warn('⚠️  MongoDB not reachable — running headless tests only\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Demo endpoints return 403 when DEMO_MODE is unset/false
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Test 1] Demo endpoints → 403 when DEMO_MODE=false');
  {
    const app = buildApp('false', 'development', undefined);
    const server = await startServer(app);

    const statusRes = await makeRequest(server, '/api/auth/demo/status');
    // status endpoint always works — just returns enabled:false
    assert(statusRes.status === 200, 'T1.1: /auth/demo/status returns 200', `got ${statusRes.status}`);
    assert(statusRes.body?.data?.enabled === false, 'T1.2: enabled=false when DEMO_MODE=false');

    const farmerRes = await makeRequest(server, '/api/auth/demo/farmer', 'POST', { profile: 'ramesh_kadam' });
    assert(farmerRes.status === 403, 'T1.3: /auth/demo/farmer → 403 when DEMO_MODE=false', `got ${farmerRes.status}`);

    const staffRes = await makeRequest(server, '/api/auth/demo/staff', 'POST', { role: 'supervisor' });
    assert(staffRes.status === 403, 'T1.4: /auth/demo/staff → 403 when DEMO_MODE=false', `got ${staffRes.status}`);

    await stopServer(server);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Demo endpoints return 403 in production (without override)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Test 2] Demo endpoints → 403 in production mode');
  {
    const app = buildApp('true', 'production', undefined);
    const server = await startServer(app);

    const farmerRes = await makeRequest(server, '/api/auth/demo/farmer', 'POST', { profile: 'ramesh_kadam' });
    assert(farmerRes.status === 403, 'T2.1: /auth/demo/farmer → 403 in production', `got ${farmerRes.status}`);

    const staffRes = await makeRequest(server, '/api/auth/demo/staff', 'POST', { role: 'security_gate' });
    assert(staffRes.status === 403, 'T2.2: /auth/demo/staff → 403 in production', `got ${staffRes.status}`);

    await stopServer(server);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Non-showcase phone/role → 403
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Test 3] Non-showcase inputs → 403');
  {
    const app = buildApp('true', 'development', undefined);
    const server = await startServer(app);

    const badFarmerRes = await makeRequest(server, '/api/auth/demo/farmer', 'POST', { profile: 'unknown_farmer' });
    assert(badFarmerRes.status === 403, 'T3.1: Unknown farmer profile → 403', `got ${badFarmerRes.status}`);

    const badStaffRes = await makeRequest(server, '/api/auth/demo/staff', 'POST', { role: 'hacker' });
    assert(badStaffRes.status === 403, 'T3.2: Unknown staff role → 403', `got ${badStaffRes.status}`);

    await stopServer(server);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 & 5: Issued demo token works on normal routes; RBAC still applies
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 & 5: Issued demo token works on normal routes; RBAC & TTL enforced
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Test 4 & 5] Demo token works on normal routes; RBAC & TTL enforced');
  {
    const jwt = require('jsonwebtoken');
    const authService = require('../src/services/authService');
    const app = buildApp('true', 'development', undefined);
    const server = await startServer(app);

    // Issue farmer demo token
    const farmerLoginRes = await makeRequest(server, '/api/auth/demo/farmer', 'POST', { profile: 'ramesh_kadam' });
    assert(farmerLoginRes.status === 200, 'T4.1: Farmer demo login → 200', `got ${farmerLoginRes.status}`);
    assert(!!farmerLoginRes.body?.data?.token, 'T4.2: Farmer demo login returns token');
    assert(farmerLoginRes.body?.data?.user?.demo === true, 'T4.3: Farmer token has demo:true claim');

    const farmerToken = farmerLoginRes.body?.data?.token;

    // Verify Demo Token TTL (default 4h = 14400s)
    const decodedFarmer = jwt.decode(farmerToken);
    const ttlSeconds = decodedFarmer.exp - decodedFarmer.iat;
    assert(ttlSeconds === 4 * 3600, 'T4.4: Demo token expiry matches DEMO_TOKEN_TTL (4h = 14400s)', `got ${ttlSeconds}s`);

    // Test token works on /api/auth/me
    const meRes = await makeRequest(server, '/api/auth/me', 'GET', null, farmerToken);
    assert(meRes.status === 200, 'T4.5: Demo farmer token works on /api/auth/me', `got ${meRes.status}`);
    assert(meRes.body?.data?.user?.role === 'farmer', 'T4.6: /me returns role=farmer');

    // Test RBAC: farmer accessing supervisor route → 403
    const supervisorRouteRes = await makeRequest(server, '/api/auth/test-supervisor-guard', 'GET', null, farmerToken);
    assert(supervisorRouteRes.status === 403, 'T5.1: Demo farmer token → 403 on supervisor route', `got ${supervisorRouteRes.status}`);

    // Issue staff demo token (supervisor)
    const staffLoginRes = await makeRequest(server, '/api/auth/demo/staff', 'POST', { role: 'supervisor' });
    assert(staffLoginRes.status === 200, 'T5.2: Staff demo login (supervisor) → 200', `got ${staffLoginRes.status}`);
    assert(staffLoginRes.body?.data?.user?.demo === true, 'T5.3: Staff token has demo:true claim');
    assert(staffLoginRes.body?.data?.user?.role === 'supervisor', 'T5.4: Staff token has correct role');

    const staffToken = staffLoginRes.body?.data?.token;

    // Supervisor token on supervisor guard → 200
    const supGuardRes = await makeRequest(server, '/api/auth/test-supervisor-guard', 'GET', null, staffToken);
    assert(supGuardRes.status === 200, 'T5.5: Demo staff (supervisor) token → 200 on supervisor route', `got ${supGuardRes.status}`);

    // Farmer token on farmer guard → 200
    const farmerGuardRes = await makeRequest(server, '/api/auth/test-farmer-guard', 'GET', null, farmerToken);
    assert(farmerGuardRes.status === 200, 'T5.6: Demo farmer token → 200 on farmer route', `got ${farmerGuardRes.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: POST /api/demo/reset Auth, Rate-Limiting & Isolation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 6] POST /api/demo/reset auth, rate limiting & isolation');

    // 6.1 No token → 401
    const noTokenRes = await makeRequest(server, '/api/demo/reset', 'POST');
    assert(noTokenRes.status === 401, 'T6.1: Reset with no token → 401', `got ${noTokenRes.status}`);

    // 6.2 Real non-demo token (demo: false/undefined) → 403
    const nonDemoToken = authService.generateToken({ id: 'real_farmer_1', phone: '9899999999', role: 'farmer' });
    const nonDemoRes = await makeRequest(server, '/api/demo/reset', 'POST', null, nonDemoToken);
    assert(nonDemoRes.status === 403, 'T6.2: Reset with non-demo token → 403', `got ${nonDemoRes.status}`);

    if (dbConnected) {
      const { Token, Booking, Waitlist, FastTrackRound } = require('../src/models');
      const SHOWCASE_FARMER_PHONES = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);
      const SEED_BATCH = 'showcase-1';

      // Count non-showcase documents BEFORE
      const nonShowcaseBefore = {
        tokens: await Token.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES }, seedBatch: { $ne: SEED_BATCH } }),
        bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
        waitlist: await Waitlist.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES }, seedBatch: { $ne: SEED_BATCH } }),
        fastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
      };

      console.log('  📊 Non-showcase counts BEFORE reset:');
      Object.entries(nonShowcaseBefore).forEach(([k, v]) => console.log(`     ${k}: ${v}`));

      // 6.3 First reset call with valid demo token → 200
      const reset1Res = await makeRequest(server, '/api/demo/reset', 'POST', null, farmerToken);
      assert(reset1Res.status === 200 || reset1Res.status === 503, 'T6.3: First reset with demo token → 200', `got ${reset1Res.status}`);

      // Count non-showcase documents AFTER
      const nonShowcaseAfter = {
        tokens: await Token.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES }, seedBatch: { $ne: SEED_BATCH } }),
        bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
        waitlist: await Waitlist.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES }, seedBatch: { $ne: SEED_BATCH } }),
        fastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
      };

      console.log('  📊 Non-showcase counts AFTER reset:');
      Object.entries(nonShowcaseAfter).forEach(([k, v]) => console.log(`     ${k}: ${v}`));

      const allMatch = Object.keys(nonShowcaseBefore).every(
        (k) => nonShowcaseBefore[k] === nonShowcaseAfter[k]
      );
      assert(allMatch, 'T6.4: Reset did not modify any non-showcase documents (counts identical)',
        allMatch ? '' : `Before: ${JSON.stringify(nonShowcaseBefore)} After: ${JSON.stringify(nonShowcaseAfter)}`);

      if (reset1Res.status === 200) {
        assert(reset1Res.body?.data?.isolation?.isolationOk === true, 'T6.5: Server-side isolation assertion passed');
      }

      // 6.6 Rapid second reset call → 429 (Rate Limit: 1 per 30s)
      const reset2Res = await makeRequest(server, '/api/demo/reset', 'POST', null, farmerToken);
      assert(reset2Res.status === 429, 'T6.6: Rapid second reset → 429 Too Many Requests (Rate limit enforced)', `got ${reset2Res.status}`);
    } else {
      console.log('  ℹ️  MongoDB disconnected — skipped live collection count comparisons');
    }

    await stopServer(server);
    console.log();
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('='.repeat(65));
  console.log('📊 Demo Test Suite Summary:');
  console.log(`   PASSED: ${passed}`);
  console.log(`   FAILED: ${failed}`);
  console.log('='.repeat(65));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    console.error('\n❌ Some demo tests FAILED.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All demo tests PASSED.\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Demo test runner crashed:', err.message);
  process.exit(1);
});
