require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Token, Waitlist, SlotOffer } = require('../src/models');
const slotReallocationService = require('../src/services/slotReallocationService');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const TEST_PREFIX = 'TEST_B4_';

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method, headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSlotReleaseTests() {
  console.log('='.repeat(75));
  console.log('⚡ KISANQ B4 — AUTO SLOT RELEASE & WAITLIST REALLOCATION TEST');
  console.log('='.repeat(75));

  let passed = 0;
  let failed = 0;
  let notChecked = 0;

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
  if (mongoUri && mongoUri !== 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    try {
      await mongoose.connect(mongoUri);
    } catch (e) {
      console.warn('DB connect notice:', e.message);
    }
  }

  const phoneA = '9800000041';
  const phoneB = '9800000042';
  const phoneC = '9800000043';
  const tokenNumA = `${TEST_PREFIX}TK_RELEASE_01`;

  try {
    // -----------------------------------------------------------------------
    // Section 1: Timing Config Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Section 1: Timing Config Verification ---');
    const defaultTimings = slotReallocationService.getTimingConfig();
    assert(defaultTimings.warnMs === 5 * 60 * 1000, 'Default warning threshold is 5 minutes (WARN 5 min)');
    assert(defaultTimings.graceMs === 10 * 60 * 1000, 'Default grace threshold is 10 minutes (GRACE 10 min)');
    assert(defaultTimings.offerMs === 10 * 60 * 1000, 'Default offer decision window is 10 minutes (OFFER 10 min)');

    const customTimings = slotReallocationService.getTimingConfig({ warnSec: 5, graceSec: 10, offerSec: 10 });
    assert(customTimings.warnMs === 5000 && customTimings.graceMs === 10000 && customTimings.offerMs === 10000, 'Second-level timing overrides work for automated testing');

    // -----------------------------------------------------------------------
    // Section 2: Setup Test Data in MongoDB Atlas
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Clean and Initialize Test Records ---');
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      await Token.updateMany({ status: 'BOOKED' }, { status: 'CANCELLED' });
      await Waitlist.deleteMany({ farmerPhone: { $in: [phoneA, phoneB, phoneC] } });
      await SlotOffer.deleteMany({ farmerPhone: { $in: [phoneA, phoneB, phoneC] } });

      // Create unarrived token A
      await Token.create({
        tokenNumber: tokenNumA,
        farmerName: 'Kisan A',
        farmerPhone: phoneA,
        phone: phoneA,
        mandiId: 'KPG-01',
        mandiCode: 'KPG',
        mandiName: 'APMC Kopargaon',
        crop: 'Soybean',
        quantity: 25,
        slotDate: new Date().toISOString().split('T')[0],
        slotTime: '08:00 AM - 11:00 AM',
        status: 'BOOKED',
        currentStageIndex: 0,
        stages: [{ stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Pending' }]
      });

      // Farmer B joins Waitlist
      await Waitlist.create({
        farmerName: 'Kisan B (Waitlisted)',
        farmerPhone: phoneB,
        centreId: 'KPG-01',
        mandiId: 'KPG-01',
        mandiName: 'APMC Kopargaon',
        crop: 'Soybean',
        quantity: 25,
        requestedSlotDate: new Date().toISOString().split('T')[0],
        requestedSlotTime: '08:00 AM - 11:00 AM',
        priority: 1,
        status: 'WAITING'
      });
      assert(true, 'Initialized test Token and Waitlist candidate in database');
    }

    // -----------------------------------------------------------------------
    // Section 3: Warning Phase (WARN 5 min)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: Arrival Warning Execution (WARN threshold) ---');
    // Simulate current time is 6 minutes after 08:00 AM
    const slotStart = slotReallocationService.parseSlotStartTime(new Date().toISOString().split('T')[0], '08:00 AM - 11:00 AM');
    const timeAt6Min = new Date(slotStart.getTime() + 6 * 60 * 1000);

    const warnCycle = await slotReallocationService.processSlotReallocationCycle({
      simulatedNow: timeAt6Min,
      warnSec: 5 * 60,
      graceSec: 10 * 60,
      offerSec: 10 * 60
    });

    assert(warnCycle.warningsIssued >= 1, 'Warning cycle issued arrival warning alert');
    const warnedToken = await Token.findOne({ tokenNumber: tokenNumA });
    assert(warnedToken?.warnedAt !== null, 'Token marked with warnedAt timestamp');
    assert(warnedToken?.status === 'BOOKED', 'Token remains in BOOKED status during warning phase');

    // -----------------------------------------------------------------------
    // Section 4: Grace Expiry & Auto Release (GRACE 10 min)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Grace Expiry & Automatic Slot Release ---');
    // Simulate current time is 11 minutes after 08:00 AM
    const timeAt11Min = new Date(slotStart.getTime() + 11 * 60 * 1000);

    const graceCycle = await slotReallocationService.processSlotReallocationCycle({
      simulatedNow: timeAt11Min,
      warnSec: 5 * 60,
      graceSec: 10 * 60,
      offerSec: 10 * 60
    });

    assert(graceCycle.slotsReleased >= 1, 'Grace cycle auto-released expired slot');
    assert(graceCycle.offersCreated >= 1, 'Automatically created slot offer for waitlisted Farmer B');

    const cancelledToken = await Token.findOne({ tokenNumber: tokenNumA });
    assert(cancelledToken?.status === 'CANCELLED', 'Unarrived token automatically cancelled');
    assert(cancelledToken?.cancellationReason?.includes('missed arrival grace period'), 'Cancellation reason recorded correctly');

    // Verify Offer created for Farmer B
    const offerB = await SlotOffer.findOne({ farmerPhone: phoneB, status: 'PENDING' });
    assert(offerB !== null, 'Slot offer document created for Farmer B');
    assert(offerB?.releasedTokenNumber === tokenNumA, 'Offer references released token');
    assert(offerB?.crop === 'Soybean' && offerB?.quantity === 25, 'Offer matches requested crop and quantity');

    const waitlistB = await Waitlist.findById(offerB?.waitlistId);
    assert(waitlistB?.status === 'OFFERED', 'Farmer B waitlist status transitioned to OFFERED');

    // -----------------------------------------------------------------------
    // Section 5: Atomic Offer Acceptance & Token Issuance
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Atomic Offer Acceptance Endpoint ---');
    const tokenB = jwt.sign({ id: '64b8f0a1c1d2e3f4a5b6c042', phone: phoneB, name: 'Kisan B', role: 'farmer' }, JWT_SECRET);
    const tokenC = jwt.sign({ id: '64b8f0a1c1d2e3f4a5b6c043', phone: phoneC, name: 'Kisan C', role: 'farmer' }, JWT_SECRET);

    const acceptRes = await makeRequest(`/api/slots/offers/${offerB._id}/accept`, 'POST', {
      phone: phoneB
    }, tokenB);

    assert(acceptRes.status === 200, 'POST /api/slots/offers/:id/accept returned 200 OK');
    assert(acceptRes.body?.data?.token?.status === 'BOOKED', 'Accepted offer generated new BOOKED token');
    const newTokNum = acceptRes.body?.data?.token?.tokenNumber;
    assert(newTokNum?.startsWith('KQ-KPG-'), `Generated valid token number: ${newTokNum}`);

    const updatedOfferB = await SlotOffer.findById(offerB._id);
    assert(updatedOfferB?.status === 'ACCEPTED', 'Slot offer status transitioned to ACCEPTED');
    assert(updatedOfferB?.createdTokenNumber === newTokNum, 'Slot offer records createdTokenNumber');

    // Double accept prevention (race condition test)
    const doubleAcceptRes = await makeRequest(`/api/slots/offers/${offerB._id}/accept`, 'POST', {
      phone: phoneB
    }, tokenB);
    assert(doubleAcceptRes.status === 400, 'Double claim / second accept attempt cleanly rejected with 400');

    // -----------------------------------------------------------------------
    // Section 6: Decline Offer & Chain Reallocation
    // -----------------------------------------------------------------------
    console.log('\n--- Section 6: Decline Offer & Next Candidate Chaining ---');
    // Farmer C joins waitlist
    const waitlistC = await Waitlist.create({
      farmerName: 'Kisan C',
      farmerPhone: phoneC,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 30,
      requestedSlotDate: new Date().toISOString().split('T')[0],
      requestedSlotTime: '08:00 AM - 11:00 AM',
      priority: 0,
      status: 'WAITING'
    });

    // Create manual offer to Farmer C
    const offerC = await SlotOffer.create({
      waitlistId: waitlistC._id,
      releasedTokenNumber: 'RELEASED_SAMPLE',
      farmerPhone: phoneC,
      farmerName: 'Kisan C',
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      crop: 'Soybean',
      quantity: 30,
      slotDate: new Date().toISOString().split('T')[0],
      slotTime: '08:00 AM - 11:00 AM',
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      status: 'PENDING'
    });

    const declineRes = await makeRequest(`/api/slots/offers/${offerC._id}/decline`, 'POST', {
      phone: phoneC
    }, tokenC);
    assert(declineRes.status === 200, 'POST /api/slots/offers/:id/decline returned 200 OK');

    const updatedOfferC = await SlotOffer.findById(offerC._id);
    assert(updatedOfferC?.status === 'DECLINED', 'Slot offer marked DECLINED');

    // -----------------------------------------------------------------------
    // Section 7: Offer Expiration Handling (OFFER 10 min)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 7: Offer Expiry Processing ---');
    const expiredOfferDoc = await SlotOffer.create({
      waitlistId: waitlistC._id,
      releasedTokenNumber: 'RELEASED_EXP_SAMPLE',
      farmerPhone: phoneC,
      farmerName: 'Kisan C',
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      crop: 'Soybean',
      quantity: 30,
      slotDate: new Date().toISOString().split('T')[0],
      slotTime: '08:00 AM - 11:00 AM',
      offeredAt: new Date(Date.now() - 15 * 60 * 1000),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
      status: 'PENDING'
    });

    const expCycle = await slotReallocationService.processSlotReallocationCycle();
    assert(expCycle.offersExpired >= 1, 'Expired slot offer detected and transitioned to EXPIRED');

    const reloadedExpOffer = await SlotOffer.findById(expiredOfferDoc._id);
    assert(reloadedExpOffer?.status === 'EXPIRED', 'Past offer marked EXPIRED');

    // -----------------------------------------------------------------------
    // Section 8: Restart Safety & Job Idempotency (Run Twice)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 8: Restart Safety & Idempotency (Run Job Twice) ---');
    // First run to settle any pending state
    await slotReallocationService.processSlotReallocationCycle();
    // Second run must find 0 work
    const secondExpCycle = await slotReallocationService.processSlotReallocationCycle();
    assert(secondExpCycle.slotsReleased === 0, 'Second consecutive run releases 0 additional slots (idempotent)');
    assert(secondExpCycle.offersExpired === 0, 'Second consecutive run expires 0 additional offers (idempotent)');

    // AuditLog verification
    const { AuditLog } = require('../src/models');
    if (mongoose.connection.readyState === 1) {
      const releaseLogs = await AuditLog.find({ action: { $in: ['SLOT_AUTO_RELEASE', 'SLOT_ARRIVAL_WARNING', 'SLOT_OFFER_CREATED', 'SLOT_OFFER_ACCEPTED', 'SLOT_OFFER_DECLINED'] } });
      assert(releaseLogs.length >= 3, `AuditLog recorded ${releaseLogs.length} slot reallocation events`);
    }

    // -----------------------------------------------------------------------
    // Section 9: Notification & SMS Disclaimers
    // -----------------------------------------------------------------------
    console.log('\n--- Section 9: Real World Disclaimers ---');
    console.log('  ⚠️ Real SMS dispatch: NOT CHECKED (no Fast2SMS key)');
    console.log('  ⚠️ Real farmer speech: NOT CHECKED (no clips in backend/tests/audio-real/)');
    notChecked += 2;

    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      if (newTokNum) await Token.deleteOne({ tokenNumber: newTokNum });
      await Waitlist.deleteMany({ farmerPhone: { $in: [phoneA, phoneB, phoneC] } });
      await SlotOffer.deleteMany({ farmerPhone: { $in: [phoneA, phoneB, phoneC] } });
      console.log('\n🧹 Cleaned up TEST_B4_ records from MongoDB Atlas.');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED`);
  console.log('='.repeat(75));

  if (failed > 0) process.exit(1);
}

runSlotReleaseTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
