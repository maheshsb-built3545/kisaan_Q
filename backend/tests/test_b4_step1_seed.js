require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Farmer, Token, Booking, Waitlist, SlotOffer, FastTrackRound } = require('../src/models');
const slotReallocationService = require('../src/services/slotReallocationService');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

// Helper to start ephemeral server using express app
let server = null;
let baseUrl = '';

function startEphemeralServer() {
  return new Promise((resolve) => {
    const { app } = require('../src/server');
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopEphemeralServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function makeJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function apiGet(path, token = null) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTest() {
  console.log('='.repeat(80));
  console.log('🧪 KISANQ FIX BATCH 4 — STEP 1: SEED COMPLETENESS & REAL API VERIFICATION');
  console.log('='.repeat(80));

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

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  await startEphemeralServer();

  try {
    // -------------------------------------------------------------------------
    // 1. Verify 9 Farmers exist and can authenticate
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Proving 9 Farmers exist via GET /api/auth/me ---');
    const demoPhones = [
      '9800000101', '9800000102', '9800000103', '9800000104', '9800000105',
      '9800000106', '9800000107', '9800000108', '9800000109'
    ];

    for (let i = 0; i < demoPhones.length; i++) {
      const phone = demoPhones[i];
      const farmerDoc = await Farmer.findOne({ phone });
      assert(farmerDoc !== null, `Farmer ${i + 1} (${phone}) exists in Citizen Registry`);

      const farmerToken = makeJwt({ id: farmerDoc._id.toString(), phone, role: 'farmer', area: 'farmer' });
      const meRes = await apiGet('/api/auth/me', farmerToken);
      assert(meRes.status === 200 && meRes.data?.data?.user?.phone === phone, `GET /api/auth/me for Farmer ${i + 1} (${phone}) returned HTTP 200 as authenticated farmer`);
    }

    // -------------------------------------------------------------------------
    // 2. Verify 6 Bookings in Next Whole-Hour Slot
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Proving 6 Bookings in next whole-hour slot via GET /api/tokens/farmer/:phone ---');
    for (let i = 0; i < 6; i++) {
      const phone = demoPhones[i];
      const farmerDoc = await Farmer.findOne({ phone });
      const tokenDoc = await Token.findOne({ farmerPhone: phone, status: 'BOOKED' });
      const bookingDoc = await Booking.findOne({ tokenNumber: tokenDoc?.tokenNumber });

      assert(tokenDoc && bookingDoc, `Farmer ${i + 1} has active token (${tokenDoc?.tokenNumber}) and booking in DB`);

      const farmerToken = makeJwt({ id: farmerDoc._id.toString(), phone, role: 'farmer', area: 'farmer' });
      const tokRes = await apiGet(`/api/tokens/farmer/${phone}`, farmerToken);
      const returnedTok = tokRes.data?.tokens?.find(t => t.tokenNumber === tokenDoc.tokenNumber);
      assert(tokRes.status === 200 && !!returnedTok, `GET /api/tokens/farmer/${phone} returned booking ${tokenDoc.tokenNumber} (slot: ${tokenDoc.slotTime})`);
    }

    // -------------------------------------------------------------------------
    // 3. Verify 1 FastTrackRound in JOINING status
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Proving 1 JOINING Fast-Track round via GET /api/fasttrack/rounds ---');
    const ftrRes = await apiGet('/api/fasttrack/rounds?centreId=KPG-01');
    const rounds = ftrRes.data?.data?.rounds || [];
    const demoRound = rounds.find(r => r.roundId.startsWith('DEMO_FTR_KPG_') && r.status === 'JOINING');
    assert(ftrRes.status === 200 && !!demoRound, `GET /api/fasttrack/rounds returned JOINING round ${demoRound?.roundId} (Reserve: ₹${demoRound?.reserveFee}, Step: ₹${demoRound?.bidStep})`);

    // -------------------------------------------------------------------------
    // 4. Verify 1 Waitlist Entry (Farmer 7)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Proving 1 Waitlist Entry via GET /api/waitlist/my as Farmer 7 ---');
    const farmer7 = await Farmer.findOne({ phone: '9800000107' });
    const farmer7Token = makeJwt({ id: farmer7._id.toString(), phone: '9800000107', role: 'farmer', area: 'farmer' });
    const wlRes = await apiGet('/api/waitlist/my', farmer7Token);
    const wlEntries = wlRes.data?.data?.waitlist || [];
    const farmer7Entry = wlEntries.find(e => e.status === 'WAITING');
    assert(wlRes.status === 200 && !!farmer7Entry, `GET /api/waitlist/my as Farmer 7 returned waitlist entry (status: ${farmer7Entry?.status}, centre: ${farmer7Entry?.centreId})`);

    // -------------------------------------------------------------------------
    // 5. Verify 1 No-Show Booking (Farmer 8)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Proving 1 No-Show Booking via GET /api/tokens/farmer/9800000108 ---');
    const farmer8 = await Farmer.findOne({ phone: '9800000108' });
    const farmer8Token = makeJwt({ id: farmer8._id.toString(), phone: '9800000108', role: 'farmer', area: 'farmer' });
    const noShowRes = await apiGet('/api/tokens/farmer/9800000108', farmer8Token);
    const noShowTok = noShowRes.data?.tokens?.find(t => t.tokenNumber === 'DEMO_TK_KPG_NOSHOW_08');
    assert(
      noShowRes.status === 200 &&
      noShowTok &&
      noShowTok.warnedAt !== null,
      `GET /api/tokens/farmer/9800000108 returned near no-show token DEMO_TK_KPG_NOSHOW_08 (warnedAt: ${noShowTok?.warnedAt})`
    );

    // -------------------------------------------------------------------------
    // 6. Verify 1 Active Token at Assaying Step (Farmer 9)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Proving 1 Active Token at Assaying Step via GET /api/tokens/farmer/9800000109 ---');
    const farmer9 = await Farmer.findOne({ phone: '9800000109' });
    const farmer9Token = makeJwt({ id: farmer9._id.toString(), phone: '9800000109', role: 'farmer', area: 'farmer' });
    const activeRes = await apiGet('/api/tokens/farmer/9800000109', farmer9Token);
    const activeTok = activeRes.data?.tokens?.find(t => t.tokenNumber === 'DEMO_TK_KPG_ACTIVE_09');
    assert(
      activeRes.status === 200 &&
      activeTok &&
      activeTok.status === 'GATE_IN' &&
      activeTok.currentStageIndex === 1,
      `GET /api/tokens/farmer/9800000109 returned active token DEMO_TK_KPG_ACTIVE_09 at QUALITY_GRADING step (stageIndex: 1, status: GATE_IN)`
    );

    // -------------------------------------------------------------------------
    // 7. No-Show Auto-Release in ~2 min and Offer to Waitlist Farmer 7
    // -------------------------------------------------------------------------
    console.log('\n--- 7. No-Show Demo: Proving Auto-Release & Offer to Farmer 7 in ~2 minutes ---');
    const timings = slotReallocationService.getTimingConfig();
    console.log(`  ⏱️ Slot Timers: WARN=${timings.warnMs / 1000}s, GRACE=${timings.graceMs / 1000}s, OFFER=${timings.offerMs / 1000}s`);

    // Simulate 2 minutes 5 seconds forward in time
    const simulatedNow = new Date(Date.now() + 125 * 1000);
    console.log(`  ⏳ Simulating reallocation cycle at ${simulatedNow.toISOString()} (~2 min ahead)...`);
    const cycleResults = await slotReallocationService.processSlotReallocationCycle({ simulatedNow });
    console.log(`  ↳ Cycle results: Released=${cycleResults.slotsReleased}, OffersCreated=${cycleResults.offersCreated}`);

    assert(cycleResults.slotsReleased >= 1, `Slot reallocation job auto-released Farmer 8 token (missed grace period)`);
    assert(cycleResults.offersCreated >= 1, `Slot reallocation job created offer for Waitlist candidate Farmer 7`);

    // Verify token state in DB and via API
    const updatedFarmer8Tok = await Token.findOne({ tokenNumber: 'DEMO_TK_KPG_NOSHOW_08' });
    assert(updatedFarmer8Tok.status === 'CANCELLED' && updatedFarmer8Tok.releasedAt !== null, `Farmer 8 token transitioned to CANCELLED with releasedAt timestamp`);

    // Verify Farmer 7 received offer
    const farmer7Offer = await SlotOffer.findOne({ farmerPhone: '9800000107' });
    assert(farmer7Offer !== null && farmer7Offer.status === 'PENDING', `Farmer 7 received active SlotOffer for released token ${farmer7Offer?.releasedTokenNumber} (Expires in ${Math.round((farmer7Offer?.expiresAt?.getTime() - Date.now()) / 1000)}s)`);

    const waitlist7Updated = await Waitlist.findOne({ farmerPhone: '9800000107' });
    assert(waitlist7Updated.status === 'OFFERED', `Farmer 7 Waitlist status transitioned to OFFERED`);

    // Proving offer via real API: GET /api/waitlist/offers as staff
    const staffOfficerToken = makeJwt({ id: '64b8f0a1c1d2e3f4a5b6d006', phone: '9800000006', role: 'resource_officer', centreId: 'KPG-01', area: 'staff' });
    const offersApiRes = await apiGet('/api/waitlist/offers?centreId=KPG-01', staffOfficerToken);
    const apiOffers = offersApiRes.data?.data?.offers || [];
    const foundApiOffer = apiOffers.find(o => o.releasedTokenNumber === 'DEMO_TK_KPG_NOSHOW_08');
    assert(offersApiRes.status === 200 && !!foundApiOffer, `GET /api/waitlist/offers?centreId=KPG-01 returned newly created offer for Farmer 7 (${foundApiOffer?.farmerPhone})`);

    // Cleanup the demo release and reseed to keep idempotent state
    console.log('\n🧹 Restoring clean seed state...');
    await Token.updateOne(
      { tokenNumber: 'DEMO_TK_KPG_NOSHOW_08' },
      { $set: { status: 'BOOKED', warnedAt: new Date() }, $unset: { releasedAt: 1, cancellationReason: 1, releaseReason: 1 } }
    );
    await Booking.updateOne(
      { tokenNumber: 'DEMO_TK_KPG_NOSHOW_08' },
      { $set: { status: 'BOOKED' } }
    );
    await SlotOffer.deleteMany({ farmerPhone: '9800000107' });
    await Waitlist.updateOne(
      { farmerPhone: '9800000107' },
      { $set: { status: 'WAITING' } }
    );
    console.log('✅ Clean demo seed restored.\n');

  } finally {
    slotReallocationService.stopReallocationJob();
    try {
      const fastTrackAuctionService = require('../src/services/fastTrackAuctionService');
      fastTrackAuctionService.stopAuctionWorker();
    } catch (e) {}

    await stopEphemeralServer();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }

  console.log('='.repeat(80));
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed} | NOT CHECKED: 0`);
  console.log('='.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
