const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

// Supervisor JWT for staff actions
const supervisorJwt = jwt.sign(
  {
    id: '64b8f0a1c1d2e3f4a5b6c7d7',
    phone: '9800000099',
    name: 'District Supervisor',
    role: 'supervisor',
    officerCode: 'SEC-SUPERVISOR-HQ',
    assignedMandi: 'LSG-06'
  },
  JWT_SECRET,
  { expiresIn: '8h' }
);

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

// Helper: Authenticate farmer, set pickup location, and book a token
async function authenticateFarmerAndBookToken({ phone, name, mandiId, crop, quantity = 25, lat = 19.837, lng = 74.482 }) {
  // 1. Request OTP
  await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/farmer/request-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone, name, mode: 'register' });

  // 2. Verify OTP (default 123456)
  const otpRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/farmer/verify-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone, otp: '123456', name, mode: 'register' });

  const jwtToken = otpRes.data?.data?.token || otpRes.data?.token;

  // 3. Set Pickup Location (Mandatory prerequisite for booking)
  await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/farmers/pickup-location',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    }
  }, {
    latitude: lat,
    longitude: lng,
    address: `${name} Farm`
  });

  // 4. Book Token
  const bookRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tokens/book',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    }
  }, {
    farmerName: name,
    farmerPhone: phone,
    mandiId,
    crop,
    quantity,
    vehicleNumber: 'MH-17-AB-1234'
  });

  const bookedToken = bookRes.data?.token || bookRes.data?.data;
  return { jwtToken, bookedToken, bookRes };
}

