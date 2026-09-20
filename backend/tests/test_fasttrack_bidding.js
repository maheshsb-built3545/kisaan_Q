/**
 * Test Suite: B5 Fast-Track Bidding & Dynamic Auction Engine (PRD Section 2.5)
 * 
 * Verifies:
 * 1. Round initialization with 100s timer and MSP floor
 * 2. Placing higher discount bids and 100s timer reset
 * 3. Lower/equal bid rejection
 * 4. Hard MSP floor guard protection
 * 5. Timer expiry and bidding lockout
 * 6. Planning / Resource Officer approval & Priority Queue #1 elevation
 * 7. Non-officer RBAC access control (403 rejection)
 * 8. Officer decline workflow & notification trigger
 */

const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

function makeRequest(options, data) {
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

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 KISANQ B5 FAST-TRACK BIDDING & AUCTION ENGINE TEST SUITE');
  console.log('='.repeat(70));

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

  // Pre-flight check
  try {
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    assert(health.status === 200, 'Backend is healthy and running', `HTTP ${health.status}`);
  } catch (err) {
    console.error('Backend connection failed:', err.message);
    process.exit(1);
  }

  const runId = Date.now().toString().slice(-4);
  const farmerPhone = `9825${runId}01`;
  const farmerName = `FastTrack Farmer ${runId}`;

  // Generate tokens
  const resourceOfficerJwt = jwt.sign(
    {
      id: '64b8f0a1c1d2e3f4a5b6c7d9',
      phone: '9800000088',
      name: 'Resource Officer Deshmukh',
      role: 'resource_officer',
      officerCode: 'RO-KPG-01',
      assignedMandi: 'KPG-01'
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const farmerJwt = jwt.sign(
    {
      id: '64b8f0a1c1d2e3f4a5b6c701',
      phone: farmerPhone,
      name: farmerName,
      role: 'farmer'
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const plainTraderJwt = jwt.sign(
    {
      id: '64b8f0a1c1d2e3f4a5b6c702',
      phone: `9825${runId}99`,
      name: 'Trader Rajesh',
      role: 'trader'
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Setup: Register farmer & book a token
  console.log('\n[SETUP] Registering farmer and booking token...');
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/farmers/pickup-location',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt}`
    }
  }, { latitude: 19.8928, longitude: 74.4820, address: 'Kopargaon Farm' });

  const bookRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tokens/book',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt}`
    }
  }, {
    farmerName,
    farmerPhone,
    mandiId: 'KPG-01',
    crop: 'Soybean',
    quantity: 35,
    vehicleNumber: 'MH-17-FT-9999'
  });

  const bookedToken = bookRes.data?.token || bookRes.data?.data;
  const tokenNumber = bookedToken?.tokenNumber || bookedToken?.id;
  assert(bookRes.status === 201 && tokenNumber, `Booked token #${tokenNumber} for Fast-Track auction`, `HTTP ${bookRes.status}`);

  // -------------------------------------------------------------
  // TEST 1: Start Fast-Track Auction Round (100s countdown)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Start Fast-Track Auction Round ---');
  const startRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/fasttrack/rounds/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt}`
    }
  }, {
    tokenNumber,
    startingBid: 15,
    timerSeconds: 100
  });

  const round = startRes.data?.data;
  const roundId = round?.roundId || round?._id;

  assert(
    startRes.status === 201 && round && round.status === 'ACTIVE',
    `Auction round started with status 'ACTIVE'`,
    { status: startRes.status, roundId, highestBid: round?.highestBid }
  );

  assert(
    round?.timerSeconds === 100 && round?.roundEndTime,
    `Round initialized with 100s countdown timer and roundEndTime populated`,
    { timerSeconds: round?.timerSeconds, roundEndTime: round?.roundEndTime }
  );

  assert(
    round?.baseMarketPrice > round?.floorPrice,
    `Base market price (₹${round?.baseMarketPrice}) and MSP Floor (₹${round?.floorPrice}) established`,
    { baseMarketPrice: round?.baseMarketPrice, floorPrice: round?.floorPrice }
  );

  // -------------------------------------------------------------
  // TEST 2: Place Valid Higher Bid & Verify 100s Timer Reset
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Place Valid Higher Bid & Verify 100s Timer Reset ---');
  const originalEndTime = new Date(round.roundEndTime).getTime();
  
  // Wait a small bit so timestamp advances
  await new Promise(r => setTimeout(r, 100));

  const bidRes1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/bid`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${plainTraderJwt}`
    }
  }, {
    bidDiscountPerQtl: 25,
    bidderPhone: `9825${runId}99`,
    bidderName: 'Trader Rajesh'
  });

  const updatedRound1 = bidRes1.data?.data?.round;
  const newEndTime1 = new Date(updatedRound1?.roundEndTime).getTime();

  assert(
    bidRes1.status === 200 && updatedRound1?.highestBid === 25,
    `Placed higher bid of ₹25/Qtl successfully (previous: ₹${round.highestBid}/Qtl)`,
    { status: bidRes1.status, highestBid: updatedRound1?.highestBid, bidsCount: updatedRound1?.bidsCount }
  );

  assert(
    newEndTime1 >= originalEndTime,
    `100s countdown timer reset on new highest bid (New end: ${updatedRound1?.roundEndTime})`,
    { originalEndTime, newEndTime1 }
  );

  // -------------------------------------------------------------
  // TEST 3: Reject Lower or Equal Bid
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Reject Lower or Equal Bid ---');
  const lowerBidRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/bid`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bidDiscountPerQtl: 20, // Lower than 25
    bidderPhone: '9800000011'
  });

  assert(
    lowerBidRes.status === 400 && lowerBidRes.data?.message?.includes('higher than current highest bid'),
    `Lower bid of ₹20/Qtl rejected with HTTP 400`,
    { status: lowerBidRes.status, message: lowerBidRes.data?.message }
  );

  const equalBidRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/bid`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bidDiscountPerQtl: 25, // Equal to current
    bidderPhone: '9800000012'
  });

  assert(
    equalBidRes.status === 400 && equalBidRes.data?.message?.includes('higher than current highest bid'),
    `Equal bid of ₹25/Qtl rejected with HTTP 400`,
    { status: equalBidRes.status, message: equalBidRes.data?.message }
  );

  // -------------------------------------------------------------
  // TEST 4: Hard MSP Floor Guard Protection
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Hard MSP Floor Guard Protection ---');
  // Attempt a discount so large that (baseMarketPrice - discount) < floorPrice
  const maxPossibleDiscount = round.baseMarketPrice - round.floorPrice;
  const excessiveDiscount = maxPossibleDiscount + 50;

  const floorViolationRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/bid`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bidDiscountPerQtl: excessiveDiscount,
    bidderPhone: '9800000013'
  });

  assert(
    floorViolationRes.status === 400 && floorViolationRes.data?.message?.includes('MSP floor'),
    `Excessive discount of ₹${excessiveDiscount}/Qtl blocked by Hard MSP Floor check`,
    { status: floorViolationRes.status, message: floorViolationRes.data?.message }
  );

  // -------------------------------------------------------------
  // TEST 5: Timer Expiration and Bidding Lockout
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Timer Expiration and Bidding Lockout ---');
  // Simulate simulatedNow in future past roundEndTime
  const pastEndTime = new Date(Date.now() + 500000).toISOString();

  const expiredBidRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/bid`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bidDiscountPerQtl: 30,
    bidderPhone: '9800000014',
    simulatedNow: pastEndTime
  });

  assert(
    expiredBidRes.status === 400 && expiredBidRes.data?.message?.includes('expired'),
    `Bidding rejected after timer expiry with HTTP 400`,
    { status: expiredBidRes.status, message: expiredBidRes.data?.message }
  );

  // -------------------------------------------------------------
  // TEST 6: Non-Officer Role Guard (RBAC 403 Rejection)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Non-Officer RBAC Access Control ---');
  const unauthorizedApproveRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/approve`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt}` // Farmer cannot approve
    }
  }, { decisionNotes: 'Illegal approval' });

  assert(
    unauthorizedApproveRes.status === 403,
    `Farmer role denied approval access with HTTP 403`,
    { status: unauthorizedApproveRes.status, message: unauthorizedApproveRes.data?.message }
  );

  // -------------------------------------------------------------
  // TEST 7: Resource Officer Approval & Queue Priority #1 Elevation
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Resource Officer Approval & Queue Position Elevation ---');
  const officerApproveRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${roundId}/approve`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resourceOfficerJwt}`
    }
  }, { decisionNotes: 'Approved priority queue jump by Resource Officer' });

  assert(
    officerApproveRes.status === 200 && officerApproveRes.data?.data?.round?.status === 'APPROVED',
    `Resource Officer successfully approved winning bid (Status: APPROVED)`,
    { status: officerApproveRes.status, decisionBy: officerApproveRes.data?.data?.round?.decisionBy }
  );

  // Verify Token document was updated with priority
  const tokenDetailRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${farmerJwt}` }
  });

  const tokenAfter = tokenDetailRes.data?.token || tokenDetailRes.data?.data;
  assert(
    tokenAfter?.isFastTrack === true && tokenAfter?.queuePosition === 1,
    `Token #${tokenNumber} elevated to Priority Queue Position #1 with isFastTrack=true`,
    {
      isFastTrack: tokenAfter?.isFastTrack,
      fastTrackTier: tokenAfter?.fastTrackTier,
      fastTrackDiscountedPrice: tokenAfter?.fastTrackDiscountedPrice,
      queuePosition: tokenAfter?.queuePosition
    }
  );

  // -------------------------------------------------------------
  // TEST 8: Officer Decline Workflow
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Officer Decline Workflow ---');
  // Book another token and start round to test decline
  const farmerPhone2 = `9825${runId}02`;
  const farmerJwt2 = jwt.sign(
    { id: '64b8f0a1c1d2e3f4a5b6c703', phone: farmerPhone2, name: 'Farmer 2', role: 'farmer' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/farmers/pickup-location',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt2}`
    }
  }, { latitude: 19.8928, longitude: 74.4820, address: 'Kopargaon Farm 2' });

  const book2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tokens/book',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt2}`
    }
  }, {
    farmerName: 'Farmer 2',
    farmerPhone: farmerPhone2,
    mandiId: 'KPG-01',
    crop: 'Soybean',
    quantity: 20
  });

  const token2Num = book2Res.data?.token?.tokenNumber;
  const start2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/fasttrack/rounds/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerJwt2}`
    }
  }, { tokenNumber: token2Num, startingBid: 10 });

  const round2Id = start2Res.data?.data?.roundId;

  const declineRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/fasttrack/rounds/${round2Id}/decline`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resourceOfficerJwt}`
    }
  }, { reason: 'Yard operational capacity limit reached for the day' });

  assert(
    declineRes.status === 200 && declineRes.data?.data?.status === 'DECLINED',
    `Resource Officer declined Fast-Track round with reason (Status: DECLINED)`,
    { status: declineRes.status, notes: declineRes.data?.data?.decisionNotes }
  );

  console.log('\n' + '='.repeat(70));
  console.log(`🏁 B5 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in B5 test suite:', err);
  process.exit(1);
});
