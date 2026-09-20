/**
 * Test Production Security:
 * Verifies that in NODE_ENV=production (or ALLOW_DEV_AUTH=false):
 * 1. 123456 / 999999 / 111111 magic OTP bypasses are refused.
 * 2. devOtp is omitted in requestFarmerOtp response.
 * 3. Shared staff password fallback (Staff@KisanQ2026 / 123456) without matching hash is refused.
 * 4. Staff 2FA bypass (entering 123456 without it being the challenge OTP) is refused.
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const authService = require('../src/services/authService');

async function runSecurityTests() {
  console.log('=== RUNNING PRODUCTION SECURITY TEST SUITE ===');
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

  // Set environment to production
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DEV_AUTH;

  assert(!authService.isDevAuthAllowed(), 'isDevAuthAllowed() returns false when NODE_ENV=production');

  // Test 1: devOtp is omitted in requestFarmerOtp
  try {
    const reqRes = await authService.requestFarmerOtp({
      phone: '9899999901',
      name: 'SecTest Farmer',
      mode: 'register'
    });
    assert(reqRes.devOtp === undefined, 'devOtp field is undefined/omitted in requestFarmerOtp when NODE_ENV=production');
  } catch (err) {
    assert(false, `requestFarmerOtp threw unexpected error: ${err.message}`);
  }

  // Test 2: Magic OTP bypasses (123456, 999999, 111111) are REFUSED without an active OTP request
  for (const magicOtp of ['123456', '999999', '111111']) {
    try {
      await authService.verifyFarmerOtp({
        phone: '9899999902', // No request made for this phone
        otp: magicOtp
      });
      assert(false, `Magic OTP ${magicOtp} was accepted when NODE_ENV=production (SHOULD HAVE BEEN REFUSED)`);
    } catch (err) {
      assert(
        err.statusCode === 401 || err.statusCode === 400,
        `Magic OTP ${magicOtp} correctly refused in production: [${err.statusCode}] ${err.message}`
      );
    }
  }

  // Test 3: Magic OTP bypasses (123456, 999999, 111111) are REFUSED even when an OTP request exists (wrong OTP)
  const reqRes2 = await authService.requestFarmerOtp({
    phone: '9899999903',
    name: 'SecTest Farmer 2',
    mode: 'register'
  });
  for (const magicOtp of ['123456', '999999', '111111']) {
    try {
      await authService.verifyFarmerOtp({
        phone: '9899999903',
        otp: magicOtp
      });
      assert(false, `Magic OTP ${magicOtp} bypass accepted against active request (SHOULD HAVE BEEN REFUSED)`);
    } catch (err) {
      assert(
        err.statusCode === 401,
        `Magic OTP ${magicOtp} against active request refused: [${err.statusCode}] ${err.message}`
      );
    }
  }

  // Test 4: Shared staff password bypass refused when hash does not match
  // Create an in-memory staff user with a specific password hash: 'RealPassword123'
  const realHash = await bcrypt.hash('RealPassword123', 10);
  const testStaffId = new mongoose.Types.ObjectId();
  authService.inMemoryStaff = authService.inMemoryStaff || new Map();
  // We will call verifyStaffCredentials with a mocked staff lookup
  // Let's test by verifying against an actual staff user or mock
  const { StaffUser } = require('../src/models');
  
  // Test password bypass with wrong password on existing seeded user
  try {
    await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: 'WrongPassword999',
      role: 'security_gate'
    });
    assert(false, 'Wrong password accepted (SHOULD HAVE BEEN REFUSED)');
  } catch (err) {
    assert(err.statusCode === 401, `Wrong password refused: [${err.statusCode}] ${err.message}`);
  }

  // Test shared password fallback '123456' on a user whose real hash is NOT 123456
  // (SEEDED_STAFF_REGISTRY password is Staff@KisanQ2026, so '123456' has no hash match)
  try {
    await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: '123456',
      role: 'security_gate'
    });
    assert(false, 'Dev master password 123456 accepted without hash match in production (SHOULD HAVE BEEN REFUSED)');
  } catch (err) {
    assert(err.statusCode === 401, `Dev master password 123456 refused without hash match: [${err.statusCode}] ${err.message}`);
  }

  // Test 5: Staff 2FA bypass refused in production
  // Initiate challenge for 9800000001 using its genuine password
  let challengeToken;
  try {
    const credRes = await authService.verifyStaffCredentials({
      phone: '9800000001',
      password: 'Staff@KisanQ2026',
      role: 'security_gate'
    });
    challengeToken = credRes.challengeToken;
    assert(Boolean(challengeToken), 'Staff credentials verified with genuine password, challengeToken issued');
  } catch (err) {
    assert(false, `Staff credentials failed: ${err.message}`);
  }

  if (challengeToken) {
    // Attempt 2FA verification using bypass code '123456'
    try {
      await authService.verifyStaffOtp({
        challengeToken,
        otp: '123456'
      });
      assert(false, 'Staff 2FA bypass code 123456 accepted in production (SHOULD HAVE BEEN REFUSED)');
    } catch (err) {
      assert(err.statusCode === 401, `Staff 2FA bypass code 123456 refused: [${err.statusCode}] ${err.message}`);
    }
  }

  // Test 6: Verify explicit ALLOW_DEV_AUTH=false flag when NODE_ENV is development
  process.env.NODE_ENV = 'development';
  process.env.ALLOW_DEV_AUTH = 'false';
  assert(!authService.isDevAuthAllowed(), 'isDevAuthAllowed() returns false when ALLOW_DEV_AUTH="false"');

  const devReq = await authService.requestFarmerOtp({
    phone: '9899999904',
    name: 'SecTest Farmer 4',
    mode: 'register'
  });
  assert(devReq.devOtp === undefined, 'devOtp omitted when ALLOW_DEV_AUTH="false" even in development');

  try {
    await authService.verifyFarmerOtp({
      phone: '9899999905',
      otp: '999999'
    });
    assert(false, 'Magic OTP 999999 accepted when ALLOW_DEV_AUTH="false" (SHOULD HAVE BEEN REFUSED)');
  } catch (err) {
    assert(err.statusCode === 401, `Magic OTP 999999 refused when ALLOW_DEV_AUTH="false": [${err.statusCode}] ${err.message}`);
  }

  console.log('\n=============================================');
  console.log(`PRODUCTION SECURITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runSecurityTests().catch(err => {
  console.error('Test suite failed with unhandled error:', err);
  process.exit(1);
});
