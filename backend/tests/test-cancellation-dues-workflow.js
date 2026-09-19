/**
 * End-to-End Test Suite: Token Cancellation, Dynamic Penalty, Officer Gate Exit & Dues Auto-Deduction
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:5000');
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 KISANQ TOKEN CANCELLATION & DUES E2E TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const testPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
  console.log(`📌 Using Test Farmer Phone: ${testPhone}`);

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // TEST 1: Pre-Gate Free Cancellation (>2h before slot)
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: Pre-Gate Free Cancellation (>2h before slot) ---');
    const futureDate = new Date(Date.now() + 86400000 * 2).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    
    const bookRes1 = await request('POST', '/api/tokens/book', {
      farmerName: 'E2E Farmer One',
      phone: testPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      mandiCode: 'KPG',
      crop: 'Soybean',
      quantity: 20,
      slotDate: futureDate,
      slotTime: '12:00 – 03:00 PM',
      latitude: 19.8928,
      longitude: 74.4820
    });

    assert(bookRes1.status === 201, `Booked slot 1 successfully (Token: ${bookRes1.body.token?.tokenNumber})`);
    const tok1 = bookRes1.body.token?.tokenNumber;

    // Preview penalty
    const prevRes1 = await request('GET', `/api/tokens/${tok1}/cancellation-preview`);
    assert(prevRes1.status === 200, `Preview penalty API returned 200`);
    assert(prevRes1.body.penaltyInfo?.penalty === 0, `Preview calculated ₹0 penalty for future slot (>2h)`);

    // Cancel token
    const cancelRes1 = await request('POST', `/api/tokens/${tok1}/cancel`, {
      reason: 'Harvest delayed by rain'
    });
    assert(cancelRes1.status === 200, `Cancelled token 1 with HTTP 200`);
    assert(cancelRes1.body.penaltyAmount === 0, `Penalty fee applied is ₹0`);
    assert(cancelRes1.body.status === 'Cancelled', `Token status updated to Cancelled`);

    // Verify farmer can immediately book another token (single-active-token freed)
    const bookRes1Rebook = await request('POST', '/api/tokens/book', {
      farmerName: 'E2E Farmer One',
      phone: testPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      mandiCode: 'KPG',
      crop: 'Wheat',
      quantity: 15,
      slotDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      slotTime: '08:00 – 11:00 AM',
      latitude: 19.8928,
      longitude: 74.4820
    });
    assert(bookRes1Rebook.status === 201, `Single-active-token rule unlocked immediately after cancellation!`);
    const tok2 = bookRes1Rebook.body.token?.tokenNumber;

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 2: Pre-Gate Late Cancellation (<30m -> ₹150 penalty)
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Pre-Gate Late Cancellation (<30m -> ₹150 penalty) ---');
    const cancelRes2 = await request('POST', `/api/tokens/${tok2}/cancel`, {
      reason: 'Truck breakdown on highway'
    });
    assert(cancelRes2.status === 200, `Cancelled token 2 with HTTP 200`);
    assert(cancelRes2.body.penaltyAmount === 150, `Penalty fee applied is ₹150 (Late / slot window)`);

    // Check farmer dues profile
    const duesRes2 = await request('GET', `/api/tokens/farmer/${testPhone}/dues`);
    assert(duesRes2.status === 200, `Fetched farmer profile dues`);
    assert(duesRes2.body.farmer?.pendingDues === 150, `Farmer pendingDues balance is now ₹150`);
    assert(duesRes2.body.farmer?.cancellationHistory?.length >= 2, `Cancellation history has 2 records`);

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 3: Post-Gate Exit Request & Desk 1 Approval Flow
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Post-Gate Exit Request & Desk 1 Approval Flow ---');
    // Book token 3
    const bookRes3 = await request('POST', '/api/tokens/book', {
      farmerName: 'E2E Farmer One',
      phone: testPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Cotton',
      quantity: 25,
      slotDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      slotTime: '08:00 – 11:00 AM',
      latitude: 19.8928,
      longitude: 74.4820
    });
    assert(bookRes3.status === 201, `Booked token 3: ${bookRes3.body.token?.tokenNumber}`);
    const tok3 = bookRes3.body.token?.tokenNumber;

    // Progress Stage 1: Security Gate Check-In (Gate-In)
    const stage1Res = await request('PATCH', `/api/tokens/${tok3}/stage-progress`, {
      stageId: 'GATE_CHECKIN',
      stageIndex: 0,
      officerName: 'Ramesh Shinde',
      officerSigId: 'SEC-D1-KPG-001',
      status: 'Completed'
    });
    assert(stage1Res.status === 200, `Stage 1 Gate Check-In completed (Status: ${stage1Res.body.token?.status})`);

    // Direct pre-gate cancellation must be BLOCKED with 400
    const directCancelRes = await request('POST', `/api/tokens/${tok3}/cancel`, {
      reason: 'Trying to cancel directly after gate-in'
    });
    assert(directCancelRes.status === 400, `Direct cancellation blocked after Gate-In (HTTP 400 GATE_IN_LOCKED)`);

    // Farmer submits Gate Exit Request
    const exitReqRes = await request('POST', `/api/tokens/${tok3}/request-exit`, {
      reason: 'Produce rejected by buyer / Price dispute'
    });
    assert(exitReqRes.status === 200, `Submitted Gate Exit Request (Status: ${exitReqRes.body.status})`);

    // Desk 1 Gate Officer Approves Exit & Opens Boom Barrier
    const approveExitRes = await request('POST', `/api/tokens/${tok3}/approve-exit`, {
      officerName: 'Ramesh Shinde, Security Head',
      officerSigId: 'SEC-D1-KPG-EXIT',
      penaltyAmount: 150,
      reason: 'Authorized gate exit and produce rejection clearance'
    });
    assert(approveExitRes.status === 200, `Desk 1 Officer authorized gate exit & opened boom barrier`);

    // Check farmer dues balance (₹150 + ₹150 = ₹300)
    const duesRes3 = await request('GET', `/api/tokens/farmer/${testPhone}/dues`);
    assert(duesRes3.body.farmer?.pendingDues === 300, `Farmer pendingDues balance accumulated to ₹300`);

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 4: Desk 5 Settlement Auto-Deduction & Dues Reconciliation
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Desk 5 Settlement Auto-Deduction & Dues Reconciliation ---');
    // Book token 4 (Farmer sells produce)
    const bookRes4 = await request('POST', '/api/tokens/book', {
      farmerName: 'E2E Farmer One',
      phone: testPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Wheat',
      quantity: 24,
      slotDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      slotTime: '08:00 – 11:00 AM',
      latitude: 19.8928,
      longitude: 74.4820
    });
    assert(bookRes4.status === 201, `Booked token 4: ${bookRes4.body.token?.tokenNumber}`);
    const tok4 = bookRes4.body.token?.tokenNumber;

    // Progress Stage 1: Gate Check-In
    await request('PATCH', `/api/tokens/${tok4}/stage-progress`, {
      stageId: 'GATE_CHECKIN',
      stageIndex: 0,
      officerName: 'Ramesh Shinde',
      status: 'Completed'
    });

    // Progress Stage 2: Quality Lab (Grade A)
    await request('PATCH', `/api/tokens/${tok4}/stage-progress`, {
      stageId: 'QUALITY_GRADING',
      stageIndex: 1,
      officerName: 'S. Patil',
      grade: 'Grade A',
      status: 'Completed'
    });

    // Progress Stage 3: Weighbridge (24 Quintals)
    await request('PATCH', `/api/tokens/${tok4}/stage-progress`, {
      stageId: 'WEIGHBRIDGE',
      stageIndex: 2,
      officerName: 'Suresh Jadhav',
      weight: 24,
      status: 'Completed'
    });

    // Progress Stage 4: Procurement PO (24 Qtl * ₹2430 = ₹58,320)
    await request('PATCH', `/api/tokens/${tok4}/stage-progress`, {
      stageId: 'PROCUREMENT',
      stageIndex: 3,
      officerName: 'Secretary Deshmukh',
      totalAmount: 58320,
      status: 'Completed'
    });

    // Execute Desk 5 Settlement (PAYOUT): Should auto-deduct ₹300 pending dues!
    const payoutRes = await request('PATCH', `/api/tokens/${tok4}/stage-progress`, {
      stageId: 'PAYOUT',
      stageIndex: 4,
      officerName: 'Treasurer Deshmukh',
      totalAmount: 58320,
      status: 'Completed'
    });

    assert(payoutRes.status === 200, `Desk 5 Settlement executed successfully`);
    const finalToken = payoutRes.body.token;
    assert(finalToken.status === 'Completed', `Token 4 marked Completed in MongoDB Atlas`);
    
    const payoutStage = finalToken.stages?.find((s) => s.id === 'PAYOUT') || finalToken.stages?.[4];
    assert(payoutStage.details?.duesDeducted === 300, `Stage 5 audit details record duesDeducted = ₹300`);
    assert(payoutStage.details?.netPaid === 58020, `Stage 5 audit details record netPaid = ₹58,020 (₹58,320 - ₹300)`);

    // Verify farmer dues are now ₹0 and history records are marked DEDUCTED
    const finalDuesRes = await request('GET', `/api/tokens/farmer/${testPhone}/dues`);
    assert(finalDuesRes.body.farmer?.pendingDues === 0, `Farmer pendingDues balance successfully reset to ₹0!`);
    const history = finalDuesRes.body.farmer?.cancellationHistory || [];
    const nonZeroItems = history.filter((h) => h.penaltyAmount > 0);
    const allDeducted = nonZeroItems.every((h) => h.status === 'DEDUCTED');
    assert(allDeducted, `All historical penalty records updated to 'DEDUCTED' status`);

    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unhandled Test Error:', err);
    process.exit(1);
  }
}

runTests();
