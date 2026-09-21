require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const { Token, Waitlist, SlotOffer } = require('../src/models');
const slotReallocationService = require('../src/services/slotReallocationService');

const TEST_PREFIX = 'TEST_DEDUP_';

async function runTest() {
  console.log('='.repeat(80));
  console.log('⚡ KISANQ FIX BATCH 4 — STEP 2: SLOT OFFER DEDUPLICATION TEST (3 CYCLES)');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  const testPhone = '9800000099';
  const testTokenNum = `${TEST_PREFIX}TK_RELEASED_01`;

  try {
    // 1. Initial cleanup of test records
    await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
    await Waitlist.deleteMany({ farmerPhone: testPhone });
    await SlotOffer.deleteMany({
      $or: [
        { farmerPhone: testPhone },
        { releasedTokenNumber: testTokenNum }
      ]
    });

    // 2. Setup a waitlisted farmer and an unarrived token ready for auto-release
    const now = new Date();
    const timings = slotReallocationService.getTimingConfig();

    // Elapsed time >= grace threshold -> triggers auto-release
    const slotStart = new Date(now.getTime() - (timings.graceMs + 60000));
    const h = slotStart.getHours();
    const m = slotStart.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const timeStr = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm} - 08:00 PM`;

    await Token.create({
      tokenNumber: testTokenNum,
      id: testTokenNum,
      farmerName: 'Namdev Shinde',
      farmerPhone: '9800000098',
      phone: '9800000098',
      mandiId: 'KPG-01',
      mandiCode: 'KPG',
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 30,
      slotDate: slotStart.toISOString().split('T')[0],
      slotTime: timeStr,
      status: 'BOOKED',
      warnedAt: new Date(now.getTime() - (timings.graceMs - 60000)),
      stages: [{ stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Pending' }]
    });

    await Waitlist.create({
      id: `${TEST_PREFIX}WL_01`,
      farmerName: 'Balu Kadam',
      farmerPhone: testPhone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 25,
      requestedSlotDate: now.toISOString().split('T')[0],
      requestedSlotTime: timeStr,
      priority: 0,
      status: 'WAITING',
      joinedAt: now
    });

    // 3. Run Job Iteration 1
    console.log('\n--- Running Reallocation Job: Cycle 1 ---');
    const res1 = await slotReallocationService.processSlotReallocationCycle();
    console.log(`Cycle 1 Result: Released=${res1.slotsReleased}, OffersCreated=${res1.offersCreated}`);
    assert(res1.slotsReleased >= 1, 'Cycle 1: Released the unarrived test token');
    assert(res1.offersCreated >= 1, 'Cycle 1: Created slot offer for waitlisted candidate');

    const offersAfter1 = await SlotOffer.find({
      $or: [{ farmerPhone: testPhone }, { releasedTokenNumber: testTokenNum }],
      status: 'PENDING'
    });
    assert(offersAfter1.length === 1, `Exactly 1 active PENDING offer exists after Cycle 1 (Found: ${offersAfter1.length})`);

    // 4. Run Job Iteration 2 (Should create 0 duplicates)
    console.log('\n--- Running Reallocation Job: Cycle 2 ---');
    const res2 = await slotReallocationService.processSlotReallocationCycle();
    console.log(`Cycle 2 Result: Released=${res2.slotsReleased}, OffersCreated=${res2.offersCreated}`);
    assert(res2.offersCreated === 0, 'Cycle 2: Created 0 new offers (Deduplication guard prevented duplicate)');

    const offersAfter2 = await SlotOffer.find({
      $or: [{ farmerPhone: testPhone }, { releasedTokenNumber: testTokenNum }],
      status: 'PENDING'
    });
    assert(offersAfter2.length === 1, `Still exactly 1 active offer after Cycle 2 (Found: ${offersAfter2.length})`);

    // 5. Run Job Iteration 3 (Should still create 0 duplicates)
    console.log('\n--- Running Reallocation Job: Cycle 3 ---');
    const res3 = await slotReallocationService.processSlotReallocationCycle();
    console.log(`Cycle 3 Result: Released=${res3.slotsReleased}, OffersCreated=${res3.offersCreated}`);
    assert(res3.offersCreated === 0, 'Cycle 3: Created 0 new offers (Deduplication guard consistently preserved)');

    const offersAfter3 = await SlotOffer.find({
      $or: [{ farmerPhone: testPhone }, { releasedTokenNumber: testTokenNum }],
      status: 'PENDING'
    });
    assert(offersAfter3.length === 1, `Still exactly 1 active offer after Cycle 3 (Found: ${offersAfter3.length})`);

    // 6. Direct offerNextWaitlistCandidate call test
    console.log('\n--- Testing Direct offerNextWaitlistCandidate Deduplication ---');
    const directOffer = await slotReallocationService.offerNextWaitlistCandidate('KPG-01', slotStart.toISOString().split('T')[0], testTokenNum);
    assert(directOffer === null, 'Direct call returned null instead of creating duplicate');

    const offersAfterDirect = await SlotOffer.find({
      $or: [{ farmerPhone: testPhone }, { releasedTokenNumber: testTokenNum }],
      status: 'PENDING'
    });
    assert(offersAfterDirect.length === 1, 'Final count remains strictly 1 offer across 3 job runs + 1 direct invocation');

  } finally {
    // 7. Cleanup test records
    console.log('\n🧹 Cleaning up test fixtures...');
    await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
    await Waitlist.deleteMany({ farmerPhone: testPhone });
    await SlotOffer.deleteMany({
      $or: [
        { farmerPhone: testPhone },
        { releasedTokenNumber: testTokenNum }
      ]
    });
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    console.log('✨ Cleanup complete.\n');
  }

  console.log('='.repeat(80));
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed} | NOT CHECKED: 0`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
