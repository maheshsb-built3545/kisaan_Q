const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { Farmer, Token, Waitlist, SlotOffer, FastTrackRound, Complaint } = require('../src/models');
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

let passCount = 0;
let failCount = 0;

function pass(name, details = '') {
  passCount++;
  console.log(`  ✅ PASS: ${name}`);
  if (details) console.log(`     ↳ ${details}`);
}

function fail(name, err) {
  failCount++;
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`     ↳ ${err.message}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

async function runTests() {
  console.log('===========================================================================');
  console.log('🔒 KISANQ — JWT IDENTITY ISOLATION & CENTRE SCOPING TEST SUITE');
  console.log('===========================================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas for test assertions.');

  const FARMER_A_PHONE = '9800000081';
  const FARMER_B_PHONE = '9800000082';

  const tokenFarmerA = makeToken({ id: '64b8f0a1c1d2e3f4a5b6c081', phone: FARMER_A_PHONE, name: 'Farmer A', role: 'farmer' });
  const tokenFarmerB = makeToken({ id: '64b8f0a1c1d2e3f4a5b6c082', phone: FARMER_B_PHONE, name: 'Farmer B', role: 'farmer' });

  const tokenOfficerKPG = makeToken({ id: '64b8f0a1c1d2e3f4a5b6c006', role: 'resource_officer', assignedMandi: 'KPG-01', name: 'Officer KPG' });
  const tokenOfficerSRD = makeToken({ id: '64b8f0a1c1d2e3f4a5b6c016', role: 'resource_officer', assignedMandi: 'SRD-02', name: 'Officer SRD' });
  const tokenDistrictAdmin = makeToken({ id: '64b8f0a1c1d2e3f4a5b6c007', role: 'district_admin', assignedMandi: 'KPG-01', name: 'District Admin' });

  // Clean test fixtures
  await Token.deleteMany({ tokenNumber: { $regex: /^TEST_ISO_/ } });
  await Waitlist.deleteMany({ farmerPhone: { $in: [FARMER_A_PHONE, FARMER_B_PHONE] } });
  await SlotOffer.deleteMany({ farmerPhone: { $in: [FARMER_A_PHONE, FARMER_B_PHONE] } });
  await Complaint.deleteMany({ tokenNumber: { $regex: /^TEST_ISO_/ } });

  // Seed token for Farmer B
  const tokenB = await Token.create({
    tokenNumber: 'TEST_ISO_TK_B_01',
    id: 'TEST_ISO_TK_B_01',
    farmerName: 'Farmer B',
    farmerPhone: FARMER_B_PHONE,
    phone: FARMER_B_PHONE,
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Soybean',
    quantity: 25,
    status: 'Booked',
    slotDate: 'Today',
    slotTime: 'Morning 08:00 – 11:00 AM'
  });

  // Seed slot offer for Farmer B
  const offerB = await SlotOffer.create({
    waitlistId: new mongoose.Types.ObjectId(),
    farmerPhone: FARMER_B_PHONE,
    farmerName: 'Farmer B',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    releasedTokenNumber: 'RELEASED_TK_01',
    crop: 'Soybean',
    quantity: 25,
    slotDate: 'Today',
    slotTime: 'Morning 08:00 – 11:00 AM',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 600000)
  });

  console.log('\n--- Section 1: Farmer Waitlist & Offer Identity Isolation ---');
  // 1.1 Farmer A calls GET /api/waitlist/my with phone=FARMER_B_PHONE
  try {
    const res = await request(`/api/waitlist/my?phone=${FARMER_B_PHONE}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmerA}` }
    });
    assert.strictEqual(res.status, 200);
    // Farmer A's result must have 0 offers (Farmer B has 1 offer)
    assert.strictEqual(res.data.data.offers.length, 0, 'Farmer A must not receive Farmer B offers');
    pass('Farmer A cannot view Farmer B offers even if phone=B is passed in query', `Offers returned: ${res.data.data.offers.length}`);
  } catch (err) {
    fail('Farmer A isolation on GET /api/waitlist/my', err);
  }

  // 1.2 Farmer A attempts to accept Farmer B's slot offer
  try {
    const res = await request(`/api/waitlist/offers/${offerB._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFarmerA}` },
      body: JSON.stringify({ phone: FARMER_B_PHONE })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('not longer valid') || res.data.message.includes('expired') || res.data.message.includes('already claimed') || res.data.message.includes('no longer valid'));
    pass('Farmer A cannot accept Farmer B slot offer even if body specifies phone=B', res.data.message);
  } catch (err) {
    fail('Farmer A accepting Farmer B offer', err);
  }

  // 1.3 Farmer A attempts to decline Farmer B's slot offer
  try {
    const res = await request(`/api/waitlist/offers/${offerB._id}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFarmerA}` },
      body: JSON.stringify({ phone: FARMER_B_PHONE })
    });
    assert.strictEqual(res.status, 400);
    pass('Farmer A cannot decline Farmer B slot offer even if body specifies phone=B', res.data.message);
  } catch (err) {
    fail('Farmer A declining Farmer B offer', err);
  }

  console.log('\n--- Section 2: Farmer Complaint Filing Identity Isolation ---');
  // 2.1 Farmer A attempts to file a grievance on Farmer B's token
  try {
    const res = await request('/api/complaints', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFarmerA}` },
      body: JSON.stringify({
        tokenNumber: 'TEST_ISO_TK_B_01',
        checkpoint: 'QUALITY_GRADING',
        category: 'ASSAYING_DISPUTE',
        description: 'Moisture cut dispute on produce'
      })
    });
    assert.strictEqual(res.status, 403);
    assert.ok(res.data.message.includes('Forbidden') || res.data.message.includes('own confirmed'));
    pass('Farmer A cannot file a complaint on Farmer B token (403 Forbidden)', res.data.message);
  } catch (err) {
    fail('Farmer A filing complaint on Farmer B token', err);
  }

  // 2.2 Unauthenticated complaint filing rejected with 401
  try {
    const res = await request('/api/complaints', {
      method: 'POST',
      body: JSON.stringify({
        tokenNumber: 'TEST_ISO_TK_B_01',
        description: 'Anonymous dispute'
      })
    });
    assert.strictEqual(res.status, 401);
    pass('Unauthenticated complaint filing rejected with 401 Unauthorized');
  } catch (err) {
    fail('Unauthenticated complaint filing', err);
  }

  console.log('\n--- Section 3: Officer Centre Scoping & District Admin Isolation ---');
  // 3.1 Officer from Shirdi (SRD-02) attempts to decide round at Kopargaon (KPG-01)
  const roundKPG = await FastTrackRound.create({
    roundId: `FTR-${Date.now()}`,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: 'Today',
    slotHour: 10,
    status: 'START_REQUESTED',
    participants: [{
      farmerId: '64b8f0a1c1d2e3f4a5b6c082',
      phone: FARMER_B_PHONE,
      name: 'Farmer B',
      bookingId: tokenB._id.toString(),
      tokenNumber: tokenB.tokenNumber,
      joinedAt: new Date()
    }]
  });

  try {
    const res = await request(`/api/fasttrack/rounds/${roundKPG.roundId}/start-decision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOfficerSRD}` },
      body: JSON.stringify({ approved: true, centreId: 'KPG-01' })
    });
    assert.strictEqual(res.status, 403);
    pass('SRD Officer blocked (403) from start-decision on KPG round even if centreId=KPG-01 sent in body', res.data.message);
  } catch (err) {
    fail('SRD Officer cross-centre start-decision', err);
  }

  // 3.2 District Admin write refusal (403 Forbidden)
  try {
    const res = await request(`/api/fasttrack/rounds/${roundKPG.roundId}/start-decision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDistrictAdmin}` },
      body: JSON.stringify({ approved: true })
    });
    assert.strictEqual(res.status, 403);
    pass('District Admin write decision refused with 403 Forbidden (Read-only rule)', res.data.message);
  } catch (err) {
    fail('District Admin write decision refusal', err);
  }

  // 3.3 Authorized KPG Officer succeeds
  try {
    const res = await request(`/api/fasttrack/rounds/${roundKPG.roundId}/start-decision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOfficerKPG}` },
      body: JSON.stringify({ approved: true })
    });
    assert.strictEqual(res.status, 200);
    pass('KPG Officer successfully approves KPG round start decision (200 OK)');
  } catch (err) {
    fail('KPG Officer authorized start decision', err);
  }

  // Cleanup
  await Token.deleteMany({ tokenNumber: { $regex: /^TEST_ISO_/ } });
  await Waitlist.deleteMany({ farmerPhone: { $in: [FARMER_A_PHONE, FARMER_B_PHONE] } });
  await SlotOffer.deleteMany({ farmerPhone: { $in: [FARMER_A_PHONE, FARMER_B_PHONE] } });
  await FastTrackRound.deleteOne({ roundId: roundKPG.roundId });

  console.log('\n===========================================================================');
  console.log(`FINAL RESULT: ${passCount} PASSED | ${failCount} FAILED | 0 NOT CHECKED`);
  console.log('===========================================================================');

  await mongoose.disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
