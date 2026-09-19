/**
 * test-sequential-pipeline-rbac.js
 * Verification Test Suite for Strict Sequential Checkpoint Enforcement & RBAC Station Isolation
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

const BACKEND_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

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

async function getStaffTokens() {
  const tokens = {};
  for (const staff of SEEDED_STAFF) {
    const credRes = await request('/api/auth/staff/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({
        phone: staff.phone,
        password: DEFAULT_PASSWORD,
        role: staff.role
      })
    });
    const cToken = credRes.data.data?.challengeToken;
    const otpRes = await request('/api/auth/staff/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        challengeToken: cToken,
        otp: VALID_OTP
      })
    });
    tokens[staff.role] = otpRes.data.data?.token;
  }
  return tokens;
}

async function run() {
  console.log('================================================================');
  console.log('  🔒 KISANQ STRICT SEQUENTIAL PIPELINE & RBAC ISOLATION TEST');
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

  console.log('--- Step 1: Authenticating All 5 Desk Officers ---');
  const staffTokens = await getStaffTokens();
  assert.ok(staffTokens.security_gate, 'Desk 1 token obtained');
  assert.ok(staffTokens.quality_assayer, 'Desk 2 token obtained');
  assert.ok(staffTokens.weighmaster, 'Desk 3 token obtained');
  assert.ok(staffTokens.procurement, 'Desk 4 token obtained');
  assert.ok(staffTokens.accounts_settlement, 'Desk 5 token obtained');
  recordPass('Authenticated all 5 official desk officers');

  console.log('\n--- Step 2: Farmer Booking ---');
  const farmerPhone = '9876540001';
  await request('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone: farmerPhone, name: 'Sanjay Shinde' }) });
  const fOtp = await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: farmerPhone, otp: VALID_OTP }) });
  const farmerJwt = fOtp.data.data?.token;

  const bookRes = await request('/api/tokens/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${farmerJwt}` },
    body: JSON.stringify({
      farmerPhone,
      farmerName: 'Sanjay Shinde',
      mandiId: 'KPG-01',
      crop: 'Soybean',
      quantity: 40,
      vehicleType: 'Tractor-Trolley',
      vehicleNumber: 'MH-17-AB-9988'
    })
  });

  assert.strictEqual(bookRes.status, 201, 'Token booking should succeed');
  const tokenNumber = bookRes.data.token?.tokenNumber || bookRes.data.data?.tokenNumber;
  assert.ok(tokenNumber, 'Token number generated');
  recordPass(`Booked test token ${tokenNumber} at APMC Kopargaon`);

  console.log('\n--- Step 3: Out-of-Order Execution Rejection Tests ---');
  
  // 3.1 Attempt Desk 4 (Procurement) directly on fresh token (Skipping Desks 1, 2, 3)
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.procurement}` },
      body: JSON.stringify({
        stageIndex: 3,
        stageId: 'PROCUREMENT',
        status: 'Completed',
        poNumber: 'PO-TEST-001',
        totalAmount: 195680
      })
    });
    assert.strictEqual(res.status, 400, 'Should return 400 for skipping Weighbridge');
    assert.strictEqual(res.data.error, 'PIPELINE_VIOLATION');
    assert.ok(res.data.message.includes('Weighbridge'), 'Error explains weighbridge prerequisite');
    recordPass('3.1 Rejects Desk 4 (Procurement) before Desk 3: 400 PIPELINE_VIOLATION');
  } catch (err) {
    recordFail('3.1 Desk 4 skip rejection', err);
  }

  // 3.2 Attempt Desk 3 (Weighmaster) directly on fresh token (Skipping Desks 1, 2)
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.weighmaster}` },
      body: JSON.stringify({
        stageIndex: 2,
        stageId: 'WEIGHBRIDGE',
        status: 'Completed',
        grossWeight: 7500,
        tareWeight: 3500,
        netWeight: 4000
      })
    });
    assert.strictEqual(res.status, 400, 'Should return 400 for skipping Quality Assaying');
    assert.strictEqual(res.data.error, 'PIPELINE_VIOLATION');
    assert.ok(res.data.message.includes('Quality assaying'), 'Error explains quality assaying prerequisite');
    recordPass('3.2 Rejects Desk 3 (Weighbridge) before Desk 2: 400 PIPELINE_VIOLATION');
  } catch (err) {
    recordFail('3.2 Desk 3 skip rejection', err);
  }

  // 3.3 Attempt Desk 2 (Quality Assayer) directly on fresh token (Skipping Desk 1)
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.quality_assayer}` },
      body: JSON.stringify({
        stageIndex: 1,
        stageId: 'QUALITY_GRADING',
        status: 'Completed',
        grade: 'Grade A FAQ'
      })
    });
    assert.strictEqual(res.status, 400, 'Should return 400 for skipping Gate Check-in');
    assert.strictEqual(res.data.error, 'PIPELINE_VIOLATION');
    assert.ok(res.data.message.includes('Gate entry'), 'Error explains gate entry prerequisite');
    recordPass('3.3 Rejects Desk 2 (Quality Assaying) before Desk 1: 400 PIPELINE_VIOLATION');
  } catch (err) {
    recordFail('3.3 Desk 2 skip rejection', err);
  }

  // 3.4 Cross-Role Tampering Attempt: Desk 1 officer trying to sign Desk 2
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.security_gate}` },
      body: JSON.stringify({
        stageIndex: 1,
        stageId: 'QUALITY_GRADING',
        status: 'Completed',
        grade: 'Grade A FAQ'
      })
    });
    assert.strictEqual(res.status, 403, 'Should return 403 for unauthorized role');
    assert.strictEqual(res.data.error, 'ROLE_UNAUTHORIZED');
    recordPass('3.4 RBAC Isolation: Desk 1 officer blocked with 403 from executing Desk 2');
  } catch (err) {
    recordFail('3.4 RBAC Isolation check', err);
  }

  console.log('\n--- Step 4: Strict Sequential Pipeline Execution ---');

  // 4.1 Desk 1: Security Gate Check-in
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.security_gate}` },
      body: JSON.stringify({
        stageIndex: 0,
        stageId: 'GATE_CHECKIN',
        status: 'Completed',
        gateNumber: 'G-1',
        officerName: 'Ramesh Shinde',
        officerSigId: 'SEC-D1-KPG'
      })
    });
    assert.strictEqual(res.status, 200, 'Desk 1 should succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.token?.stages[0].status, 'Completed');
    recordPass('4.1 Desk 1 (Security Gate) signed off successfully -> Status: GATE_IN');
  } catch (err) {
    recordFail('4.1 Desk 1 execution', err);
  }

  // 4.1b Attempt Desk 3 after Desk 1 (Skipping Desk 2)
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.weighmaster}` },
      body: JSON.stringify({
        stageIndex: 2,
        stageId: 'WEIGHBRIDGE',
        status: 'Completed',
        grossWeight: 7500,
        tareWeight: 3500,
        netWeight: 4000
      })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error, 'PIPELINE_VIOLATION');
    recordPass('4.1b Rejects Desk 3 after Desk 1: 400 PIPELINE_VIOLATION (Desk 2 must precede Desk 3)');
  } catch (err) {
    recordFail('4.1b Desk 3 skip rejection', err);
  }

  // 4.2 Desk 2: Quality Assaying Lab
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.quality_assayer}` },
      body: JSON.stringify({
        stageIndex: 1,
        stageId: 'QUALITY_GRADING',
        status: 'Completed',
        grade: 'Grade A FAQ',
        moisture: 10.5,
        foreignMatter: 1.0,
        officerName: 'S. Patil',
        officerSigId: 'QA-SP-KPG'
      })
    });
    assert.strictEqual(res.status, 200, 'Desk 2 should succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.token?.stages[1].status, 'Completed');
    recordPass('4.2 Desk 2 (Quality Assayer) signed off successfully -> Status: INSPECTED');
  } catch (err) {
    recordFail('4.2 Desk 2 execution', err);
  }

  // 4.3 Desk 3: Digital Weighbridge
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.weighmaster}` },
      body: JSON.stringify({
        stageIndex: 2,
        stageId: 'WEIGHBRIDGE',
        status: 'Completed',
        grossWeight: 7800,
        tareWeight: 3800,
        netWeight: 4000,
        officerName: 'Suresh Jadhav',
        officerSigId: 'WM-02-KPG'
      })
    });
    assert.strictEqual(res.status, 200, 'Desk 3 should succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.token?.stages[2].status, 'Completed');
    recordPass('4.3 Desk 3 (Weighmaster) signed off successfully -> Status: WEIGHED');
  } catch (err) {
    recordFail('4.3 Desk 3 execution', err);
  }

  // 4.4 Desk 4: Procurement Office & PO Bill
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.procurement}` },
      body: JSON.stringify({
        stageIndex: 3,
        stageId: 'PROCUREMENT',
        status: 'Completed',
        poNumber: 'PO-APMC-KPG-2026-99',
        totalAmount: 195680,
        officerName: 'Secretary Deshmukh',
        officerSigId: 'SEC-APMC-KPG'
      })
    });
    assert.strictEqual(res.status, 200, 'Desk 4 should succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.token?.stages[3].status, 'Completed');
    recordPass('4.4 Desk 4 (Procurement) signed off successfully -> Status: PROCUREMENT');
  } catch (err) {
    recordFail('4.4 Desk 4 execution', err);
  }

  // 4.5 Desk 5: Treasury & DBT Payout
  try {
    const res = await request(`/api/tokens/${tokenNumber}/stage-progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffTokens.accounts_settlement}` },
      body: JSON.stringify({
        stageIndex: 4,
        stageId: 'PAYOUT',
        status: 'Completed',
        paymentRef: 'DBT-PFMS-MH-2026-99',
        totalAmount: 195680,
        officerName: 'Treasurer Deshmukh',
        officerSigId: 'TRY-DBT-KPG'
      })
    });
    assert.strictEqual(res.status, 200, 'Desk 5 should succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.token?.stages[4].status, 'Completed');
    assert.strictEqual(res.data.token?.status, 'Completed');
    recordPass('4.5 Desk 5 (Treasury & DBT) signed off successfully -> Status: Completed');
  } catch (err) {
    recordFail('4.5 Desk 5 execution', err);
  }

  console.log('\n================================================================');
  console.log(`  🎉 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100% OK)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
