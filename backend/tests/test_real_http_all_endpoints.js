const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { Token, Waitlist, SlotOffer, FastTrackRound, Complaint, Notification } = require('../src/models');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const TEST_PHONE = '9800000077';
const OFFICER_PHONE = '9800000008';

const farmerJwt = jwt.sign(
  { id: '64b8f0a1c1d2e3f4a5b6c077', phone: TEST_PHONE, name: 'Kisan Test Farmer', role: 'farmer' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

const supervisorJwt = jwt.sign(
  { id: '64b8f0a1c1d2e3f4a5b6c008', phone: OFFICER_PHONE, name: 'KPG Mandi Supervisor', role: 'supervisor', assignedMandi: 'KPG-01' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

const resourceOfficerJwt = jwt.sign(
  { id: '64b8f0a1c1d2e3f4a5b6c006', phone: '9800000010', name: 'RO Kulkarni', role: 'resource_officer', assignedMandi: 'KPG-01' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

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
          let jsonBody = null;
          try {
            jsonBody = JSON.parse(data);
          } catch {
            jsonBody = { raw: data };
          }
          resolve({ status: res.statusCode, body: jsonBody, raw: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function trimResponse(obj, maxLength = 120) {
  const str = JSON.stringify(obj);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

async function runVerification() {
  console.log('================================================================================');
  console.log('🌐 REAL HTTP RUN OF EVERY NEW UI ENDPOINT (WITH TEST_ FIXTURES)');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas for fixture management.\n');

  // Clean prior TEST fixtures
  await Token.deleteMany({ farmerPhone: TEST_PHONE });
  await Waitlist.deleteMany({ farmerPhone: TEST_PHONE });
  await SlotOffer.deleteMany({ farmerPhone: TEST_PHONE });
  await Complaint.deleteMany({ farmerPhone: TEST_PHONE });
  await Notification.deleteMany({ recipientId: TEST_PHONE });
  await FastTrackRound.deleteMany({ roundId: { $regex: /^TEST_FTR_/ } });

  // Seed baseline fixtures
  const seededToken = await Token.create({
    tokenNumber: 'TEST_KQ_KPG_7701',
    id: 'TEST_KQ_KPG_7701',
    farmerName: 'Kisan Test Farmer',
    farmerPhone: TEST_PHONE,
    phone: TEST_PHONE,
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Soybean',
    quantity: 30,
    slotDate: new Date().toISOString().split('T')[0],
    slotTime: '08:00 AM - 11:00 AM',
    status: 'GATE_IN',
    stages: [
      { stageIndex: 0, id: 'GATE_CHECKIN', status: 'In Progress' }
    ]
  });

  const seededNotification = await Notification.create({
    recipientId: TEST_PHONE,
    recipientType: 'farmer',
    centreId: 'KPG-01',
    event: 'slot_offer_available',
    title: 'New Slot Offer Available',
    body: 'A released arrival slot is available for claim.',
    channels: [{ channel: 'IN_APP', status: 'SENT' }],
    read: false,
    createdAt: new Date()
  });

  const seededWaitlist = await Waitlist.create({
    farmerName: 'Kisan Test Farmer',
    farmerPhone: TEST_PHONE,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Soybean',
    quantity: 30,
    requestedSlotDate: new Date().toISOString().split('T')[0],
    requestedSlotTime: '08:00 AM - 11:00 AM',
    status: 'WAITING'
  });

  const seededOffer = await SlotOffer.create({
    waitlistId: seededWaitlist._id,
    releasedTokenNumber: 'TEST_RELEASED_99',
    farmerPhone: TEST_PHONE,
    farmerName: 'Kisan Test Farmer',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Soybean',
    quantity: 30,
    slotDate: new Date().toISOString().split('T')[0],
    slotTime: '08:00 AM - 11:00 AM',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + 600000),
    status: 'PENDING'
  });

  const seededDeclineOffer = await SlotOffer.create({
    waitlistId: seededWaitlist._id,
    releasedTokenNumber: 'TEST_RELEASED_DEC_99',
    farmerPhone: TEST_PHONE,
    farmerName: 'Kisan Test Farmer',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Soybean',
    quantity: 30,
    slotDate: new Date().toISOString().split('T')[0],
    slotTime: '08:00 AM - 11:00 AM',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + 600000),
    status: 'PENDING'
  });

  const seededRound = await FastTrackRound.create({
    roundId: 'TEST_FTR_7701',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: 'Today',
    slotHour: 10,
    status: 'JOINING',
    participants: [],
    reserveFee: 200,
    bidStep: 10,
    bidCeiling: 500
  });

  const seededStartReqRound = await FastTrackRound.create({
    roundId: 'TEST_FTR_START_7702',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: 'Yesterday',
    slotHour: 11,
    status: 'START_REQUESTED',
    participants: [{
      farmerId: '64b8f0a1c1d2e3f4a5b6c077',
      phone: TEST_PHONE,
      name: 'Kisan Test Farmer',
      bookingId: seededToken._id.toString(),
      tokenNumber: seededToken.tokenNumber,
      joinedAt: new Date()
    }]
  });

  const seededAwaitingDecisionRound = await FastTrackRound.create({
    roundId: 'TEST_FTR_DEC_7703',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    slotDate: '2026-09-18',
    slotHour: 12,
    status: 'AWAITING_APPROVAL',
    participants: [{
      farmerId: '64b8f0a1c1d2e3f4a5b6c077',
      phone: TEST_PHONE,
      name: 'Kisan Test Farmer',
      bookingId: seededToken._id.toString(),
      tokenNumber: seededToken.tokenNumber,
      joinedAt: new Date()
    }],
    currentLeader: {
      farmerId: '64b8f0a1c1d2e3f4a5b6c077',
      phone: TEST_PHONE,
      name: 'Kisan Test Farmer',
      bookingId: seededToken._id.toString(),
      tokenNumber: seededToken.tokenNumber,
      amount: 250,
      bidTime: new Date()
    }
  });

  let passCount = 0;
  let failCount = 0;

  async function checkEndpoint({ id, method, url, body = null, token = null, validateUI }) {
    try {
      const res = await makeRequest(url, method, body, token);
      const isMatch = validateUI(res);
      const verdict = (res.status >= 200 && res.status < 300 && isMatch) ? 'MATCH' : 'MISMATCH / FAIL';

      if (verdict === 'MATCH') passCount++;
      else failCount++;

      console.log(`[${id}] ${method} ${url}`);
      console.log(`  Status:   HTTP ${res.status}`);
      console.log(`  Response: ${trimResponse(res.body)}`);
      console.log(`  Contract: ${verdict === 'MATCH' ? '✅ MATCH (UI fields verified)' : '❌ ' + verdict}\n`);
    } catch (err) {
      failCount++;
      console.error(`[${id}] ${method} ${url}`);
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  // 1. Notifications
  await checkEndpoint({
    id: 'E01: Notifications List',
    method: 'GET',
    url: '/api/notifications',
    token: farmerJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.notifications || res.body?.data)
  });

  await checkEndpoint({
    id: 'E02: Mark Notification Read',
    method: 'PATCH',
    url: `/api/notifications/${seededNotification._id}/read`,
    token: farmerJwt,
    validateUI: (res) => res.body?.success === true
  });

  await checkEndpoint({
    id: 'E03: Mark All Notifications Read',
    method: 'POST',
    url: '/api/notifications/read-all',
    token: farmerJwt,
    validateUI: (res) => res.body?.success === true
  });

  await checkEndpoint({
    id: 'E04: Resend SMS Notification',
    method: 'POST',
    url: `/api/notifications/resend-sms/${seededNotification._id}`,
    token: farmerJwt,
    validateUI: (res) => res.body?.success === true
  });

  // 2. Waitlist & Offers
  await checkEndpoint({
    id: 'E05: Join Waitlist',
    method: 'POST',
    url: '/api/waitlist/join',
    body: {
      centreId: 'KPG-01',
      crop: 'Soybean',
      quantity: 20,
      requestedSlotDate: new Date().toISOString().split('T')[0],
      requestedSlotTime: '08:00 AM - 11:00 AM'
    },
    token: farmerJwt,
    validateUI: (res) => res.body?.data?.status === 'WAITING'
  });

  await checkEndpoint({
    id: 'E06: Get Farmer Waitlist & Offers',
    method: 'GET',
    url: '/api/waitlist/my',
    token: farmerJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.waitlist) && Array.isArray(res.body?.data?.offers)
  });

  await checkEndpoint({
    id: 'E07: Staff List Released Offers',
    method: 'GET',
    url: '/api/waitlist/offers',
    token: supervisorJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.offers)
  });

  await checkEndpoint({
    id: 'E08: Accept Slot Offer',
    method: 'POST',
    url: `/api/waitlist/offers/${seededOffer._id}/accept`,
    token: farmerJwt,
    validateUI: (res) => res.body?.data?.token?.tokenNumber !== undefined
  });

  await checkEndpoint({
    id: 'E09: Decline Slot Offer',
    method: 'POST',
    url: `/api/waitlist/offers/${seededDeclineOffer._id}/decline`,
    token: farmerJwt,
    validateUI: (res) => res.body?.success === true
  });

  await checkEndpoint({
    id: 'E10: Trigger Reallocation Cycle',
    method: 'POST',
    url: '/api/waitlist/process-reallocations',
    body: {},
    token: supervisorJwt,
    validateUI: (res) => res.body?.success === true
  });

  // 3. Fast-Track Auctions
  await checkEndpoint({
    id: 'E11: Get Fast-Track Rounds',
    method: 'GET',
    url: '/api/fasttrack/rounds?centreId=KPG-01',
    token: farmerJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.rounds)
  });

  await checkEndpoint({
    id: 'E12: Join Fast-Track Round',
    method: 'POST',
    url: `/api/fasttrack/rounds/${seededRound.roundId}/join`,
    body: { tokenNumber: seededToken.tokenNumber },
    token: farmerJwt,
    validateUI: (res) => res.body?.data?.participants?.length > 0
  });

  await checkEndpoint({
    id: 'E13: Request Sub-Quorum Start',
    method: 'POST',
    url: `/api/fasttrack/rounds/${seededRound.roundId}/request-start`,
    token: farmerJwt,
    validateUI: (res) => res.body?.data?.status === 'START_REQUESTED'
  });

  await checkEndpoint({
    id: 'E14: Officer Start Decision',
    method: 'POST',
    url: `/api/fasttrack/rounds/${seededStartReqRound.roundId}/start-decision`,
    body: { approved: true, reason: 'Approved under quorum' },
    token: resourceOfficerJwt,
    validateUI: (res) => res.body?.data?.status === 'LIVE'
  });

  await checkEndpoint({
    id: 'E15: Place Atomic Bid on LIVE Round',
    method: 'POST',
    url: `/api/fasttrack/rounds/${seededStartReqRound.roundId}/bids`,
    body: { amount: 200 },
    token: farmerJwt,
    validateUI: (res) => res.body?.data?.round?.currentLeader?.amount === 200
  });

  await checkEndpoint({
    id: 'E16: Officer Winning Bid Decision',
    method: 'POST',
    url: `/api/fasttrack/rounds/${seededAwaitingDecisionRound.roundId}/decision`,
    body: { approved: true, reason: 'Verified produce and commitment' },
    token: resourceOfficerJwt,
    validateUI: (res) => res.body?.data?.round?.status === 'APPROVED'
  });

  // 4. Complaints & Grievances
  let filedComplaintId = null;
  await checkEndpoint({
    id: 'E17: Farmer Files Complaint',
    method: 'POST',
    url: '/api/complaints',
    body: {
      tokenNumber: seededToken.tokenNumber,
      checkpoint: 'QUALITY_GRADING',
      category: 'ASSAYING_DISPUTE',
      description: 'Assayer docked 2.5% moisture variance on certified dry lot'
    },
    token: farmerJwt,
    validateUI: (res) => {
      filedComplaintId = res.body?.data?.complaintId;
      return res.body?.data?.status === 'PENDING' && res.body?.data?.checkpoint === 'QUALITY_GRADING';
    }
  });

  await checkEndpoint({
    id: 'E18: Staff List Complaints',
    method: 'GET',
    url: '/api/complaints?centreId=KPG-01',
    token: supervisorJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.complaints)
  });

  await checkEndpoint({
    id: 'E19: Farmer Get My Complaints',
    method: 'GET',
    url: '/api/complaints/my',
    token: farmerJwt,
    validateUI: (res) => Array.isArray(res.body?.data?.complaints)
  });

  await checkEndpoint({
    id: 'E20: Supervisor Resolve Complaint',
    method: 'PATCH',
    url: `/api/complaints/${filedComplaintId}/resolve`,
    body: {
      status: 'RESOLVED',
      resolutionNotes: 'Dockage deduction re-calibrated. Grade certified standard.'
    },
    token: supervisorJwt,
    validateUI: (res) => res.body?.data?.status === 'RESOLVED'
  });

  // 5. Tokens / Farmer Command Center
  await checkEndpoint({
    id: 'E21: Farmer Tokens by Phone',
    method: 'GET',
    url: `/api/tokens/farmer/${TEST_PHONE}`,
    token: farmerJwt,
    validateUI: (res) => Array.isArray(res.body?.tokens || res.body?.data?.tokens || res.body?.data)
  });

  // Cleanup TEST fixtures
  await Token.deleteMany({ farmerPhone: TEST_PHONE });
  await Waitlist.deleteMany({ farmerPhone: TEST_PHONE });
  await SlotOffer.deleteMany({ farmerPhone: TEST_PHONE });
  await Complaint.deleteMany({ farmerPhone: TEST_PHONE });
  await Notification.deleteMany({ recipientId: TEST_PHONE });
  await FastTrackRound.deleteMany({ roundId: { $regex: /^TEST_FTR_/ } });

  console.log('================================================================================');
  console.log(`REAL HTTP RUN SUMMARY: ${passCount} MATCHED | ${failCount} FAILED`);
  console.log('================================================================================');

  await mongoose.disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