// Helper: Clean any leftover pending fast-track requests for a clean capacity test
async function cleanPendingRequests(mandiId, authJwt) {
  const pendingRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests?mandiId=${mandiId}&status=PENDING`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authJwt}` }
  });
  const pendingList = pendingRes.data?.data || [];
  for (const reqItem of pendingList) {
    const id = reqItem._id || reqItem.id;
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/staff/fasttrack-requests/${id}/reject`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authJwt}`
      }
    }, {
      reason: 'Automated test suite reset'
    });
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 KISANQ FAST-TRACK PRIORITY FINAL CONSOLIDATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, evidence = null) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      if (evidence !== null) {
        console.log(`     ↳ Observed: ${typeof evidence === 'object' ? JSON.stringify(evidence) : evidence}`);
      }
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      if (evidence !== null) {
        console.error(`     ↳ Observed: ${typeof evidence === 'object' ? JSON.stringify(evidence) : evidence}`);
      }
      failed++;
    }
  }

  // Pre-flight: Health check
  try {
    const health = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    assert(health.status === 200, 'Backend is healthy and running on port 5000', `HTTP ${health.status}`);
  } catch (err) {
    console.error('Backend connection failed:', err.message);
    process.exit(1);
  }

  const runId = Date.now().toString().slice(-4);

  // ==========================================================================
  // PREREQUISITE: Statutory Floor Protection (MSP Floor Hard Constraint)
  // ==========================================================================
  console.log('\n--- PREREQUISITE: Statutory Floor Price Protection (MSP Floor Rule) ---');
  const pfPhone1 = `9821${runId}01`;
  const { jwtToken: pfJwt1, bookedToken: pfToken1 } = await authenticateFarmerAndBookToken({
    phone: pfPhone1,
    name: 'MSP Floor Farmer 1',
    mandiId: 'KPG-01',
    crop: 'Soybean'
  });
  const pfTokenNum1 = pfToken1?.tokenNumber;

  // Soybean at KPG-01 (Market ₹4,950, MSP ₹4,892 -> 2% discount yields ₹4,851 < MSP ₹4,892)
  const floorRejRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${pfTokenNum1}/fasttrack-request`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pfJwt1}`
    }
  }, {
    tier: 2,
    farmerPhone: pfPhone1
  });

  assert(
    floorRejRes.status === 400 && floorRejRes.data?.code === 'FLOOR_PRICE_VIOLATION',
    `Blocked Soybean 2% discount because discounted price (₹4,851) < statutory MSP floor (₹4,892)`,
    { status: floorRejRes.status, code: floorRejRes.data?.code, message: floorRejRes.data?.message }
  );

  // ==========================================================================
  // CASE 1: Token with Desk 1 (stages[0]) marked complete attempts fast-track
  // ==========================================================================
  console.log('\n--- CASE 1: Post-Desk-1 Rejection (Already Checked In) ---');
  const c1Phone = `9822${runId}01`;
  const { jwtToken: c1Jwt, bookedToken: c1Token } = await authenticateFarmerAndBookToken({
    phone: c1Phone,
    name: 'Desk1 Checked Farmer',
    mandiId: 'LSG-06',
    crop: 'Onion'
  });

  const c1TokenNumber = c1Token?.tokenNumber;
  console.log(`  Created token: ${c1TokenNumber}`);

  // Mark Desk 1 (Gate Check-in) as Completed
  const stageRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${c1TokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supervisorJwt}`
    }
  }, {
    stageIndex: 0,
    stageId: 'GATE_CHECKIN',
    status: 'Completed',
    officerName: 'Gate Officer S. Patil',
    officerSigId: 'SEC-D1-LSG'
  });

  assert(
    stageRes.status === 200,
    `Successfully signed off Desk 1 (stages[0]) for token ${c1TokenNumber}`,
    `HTTP ${stageRes.status}`
  );

  // Attempt fast-track request after Desk 1 completion
  const c1FtRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${c1TokenNumber}/fasttrack-request`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c1Jwt}`
    }
  }, {
    tier: 2,
    farmerPhone: c1Phone
  });

  const c1ErrorMsg = c1FtRes.data?.message || '';
  const c1IsRejected = c1FtRes.status === 400 && (
    c1ErrorMsg.toLowerCase().includes('already checked in') ||
    c1ErrorMsg.toLowerCase().includes('operational desks') ||
    c1ErrorMsg.toLowerCase().includes('prior to physical gate check-in')
  );

  assert(
    c1IsRejected,
    'Fast-track request for post-Desk-1 token rejected as already checked in (HTTP 400)',
    { status: c1FtRes.status, message: c1ErrorMsg }
  );

  // ==========================================================================
  // CASE 2: 6 Simultaneous Concurrent Requests at Mandi with 5 Slots Max
  // ==========================================================================
  console.log('\n--- CASE 2: Concurrent Requests & Atomic Pool Capacity Cap (5 Max) ---');
  const targetMandi = `VJP-04`; // Crop Cotton (Market ₹7280, MSP ₹7122 -> Tier 2 is ₹7134 >= MSP)

  // Ensure clean 0 pending requests in targetMandi so exactly 5 slots are free
  await cleanPendingRequests(targetMandi, supervisorJwt);

  const c2Tokens = [];

  for (let i = 1; i <= 6; i++) {
    const phone = `9823${runId}0${i}`;
    const { jwtToken, bookedToken } = await authenticateFarmerAndBookToken({
      phone,
      name: `Concurrent Farmer ${i}`,
      mandiId: targetMandi,
      crop: 'Cotton'
    });
    c2Tokens.push({ index: i, phone, jwtToken, tokenNumber: bookedToken?.tokenNumber });
  }

  console.log(`  Booked 6 tokens in ${targetMandi}: ${c2Tokens.map(t => t.tokenNumber).join(', ')}`);

  // Fire 6 simultaneous fast-track requests concurrently
  const concurrentPromises = c2Tokens.map((t) =>
    request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tokens/${t.tokenNumber}/fasttrack-request`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t.jwtToken}`
      }
    }, {
      tier: 2,
      farmerPhone: t.phone
    }).then(res => ({ tokenNumber: t.tokenNumber, ...res }))
  );

  const concurrentResults = await Promise.all(concurrentPromises);

  const successfulRequests = concurrentResults.filter(r => r.status === 201 && r.data?.success === true);
  const rejectedRequests = concurrentResults.filter(r => r.status === 429 && r.data?.code === 'CAPACITY_LIMIT_EXCEEDED');
  const assignedSlots = successfulRequests.map(r => r.data?.data?.slotNumber).sort((a, b) => a - b);
  const uniqueSlots = new Set(assignedSlots);

  assert(
    successfulRequests.length === 5,
    `Exactly 5 out of 6 concurrent requests succeeded (HTTP 201)`,
    `Count: ${successfulRequests.length} succeeded`
  );
  assert(
    rejectedRequests.length === 1,
    `The 6th request was rejected with HTTP 429 CAPACITY_LIMIT_EXCEEDED`,
    {
      status: rejectedRequests[0]?.status,
      code: rejectedRequests[0]?.data?.code,
      message: rejectedRequests[0]?.data?.message
    }
  );
  assert(
    assignedSlots.length === 5 && uniqueSlots.size === 5 && assignedSlots.every((s, idx) => s === idx + 1),
    `The 5 successful requests received distinct slot numbers 1-5 with zero duplicate collisions`,
    `Assigned slots: [${assignedSlots.join(', ')}]`
  );

  // ==========================================================================
  // CASE 3: Approve Two Pending Requests Back-to-Back & Verify Queue Sequence
  // ==========================================================================
  console.log('\n--- CASE 3: Back-to-Back Approvals & Queue Repositioning Sequence ---');
  const req1 = successfulRequests[0]?.data?.data;
  const req2 = successfulRequests[1]?.data?.data;
  const req1Id = req1?._id || req1?.id;
  const req2Id = req2?._id || req2?.id;

  // 1st Approval
  const app1Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req1Id}/approve`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supervisorJwt}`
    }
  });

  assert(
    app1Res.status === 200 && app1Res.data?.success === true,
    `1st Fast-track request approved for token ${req1.tokenNumber}`,
    `HTTP ${app1Res.status}`
  );

  // Check queue positions after 1st approval
  const qState1Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/mandi/${targetMandi}`,
    method: 'GET'
  });

  const tokensAfterApp1 = qState1Res.data?.tokens || [];
  const qPositions1 = tokensAfterApp1.map(t => t.queuePosition);
  const isCleanSeq1 = qPositions1.every((pos, idx) => pos === idx + 1);

  assert(
    isCleanSeq1 && qPositions1.length > 0,
    `Queue positions after 1st approval form a clean 1..N sequence without duplicates or gaps`,
    `Positions: [${qPositions1.join(', ')}]`
  );

  // 2nd Approval
  const app2Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req2Id}/approve`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supervisorJwt}`
    }
  });

  assert(
    app2Res.status === 200 && app2Res.data?.success === true,
    `2nd Fast-track request approved for token ${req2.tokenNumber}`,
    `HTTP ${app2Res.status}`
  );

  // Check queue positions after 2nd approval
  const qState2Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/mandi/${targetMandi}`,
    method: 'GET'
  });

  const tokensAfterApp2 = qState2Res.data?.tokens || [];
  const qPositions2 = tokensAfterApp2.map(t => t.queuePosition);
  const isCleanSeq2 = qPositions2.every((pos, idx) => pos === idx + 1);

  assert(
    isCleanSeq2 && qPositions2.length > 0,
    `Queue positions after 2nd approval form a clean 1..N sequence without duplicates or gaps`,
    `Positions: [${qPositions2.join(', ')}]`
  );

  // ==========================================================================
  // CASE 4: Auth Guard Verification (No Auth & Non-Supervisor Role)
  // ==========================================================================
  console.log('\n--- CASE 4: Auth Enforcement (401 No Auth & 403 Non-Supervisor) ---');
  const pendingReq3 = successfulRequests[2]?.data?.data;
  const req3Id = pendingReq3?._id || pendingReq3?.id;
  const token3Num = pendingReq3?.tokenNumber;

  // Get token state before unauthorized attempts
  const tokBeforeRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${token3Num}`,
    method: 'GET'
  });
  const posBefore = tokBeforeRes.data?.token?.queuePosition;
  const isFtBefore = tokBeforeRes.data?.token?.isFastTrack;

  // 4a: Approve with NO auth token
  const noAuthApp = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req3Id}/approve`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  assert(
    noAuthApp.status === 401,
    `Approve attempt without auth token rejected with HTTP 401`,
    `HTTP ${noAuthApp.status} (${noAuthApp.data?.message || noAuthApp.data?.error})`
  );

  // 4b: Reject with NO auth token
  const noAuthRej = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req3Id}/reject`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  assert(
    noAuthRej.status === 401,
    `Reject attempt without auth token rejected with HTTP 401`,
    `HTTP ${noAuthRej.status} (${noAuthRej.data?.message || noAuthRej.data?.error})`
  );

  // 4c: Approve with Farmer JWT (non-supervisor role)
  const farmerJwtToken = c2Tokens[0].jwtToken;
  const farmerApp = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req3Id}/approve`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwtToken}`
    }
  });
  assert(
    farmerApp.status === 403,
    `Approve attempt with plain farmer role rejected with HTTP 403`,
    `HTTP ${farmerApp.status} (${farmerApp.data?.message || farmerApp.data?.error})`
  );

  // 4d: Reject with Farmer JWT (non-supervisor role)
  const farmerRej = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req3Id}/reject`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwtToken}`
    }
  });
  assert(
    farmerRej.status === 403,
    `Reject attempt with plain farmer role rejected with HTTP 403`,
    `HTTP ${farmerRej.status} (${farmerRej.data?.message || farmerRej.data?.error})`
  );

  // 4e: Verify request status and token queue position remain untouched
  const req3StatusRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${token3Num}/fasttrack-status`,
    method: 'GET'
  });
  const tokAfterRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${token3Num}`,
    method: 'GET'
  });

  const reqStatusAfter = req3StatusRes.data?.data?.activeRequest?.status;
  const posAfter = tokAfterRes.data?.token?.queuePosition;
  const isFtAfter = tokAfterRes.data?.token?.isFastTrack;

  assert(
    reqStatusAfter === 'PENDING' && posAfter === posBefore && isFtAfter === isFtBefore,
    `Request status remains 'PENDING' and token queue position & isFastTrack flag were strictly unchanged`,
    { status: reqStatusAfter, queuePosition: posAfter, isFastTrack: isFtAfter }
  );

  // Reject req3 with supervisor token for Case 5 audit trail
  const supervisorRej = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${req3Id}/reject`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supervisorJwt}`
    }
  }, {
    reason: 'Daily fairness quota threshold reached'
  });

  assert(
    supervisorRej.status === 200,
    `Supervisor properly rejected request #${req3Id} with reason`,
    `HTTP ${supervisorRej.status}`
  );

  // ==========================================================================
  // CASE 5: AuditLog Verification for Approved and Rejected Requests
  // ==========================================================================
  console.log('\n--- CASE 5: AuditLog Verification for APPROVED and REJECTED Events ---');

  // Verify AuditLog for Approved Token 1
  const audit1Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/audit/logs?targetId=${req1.tokenNumber}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${supervisorJwt}` }
  });
  const log1 = (audit1Res.data?.data || audit1Res.data || []).find(l => l.action === 'FAST_TRACK_APPROVED');

  assert(
    Boolean(log1 && log1.actorId && log1.action === 'FAST_TRACK_APPROVED' && log1.reason),
    `AuditLog exists for APPROVED request (${req1.tokenNumber}) with actorId, action, and reason populated`,
    {
      actorId: log1?.actorId,
      action: log1?.action,
      targetId: log1?.targetId,
      reason: log1?.reason
    }
  );

  // Verify AuditLog for Approved Token 2
  const audit2Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/audit/logs?targetId=${req2.tokenNumber}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${supervisorJwt}` }
  });
  const log2 = (audit2Res.data?.data || audit2Res.data || []).find(l => l.action === 'FAST_TRACK_APPROVED');

  assert(
    Boolean(log2 && log2.actorId && log2.action === 'FAST_TRACK_APPROVED' && log2.reason),
    `AuditLog exists for APPROVED request (${req2.tokenNumber}) with actorId, action, and reason populated`,
    {
      actorId: log2?.actorId,
      action: log2?.action,
      targetId: log2?.targetId,
      reason: log2?.reason
    }
  );

  // Verify AuditLog for Rejected Token 3
  const audit3Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/audit/logs?targetId=${token3Num}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${supervisorJwt}` }
  });
  const log3 = (audit3Res.data?.data || audit3Res.data || []).find(l => l.action === 'FAST_TRACK_REJECTED');

  assert(
    Boolean(log3 && log3.actorId && log3.action === 'FAST_TRACK_REJECTED' && log3.reason),
    `AuditLog exists for REJECTED request (${token3Num}) with actorId, action, and reason populated`,
    {
      actorId: log3?.actorId,
      action: log3?.action,
      targetId: log3?.targetId,
      reason: log3?.reason
    }
  );

  console.log('\n================================================================');
  console.log(`🏁 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
