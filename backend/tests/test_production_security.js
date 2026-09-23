'use strict';

/**
 * test_production_security.js
 *
 * Pre-deploy verification test suite for production security hardening:
 * 1. ALLOW_DEV_AUTH defaults to false in production (and devOtp is omitted).
 * 2. DEMO_MODE requires explicit enablement and refuses in production unless overridden.
 * 3. Dev OTP bypass codes (123456, 999999, 111111) are strictly refused.
 * 4. Staff login fails closed with a clear configuration error when STAFF_DEMO_PASSWORD is unset in production.
 * 5. When STAFF_DEMO_PASSWORD is configured in production, only that password is accepted; legacy fallback is rejected.
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const authService = require('../src/services/authService');
const { isDemoAllowed } = require('../src/middleware/demo.middleware');

async function runProductionSecurityTests() {
  console.log('\n============================================================');
  console.log('🔒 PRODUCTION SECURITY & FAIL-CLOSED AUTHENTICATION TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // ─── PROOF 1: ALLOW_DEV_AUTH Defaults False in Production ───────────────────
  console.log('📋 [PROOF 1] Verifying ALLOW_DEV_AUTH defaults false when unset in production:');
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DEV_AUTH;
  delete process.env.STAFF_DEMO_PASSWORD;
  delete process.env.DEMO_MODE;
  delete process.env.ALLOW_DEMO_IN_PRODUCTION;

  assert(!authService.isDevAuthAllowed(), 'isDevAuthAllowed() returns false when ALLOW_DEV_AUTH is unset in NODE_ENV=production');

  const farmerReqRes = await authService.requestFarmerOtp({
    phone: '9899999901',
    name: 'SecTest Farmer',
    mode: 'register'
  });
  assert(farmerReqRes.devOtp === undefined, 'devOtp is omitted/undefined in requestFarmerOtp response');

  // ─── PROOF 2: DEMO_MODE Requires Explicit Enabling ─────────────────────────
  console.log('\n📋 [PROOF 2] Verifying DEMO_MODE requires explicit true and safeguards production:');
  delete process.env.DEMO_MODE;
  assert(!isDemoAllowed(), 'isDemoAllowed() returns false when DEMO_MODE is unset');

  process.env.DEMO_MODE = 'false';
  assert(!isDemoAllowed(), 'isDemoAllowed() returns false when DEMO_MODE="false"');

  process.env.DEMO_MODE = 'true';
  assert(!isDemoAllowed(), 'isDemoAllowed() returns false when DEMO_MODE="true" but NODE_ENV="production" (fails closed without ALLOW_DEMO_IN_PRODUCTION)');

  process.env.ALLOW_DEMO_IN_PRODUCTION = 'true';
  assert(isDemoAllowed(), 'isDemoAllowed() returns true only when DEMO_MODE="true" AND ALLOW_DEMO_IN_PRODUCTION="true"');
  delete process.env.ALLOW_DEMO_IN_PRODUCTION;
  delete process.env.DEMO_MODE;

  // ─── PROOF 3: Dev OTP Bypasses Strictly Refused ───────────────────────────
  console.log('\n📋 [PROOF 3] Verifying dev OTP bypass codes (123456, 999999, 111111) are refused:');
  for (const bypassCode of ['123456', '999999', '111111']) {
    try {
      await authService.verifyFarmerOtp({
        phone: '9899999902',
        otp: bypassCode
      });
      assert(false, `Bypass OTP ${bypassCode} was accepted (SHOULD HAVE BEEN REFUSED)`);
    } catch (err) {
      assert(
        err.statusCode === 401 || err.statusCode === 400,
        `Bypass OTP ${bypassCode} refused: [${err.statusCode}] ${err.message}`
      );
    }
  }

  // Refusal against an existing active request
  await authService.requestFarmerOtp({
    phone: '9899999903',
    name: 'SecTest Farmer Active',
    mode: 'register'
  });
  for (const bypassCode of ['123456', '999999', '111111']) {
    try {
      await authService.verifyFarmerOtp({
        phone: '9899999903',
        otp: bypassCode
      });
      assert(false, `Bypass OTP ${bypassCode} accepted against active request (SHOULD HAVE BEEN REFUSED)`);
    } catch (err) {
      assert(
        err.statusCode === 401,
        `Bypass OTP ${bypassCode} against active request refused: [${err.statusCode}] ${err.message}`
      );
    }
  }

  // ─── PROOF 4: Staff Login Fails Closed Without STAFF_DEMO_PASSWORD ────────
  console.log('\n📋 [PROOF 4] Verifying staff login fails closed with clear config error without STAFF_DEMO_PASSWORD:');
  delete process.env.STAFF_DEMO_PASSWORD;
  assert(authService.getStaffDefaultPassword() === null, 'getStaffDefaultPassword() returns null in production when STAFF_DEMO_PASSWORD is unset');

  // Test verifyStaffCredentials (Step 1 2FA)
  try {
    await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: 'AnyPassword123',
      role: 'security_gate'
    });
    assert(false, 'verifyStaffCredentials succeeded without STAFF_DEMO_PASSWORD (SHOULD HAVE FAILED CLOSED)');
  } catch (err) {
    assert(
      err.statusCode === 500 && err.message.includes('STAFF_DEMO_PASSWORD'),
      `verifyStaffCredentials failed closed: [${err.statusCode}] ${err.message}`
    );
  }

  // Test legacy staffLogin
  try {
    await authService.staffLogin({
      phone: '9800000001',
      password: 'AnyPassword123'
    });
    assert(false, 'staffLogin succeeded without STAFF_DEMO_PASSWORD (SHOULD HAVE FAILED CLOSED)');
  } catch (err) {
    assert(
      err.statusCode === 500 && err.message.includes('STAFF_DEMO_PASSWORD'),
      `staffLogin failed closed: [${err.statusCode}] ${err.message}`
    );
  }

  // ─── PROOF 5: Configured STAFF_DEMO_PASSWORD Works & Rejects Old Default ─
  console.log('\n📋 [PROOF 5] Verifying behavior when STAFF_DEMO_PASSWORD is set in production:');
  const PROD_PASSWORD = 'ProductionSecretPass2026!';
  process.env.STAFF_DEMO_PASSWORD = PROD_PASSWORD;
  assert(authService.getStaffDefaultPassword() === PROD_PASSWORD, 'getStaffDefaultPassword() returns configured STAFF_DEMO_PASSWORD');

  // Re-seed registry with the new production password
  await authService.seedStaffRegistry();

  // Attempt login with old default 'Staff@KisanQ2026' -> must be REFUSED
  try {
    await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: 'Staff@KisanQ2026',
      role: 'security_gate'
    });
    assert(false, 'Old hardcoded password Staff@KisanQ2026 accepted in production (SHOULD HAVE BEEN REFUSED)');
  } catch (err) {
    assert(
      err.statusCode === 401,
      `Old password Staff@KisanQ2026 refused: [${err.statusCode}] ${err.message}`
    );
  }

  // Attempt login with real configured STAFF_DEMO_PASSWORD -> must SUCCEED
  try {
    const credRes = await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: PROD_PASSWORD,
      role: 'security_gate'
    });
    assert(Boolean(credRes.challengeToken), 'Configured STAFF_DEMO_PASSWORD accepted and issued challengeToken');
  } catch (err) {
    assert(false, `Configured STAFF_DEMO_PASSWORD failed: ${err.message}`);
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`🎯 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runProductionSecurityTests().catch((err) => {
  console.error('Test suite crashed with unhandled exception:', err);
  process.exit(1);
});
