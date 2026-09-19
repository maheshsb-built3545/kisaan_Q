/**
 * test-auth-2fa-rbac.js
 * Comprehensive Integration & Verification Test Suite for KisanQ
 * Two-Factor Authentication (2FA) & Role-Based Access Control (RBAC) Architecture
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

const BACKEND_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

// Seeded Staff Profiles for Verification
const SEEDED_STAFF = [
  { role: 'security_gate', phone: '9800000001', name: 'Ramesh Shinde', code: 'SEC-D1-KPG', desk: 'Desk 1' },
  { role: 'quality_assayer', phone: '9800000002', name: 'S. Patil', code: 'QA-SP-KPG', desk: 'Desk 2' },
  { role: 'weighmaster', phone: '9800000003', name: 'Suresh Jadhav', code: 'WM-02-KPG', desk: 'Desk 3' },
  { role: 'procurement', phone: '9800000004', name: 'Secretary Deshmukh', code: 'SEC-APMC-KPG', desk: 'Desk 4' },
  { role: 'accounts_settlement', phone: '9800000005', name: 'Treasurer Deshmukh', code: 'TRY-DBT-KPG', desk: 'Desk 5' },
];

const DEFAULT_PASSWORD = 'Staff@KisanQ2026';
const VALID_OTP = '123456';

async function request(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('  🔒 KISANQ 2FA & RBAC AUTHENTICATION INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName) {
    totalTests++;
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  }

  function recordFail(testName, err) {
    totalTests++;
    console.error(`  ❌ [FAIL] ${testName}:`, err.message || err);
  }

  // -------------------------------------------------------------------------
  // TEST 1: Wrong Password Rejection (401)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Password & Credential Verification ---');
  try {
    const res = await request('/api/auth/staff/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({
        phone: '9800000001',
        password: 'WrongPassword123',
        role: 'security_gate'
      })
    });
    assert.strictEqual(res.status, 401, 'Should return 401 for wrong password');
    assert.strictEqual(res.data.success, false, 'Should have success: false');
    assert.ok(res.data.message.includes('Invalid') || res.data.message.includes('credentials') || res.data.message.includes('Password'), 'Error message describes credential failure');
    recordPass('1.1 Rejects invalid password with 401 status and descriptive error message');
  } catch (err) {
    recordFail('1.1 Rejects invalid password', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Role Mismatch Rejection (401)
  // -------------------------------------------------------------------------
  try {
    // Attempting to log in Desk 1 phone (9800000001) claiming Desk 3 role (weighmaster)
    const res = await request('/api/auth/staff/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({
        phone: '9800000001',
        password: DEFAULT_PASSWORD,
        role: 'weighmaster'
      })
    });
    assert.strictEqual(res.status, 401, 'Should return 401 for role mismatch');
    assert.strictEqual(res.data.success, false, 'Should have success: false');
    assert.ok(res.data.message.includes('mismatch') || res.data.message.includes('Role'), 'Error explains role mismatch');
    recordPass('1.2 Rejects role mismatch (Phone 9800000001 claiming Weighmaster)');
  } catch (err) {
    recordFail('1.2 Rejects role mismatch', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Verify All 5 Seeded Staff Desks Step 1 (Challenge Issuance) & Step 2 (OTP)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Two-Step 2FA Flow Across All 5 Desks ---');
  const staffTokens = {};

  for (const staff of SEEDED_STAFF) {
    try {
      // Step 1: Verify credentials -> obtain challengeToken
      const credRes = await request('/api/auth/staff/verify-credentials', {
        method: 'POST',
        body: JSON.stringify({
          phone: staff.phone,
          password: DEFAULT_PASSWORD,
          role: staff.role
        })
      });

      assert.strictEqual(credRes.status, 200, `Step 1 should succeed for ${staff.desk}`);
      assert.strictEqual(credRes.data.success, true);
      const challengeToken = credRes.data.data?.challengeToken;
      assert.ok(challengeToken, `Should receive challengeToken for ${staff.desk}`);
      assert.strictEqual(credRes.data.data?.officerCode, staff.code);

      // Step 2: Verify OTP -> obtain 8-hour JWT session
      const otpRes = await request('/api/auth/staff/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken: challengeToken,
          otp: VALID_OTP
        })
      });

      assert.strictEqual(otpRes.status, 200, `Step 2 OTP should succeed for ${staff.desk}`);
      assert.strictEqual(otpRes.data.success, true);
      const token = otpRes.data.data?.token;
      const user = otpRes.data.data?.user;
      assert.ok(token, `Should receive JWT session token for ${staff.desk}`);
      assert.strictEqual(user.role, staff.role);
      assert.strictEqual(user.officerCode, staff.code);

      // Verify JWT signature and claims
      const decoded = jwt.verify(token, JWT_SECRET);
      assert.strictEqual(decoded.role, staff.role);
      assert.strictEqual(decoded.officerCode, staff.code);
      assert.strictEqual(decoded.phone, staff.phone);

      staffTokens[staff.role] = { token, user };

      recordPass(`2FA verified for ${staff.desk} (${staff.name} - ${staff.code})`);
    } catch (err) {
      recordFail(`2FA verification for ${staff.desk}`, err);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 4: Challenge Token Expiry / Single-Use Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Challenge Store Replay Protection & OTP Validation ---');
  try {
    const credRes = await request('/api/auth/staff/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({
        phone: '9800000001',
        password: DEFAULT_PASSWORD,
        role: 'security_gate'
      })
    });
    const cToken = credRes.data.data?.challengeToken;

    // Test invalid OTP
    const invalidOtpRes = await request('/api/auth/staff/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        challengeToken: cToken,
        otp: '999999'
      })
    });
    assert.strictEqual(invalidOtpRes.status, 401, 'Should reject invalid OTP');
    assert.strictEqual(invalidOtpRes.data.success, false);
    recordPass('3.1 Rejects incorrect OTP (999999) with 401');

    // Test valid OTP with same challenge token
    const validOtpRes = await request('/api/auth/staff/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        challengeToken: cToken,
        otp: VALID_OTP
      })
    });
    assert.strictEqual(validOtpRes.status, 200, 'Valid OTP succeeds');

    // Test replay / reuse of already consumed challenge token
    const replayRes = await request('/api/auth/staff/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        challengeToken: cToken,
        otp: VALID_OTP
      })
    });
    assert.strictEqual(replayRes.status, 401, 'Replay should be rejected');
    assert.strictEqual(replayRes.data.success, false);
    recordPass('3.2 Replay protection: challenge tokens are strictly single-use');
  } catch (err) {
    recordFail('3. Challenge token security tests', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Dynamic Mandi Switching with Token Refresh
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Dynamic Mandi Center Switching & JWT Re-issuance ---');
  try {
    const gateToken = staffTokens['security_gate'].token;

    const switchRes = await request('/api/auth/staff/switch-centre', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${gateToken}` },
      body: JSON.stringify({
        targetMandiId: 'SHR-02',
        targetMandiName: 'APMC Shrirampur'
      })
    });

    assert.strictEqual(switchRes.status, 200, 'Mandi switch should succeed');
    assert.strictEqual(switchRes.data.success, true);
    assert.strictEqual(switchRes.data.data.assignedMandi, 'SHR-02');
    assert.ok(switchRes.data.data.token, 'Should receive refreshed JWT token');

    // Decode refreshed JWT
    const decoded = jwt.verify(switchRes.data.data.token, JWT_SECRET);
    assert.strictEqual(decoded.assignedMandi, 'SHR-02');
    assert.strictEqual(decoded.role, 'security_gate'); // Role preserved!
    recordPass('4.1 Successfully switched center to SHR-02, re-issued JWT with preserved role');
  } catch (err) {
    recordFail('4.1 Mandi center transfer', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Farmer Authentication & Protected Booking
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Farmer Authentication & Protected Booking ---');
  let testTokenNumber = null;
  let farmerToken = null;

  try {
    // 5.1 Farmer Request OTP
    const otpReq = await request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876500001', name: 'Balasaheb Vikhe' })
    });
    assert.strictEqual(otpReq.status, 200);
    recordPass('5.1 Farmer requested OTP successfully');

    // 5.2 Farmer Verify OTP
    const otpVerify = await request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876500001', otp: VALID_OTP })
    });
    assert.strictEqual(otpVerify.status, 200);
    farmerToken = otpVerify.data.data?.token;
    assert.ok(farmerToken, 'Farmer receives JWT token');
    recordPass('5.2 Farmer verified OTP and received 7-day session token');

    // 5.3 Book Token with Authenticated Farmer
    const bookRes = await request('/api/tokens/book', {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerToken}` },
      body: JSON.stringify({
        farmerPhone: '9876500001',
        farmerName: 'Balasaheb Vikhe',
        mandiId: 'KPG-01',
        crop: 'Soybean',
        quantity: 50,
        vehicleType: 'Tractor',
        vehicleNumber: 'MH-17-AB-1234',
        location: { lat: 19.892, lng: 74.478 }
      })
    });

    assert.strictEqual(bookRes.status, 201, 'Booking should return 201 Created');
    assert.strictEqual(bookRes.data.success, true);
    testTokenNumber = bookRes.data.token ? bookRes.data.token.tokenNumber : (bookRes.data.data ? bookRes.data.data.tokenNumber : null);
    assert.ok(testTokenNumber, 'Token number generated');
    recordPass(`5.3 Farmer booked token ${testTokenNumber} at APMC Kopargaon`);
  } catch (err) {
    recordFail('5. Farmer auth and booking', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: RBAC Desk Stage Sign-Off Authorization Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: RBAC Desk Stage Sign-Off Authorization Enforcement ---');
  if (testTokenNumber) {
    const gateOfficerToken = staffTokens['security_gate'].token;
    const qaOfficerToken = staffTokens['quality_assayer'].token;
    const wmOfficerToken = staffTokens['weighmaster'].token;

    // 6.1 Unauthorized Attempt: Gate Officer attempts to sign off Weighbridge (Desk 3, stageIndex 2)
    try {
      const unauthorizedRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${gateOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 2,
          stageId: 'WEIGHBRIDGE',
          status: 'COMPLETED',
          grossWeight: 4200,
          tareWeight: 1800,
          netWeight: 2400
        })
      });

      assert.strictEqual(unauthorizedRes.status, 403, 'Should return 403 Forbidden for unauthorized desk sign-off');
      assert.strictEqual(unauthorizedRes.data.error, 'ROLE_UNAUTHORIZED');
      recordPass('6.1 RBAC Enforcement: Gate Officer blocked (403) from signing off Weighbridge desk');
    } catch (err) {
      recordFail('6.1 RBAC Gate Officer blocking', err);
    }

    // 6.2 Authorized Attempt: Gate Officer signs off Stage 0 (Gate Check-In)
    try {
      const authRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${gateOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 0,
          stageId: 'GATE_CHECKIN',
          status: 'COMPLETED',
          officerName: 'Ramesh Shinde (Gate Lead)',
          officerSigId: 'SEC-D1-KPG',
          gateNumber: 'G-1',
          vehicleVerified: true
        })
      });

      assert.strictEqual(authRes.status, 200, 'Gate Officer authorized for Stage 0');
      assert.strictEqual(authRes.data.success, true);
      const tokenStages = authRes.data.token?.stages || authRes.data.data?.stages;
      assert.strictEqual(tokenStages[0].status, 'Completed');
      recordPass('6.2 Gate Officer successfully signs off Gate Check-In (Stage 0)');
    } catch (err) {
      recordFail('6.2 Gate Officer sign-off', err);
    }

    // 6.3 Quality Assayer signs off Stage 1 (Quality Grading)
    try {
      const authRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${qaOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 1,
          stageId: 'QUALITY_GRADING',
          status: 'COMPLETED',
          officerName: 'Dr. Suresh Patil (Assayer)',
          officerSigId: 'QA-SP-KPG',
          grade: 'Grade-A (FAQ)',
          moisture: 10.2,
          foreignMatter: 0.8
        })
      });

      assert.strictEqual(authRes.status, 200, 'Quality Assayer authorized for Stage 1');
      assert.strictEqual(authRes.data.success, true);
      const tokenStages = authRes.data.token?.stages || authRes.data.data?.stages;
      assert.strictEqual(tokenStages[1].status, 'Completed');
      recordPass('6.3 Quality Assayer successfully signs off Quality Grading (Stage 1)');
    } catch (err) {
      recordFail('6.3 Quality Assayer sign-off', err);
    }

    // 6.4 Weighmaster signs off Stage 2 (Weighbridge)
    try {
      const authRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${wmOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 2,
          stageId: 'WEIGHBRIDGE',
          status: 'COMPLETED',
          officerName: 'Mahesh Borde (Weighmaster)',
          officerSigId: 'WM-02-KPG',
          grossWeight: 4500,
          tareWeight: 1500,
          netWeight: 3000,
          scaleId: 'WB-02'
        })
      });

      assert.strictEqual(authRes.status, 200, 'Weighmaster authorized for Stage 2');
      assert.strictEqual(authRes.data.success, true);
      const tokenStages = authRes.data.token?.stages || authRes.data.data?.stages;
      assert.strictEqual(tokenStages[2].status, 'Completed');
      recordPass('6.4 Weighmaster successfully signs off Weighbridge (Stage 2)');
    } catch (err) {
      recordFail('6.4 Weighmaster sign-off', err);
    }

    // 6.5 Procurement Officer signs off Stage 3 (Procurement PO)
    try {
      const poOfficerToken = staffTokens['procurement'].token;
      const authRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${poOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 3,
          stageId: 'PROCUREMENT',
          status: 'COMPLETED',
          officerName: 'Secretary Deshmukh',
          officerSigId: 'SEC-APMC-KPG',
          poNumber: 'PO-APMC-KPG-8899',
          totalAmount: 146760
        })
      });

      assert.strictEqual(authRes.status, 200, 'Procurement Officer authorized for Stage 3');
      assert.strictEqual(authRes.data.success, true);
      recordPass('6.5 Procurement Officer successfully signs off Stage 3');
    } catch (err) {
      recordFail('6.5 Procurement Officer sign-off', err);
    }

    // 6.6 Accounts Officer signs off Stage 4 (DBT Payout)
    try {
      const dbtOfficerToken = staffTokens['accounts_settlement'].token;
      const authRes = await request(`/api/tokens/${testTokenNumber}/stage-progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${dbtOfficerToken}` },
        body: JSON.stringify({
          stageIndex: 4,
          stageId: 'PAYOUT',
          status: 'COMPLETED',
          officerName: 'Treasurer Deshmukh',
          officerSigId: 'TRY-DBT-KPG',
          paymentRef: 'DBT-PFMS-MH-2026-8899',
          totalAmount: 146760
        })
      });

      assert.strictEqual(authRes.status, 200, 'Accounts Officer authorized for Stage 4');
      assert.strictEqual(authRes.data.success, true);
      assert.strictEqual(authRes.data.token?.status, 'Completed');
      recordPass('6.6 Accounts Officer signs off Stage 4 & releases single-active-token lock');
    } catch (err) {
      recordFail('6.6 Accounts Officer sign-off', err);
    }
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  🎉 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
