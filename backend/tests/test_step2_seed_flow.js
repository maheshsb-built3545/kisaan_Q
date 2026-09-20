/**
 * test_step2_seed_flow.js
 * Comprehensive execution of Step 2:
 * 1. Seed demo data
 * 2. Log in through real API as demo farmers 1-5
 * 3. Join seeded round with confirmed bookings
 * 4. Verify round auto-transitions to LIVE at 5 participants
 * 5. Run slot release job once
 * 6. Verify 6 seeded bookings were NOT released (all status remain BOOKED)
 * 7. Run --clean
 * 8. Print before/after counts per collection to prove only DEMO_ records removed
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const http = require('http');
const { execSync } = require('child_process');

function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getCollectionCounts(db) {
  return {
    tokens: await db.collection('tokens').countDocuments({}),
    tokensDemo: await db.collection('tokens').countDocuments({ $or: [{ tokenNumber: /^DEMO_/ }, { id: /^DEMO_/ }] }),
    farmers: await db.collection('farmers').countDocuments({}),
    farmersDemo: await db.collection('farmers').countDocuments({ phone: { $in: ['9800000101','9800000102','9800000103','9800000104','9800000105','9800000106','9800000107','9800000108','9800000109'] } }),
    rounds: await db.collection('fasttrackrounds').countDocuments({}),
    roundsDemo: await db.collection('fasttrackrounds').countDocuments({ roundId: /^DEMO_/ }),
    waitlist: await db.collection('waitlists').countDocuments({}),
    waitlistDemo: await db.collection('waitlists').countDocuments({ $or: [{ id: /^DEMO_/ }, { farmerPhone: { $in: ['9800000101','9800000102','9800000103','9800000104','9800000105','9800000106','9800000107','9800000108','9800000109'] } }] }),
    offers: await db.collection('slotoffers').countDocuments({}),
    offersDemo: await db.collection('slotoffers').countDocuments({ id: /^DEMO_/ }),
    complaints: await db.collection('complaints').countDocuments({}),
    complaintsDemo: await db.collection('complaints').countDocuments({ id: /^DEMO_/ }),
    staff: await db.collection('staffusers').countDocuments({})
  };
}

async function run() {
  console.log('======================================================================');
  console.log('🌱 STEP 2 SEED & REAL API VERIFICATION');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;
  function assert(cond, msg, extra = '') {
    if (cond) {
      passed++;
      console.log(`  ✅ [PASS] ${msg}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${msg}`, extra);
    }
  }

  // 1. Run Seed
  console.log('Step 2.1: Running seedDemoFlow.js...');
  const seedOutput = execSync('node scripts/seedDemoFlow.js', {
    cwd: require('path').resolve(__dirname, '..'),
    encoding: 'utf8'
  });
  console.log(seedOutput.split('\n').slice(0, 15).join('\n'));

  // Connect to DB for direct checks
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Check 6 seeded bookings and round
  const seededTokens = await db.collection('tokens').find({ tokenNumber: /^DEMO_TK_KPG_2026_10/ }).sort({ tokenNumber: 1 }).toArray();
  assert(seededTokens.length === 6, `6 Confirmed Bookings exist in DB (Count: ${seededTokens.length})`);

  const sampleToken = seededTokens[0];
  console.log(`\nSample Booking Slot Time: ${sampleToken.slotDate} ${sampleToken.slotTime}`);
  
  // Verify slot start is in the future
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  console.log(`Current IST Time: ${istFormatter.format(now)}`);
  
  const demoRound = await db.collection('fasttrackrounds').findOne({ roundId: /^DEMO_FTR_KPG/ });
  assert(demoRound !== null, `Seeded FastTrackRound exists: ${demoRound?.roundId}`);
  assert(demoRound?.status === 'JOINING', `Seeded round initial status is JOINING`);

  // 2. Log in through real API as demo farmers 1-5 and join round
  console.log('\nStep 2.2: Logging in via real API as demo farmers 1-5 & joining round...');
  const farmerTokens = [];

  for (let i = 0; i < 5; i++) {
    const phone = `980000010${i + 1}`;
    const tokenNumber = seededTokens[i].tokenNumber;

    // Step A: Request OTP
    const reqOtp = await apiRequest('/api/auth/farmer/request-otp', 'POST', {
      phone,
      mode: 'login'
    });
    assert(reqOtp.status === 200, `Farmer ${i + 1} (${phone}) requested OTP (HTTP 200)`);

    // Step B: Verify OTP (using mock OTP 123456)
    const verifyOtp = await apiRequest('/api/auth/farmer/verify-otp', 'POST', {
      phone,
      otp: '123456',
      mode: 'login'
    });
    const jwt = verifyOtp.data?.data?.token || verifyOtp.data?.token;
    assert(verifyOtp.status === 200 && jwt, `Farmer ${i + 1} authenticated via real API (JWT received)`);
    farmerTokens.push({ phone, tokenNumber, jwt });

    // Step C: Join Round
    const joinRes = await apiRequest(`/api/fasttrack/rounds/${demoRound.roundId}/join`, 'POST', {
      tokenNumber
    }, jwt);

    assert(joinRes.status === 200, `Farmer ${i + 1} joined round ${demoRound.roundId} (HTTP 200)`);
    if (i === 4) {
      assert(joinRes.data?.data?.status === 'LIVE', `Round transitioned to LIVE at exactly 5 participants! Status: ${joinRes.data?.data?.status}`);
    }
  }

  // Verify in MongoDB
  const liveRound = await db.collection('fasttrackrounds').findOne({ roundId: demoRound.roundId });
  assert(liveRound.status === 'LIVE', `MongoDB round status is confirmed LIVE`);
  assert(liveRound.participants.length === 5, `MongoDB round has 5 participants`);

  // 3. Run Release Job Once
  console.log('\nStep 2.3: Running slot reallocation release job once...');
  const slotReallocationService = require('../src/services/slotReallocationService');
  const releaseResults = await slotReallocationService.processSlotReallocationCycle();
  console.log('   Release cycle result:', releaseResults);

  // Show 6 bookings were NOT released
  const tokensAfterRelease = await db.collection('tokens').find({ tokenNumber: /^DEMO_TK_KPG_2026_10/ }).toArray();
  const allStillBooked = tokensAfterRelease.every(t => t.status === 'BOOKED');
  assert(allStillBooked, `All 6 seeded bookings were NOT released (Status remained BOOKED)`);
  tokensAfterRelease.forEach(t => {
    console.log(`   Token ${t.tokenNumber}: Status = ${t.status} (Slot: ${t.slotDate} ${t.slotTime})`);
  });

  // 4. Run --clean and verify before/after counts
  console.log('\nStep 2.4: Running --clean and capturing before/after counts per collection...');
  const countsBefore = await getCollectionCounts(db);

  const cleanOutput = execSync('node scripts/seedDemoFlow.js --clean', {
    cwd: require('path').resolve(__dirname, '..'),
    encoding: 'utf8'
  });
  console.log(cleanOutput.trim());

  const countsAfter = await getCollectionCounts(db);

  console.log('\n----------------------------------------------------------------------');
  console.log('COLLECTION COUNTS (BEFORE vs AFTER CLEAN):');
  console.log('----------------------------------------------------------------------');
  const collections = ['tokens', 'farmers', 'rounds', 'waitlist', 'offers', 'complaints', 'staff'];
  for (const c of collections) {
    const totalB = countsBefore[c];
    const totalA = countsAfter[c];
    const demoB = countsBefore[`${c}Demo`] || 0;
    const demoA = countsAfter[`${c}Demo`] || 0;
    const nonDemoB = totalB - demoB;
    const nonDemoA = totalA - demoA;

    console.log(`  • ${c.toUpperCase().padEnd(12)} | Total Before: ${String(totalB).padStart(3)} | Total After: ${String(totalA).padStart(3)} | Non-Demo Untouched: ${nonDemoB === nonDemoA ? 'YES (' + nonDemoA + ')' : 'NO'}`);
  }

  assert(countsAfter.tokensDemo === 0, 'DEMO_ tokens count after clean is 0');
  assert(countsAfter.farmersDemo === 0, 'DEMO_ farmers count after clean is 0');
  assert(countsAfter.roundsDemo === 0, 'DEMO_ rounds count after clean is 0');
  assert(countsAfter.waitlistDemo === 0, 'DEMO_ waitlists count after clean is 0');
  assert(countsBefore.staff === countsAfter.staff, 'Staff collection completely untouched by clean');

  console.log(`\n======================================================================`);
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`======================================================================\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
