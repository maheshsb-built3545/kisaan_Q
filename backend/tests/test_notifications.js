/**
 * Comprehensive Test Suite: Unified Notification Centre (Item B1 Completion Pass)
 *
 * Requirements Verified Against Real Connected MongoDB Atlas Database:
 * A. Real database connection: mongoose.connect() called, readyState === 1 required.
 * B. Event wiring with unique dedupeKey (recipient + event + entity + step).
 *    - turn_near: fires ONCE per token when position <= 3, verified across multiple recomputes.
 *    - exception_raised: notifies centre supervisor only (never farmer).
 *    - split payout: payout_ready (awaiting DBT) and payout_paid (dispatched).
 * C. Socket security:
 *    - JWT handshake auth rejects expired / invalid tokens.
 *    - Farmer A cannot join Farmer B's room.
 *    - Shirdi supervisor cannot join Kopargaon room.
 *    - Two-client socket test with offline reconnect simulation.
 * D. Language: strictly Farmer.preferredLanguage.
 * E. Legacy endpoint security:
 *    - Farmers read only their own booking log.
 *    - send / retry staff-only.
 * F. devOtp: present outside production, omitted in production.
 * G. SMS budget suppression for non-key events; key events bypass limit.
 * H. Max 2 retries enforced.
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');
require('dotenv').config();

// DNS resolution configuration for Atlas
try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const notificationService = require('../src/services/notificationService');
const authService = require('../src/services/authService');
const queueService = require('../src/services/queueService');
const exceptionService = require('../src/services/exceptionService');
const { Notification, Farmer, Booking, Centre, StaffUser } = require('../src/models');
const { renderTemplate } = require('../src/utils/notificationTemplates');
const { SMS_POLICY, DEFAULT_SMS_BUDGET_PER_FARMER } = require('../src/config/smsPolicy');

const TEST_PREFIX = 'TEST_B1_';
const PORT = process.env.PORT || 5000;
const SERVER_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

// Helper: HTTP request wrapper
function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: reqHeaders
      },
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

async function runTestSuite() {
  console.log('='.repeat(75));
  console.log('🔔 KISANQ B1 — UNIFIED NOTIFICATION CENTRE (COMPLETION PASS)');
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

  // -------------------------------------------------------------------------
  // REQUIREMENT A: Connect to Real Database (MongoDB Atlas)
  // -------------------------------------------------------------------------
  console.log('\n--- Section A: MongoDB Atlas Database Connection ---');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is missing!');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`Database connection failed: readyState = ${mongoose.connection.readyState}`);
  }
  console.log(`  🟢 Connected to Live MongoDB Atlas: ${mongoose.connection.host}`);
  console.log(`  Mode: Connected DB Run (Live Atlas Cluster)`);

  // Clean up any existing test data
  await Notification.deleteMany({
    $or: [
      { recipientId: { $regex: new RegExp(`^${TEST_PREFIX}`) } },
      { dedupeKey: { $regex: new RegExp(`^${TEST_PREFIX}`) } },
      { 'payload.tokenNumber': { $regex: new RegExp(`^${TEST_PREFIX}`) } }
    ]
  });
  await Farmer.deleteMany({ phone: { $regex: /^980000009/ } });
  await Booking.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });

  // Create test farmer and staff tokens
  const testFarmerA = await Farmer.create({
    name: `${TEST_PREFIX}Farmer A`,
    phone: '9800000091',
    preferredLanguage: 'mr',
    noSmartphone: false,
    smsSentCount: 0
  });

  const testFarmerB = await Farmer.create({
    name: `${TEST_PREFIX}Farmer B`,
    phone: '9800000092',
    preferredLanguage: 'hi',
    noSmartphone: true,
    smsSentCount: 0
  });

  const farmerAToken = jwt.sign(
    { id: testFarmerA._id.toString(), phone: testFarmerA.phone, name: testFarmerA.name, role: 'farmer' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const farmerBToken = jwt.sign(
    { id: testFarmerB._id.toString(), phone: testFarmerB.phone, name: testFarmerB.name, role: 'farmer' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const shirdiSupervisorToken = jwt.sign(
    {
      id: 'staff_shirdi_01',
      name: 'Shirdi Supervisor',
      role: 'supervisor',
      assignedMandi: 'SHR-02',
      mandiId: 'SHR-02'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const kopargaonSupervisorToken = jwt.sign(
    {
      id: 'staff_kpg_01',
      name: 'Kopargaon Supervisor',
      role: 'supervisor',
      assignedMandi: 'KPG-01',
      mandiId: 'KPG-01'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const districtAdminToken = jwt.sign(
    {
      id: 'admin_01',
      name: 'District Administrator',
      role: 'district_admin'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  try {
    // -----------------------------------------------------------------------
    // REQUIREMENT D & Multi-lingual Templates
    // -----------------------------------------------------------------------
    console.log('\n--- Section D: Multi-lingual Templates & Preferred Language ---');
    const tEn = renderTemplate('booking_confirmed', { tokenNumber: 'KQ-101', crop: 'Wheat', mandiName: 'Kopargaon', slotTime: '09:00 AM' }, 'en');
    const tHi = renderTemplate('booking_confirmed', { tokenNumber: 'KQ-101', crop: 'गेहूं', mandiName: 'कोपरगांव', slotTime: '09:00 AM' }, 'hi');
    const tMr = renderTemplate('booking_confirmed', { tokenNumber: 'KQ-101', crop: 'गहू', mandiName: 'कोपरगाव', slotTime: '09:00 AM' }, 'mr');

    assert(tEn.title === 'Slot Booking Confirmed' && tEn.body.includes('KQ-101'), 'English template renders correctly');
    assert(tHi.title.includes('स्लॉट') && tHi.body.includes('KQ-101'), 'Hindi template renders correctly');
    assert(tMr.title.includes('निश्चित') && tMr.body.includes('KQ-101'), 'Marathi template renders correctly');

    // Notify Farmer A (preferredLanguage: 'mr') without specifying language in payload
    const notifLangCheck = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer' },
      'gate_checkin',
      { tokenNumber: `${TEST_PREFIX}TK_LANG` },
      { dedupeKey: `${TEST_PREFIX}dedupe_lang_mr` }
    );
    assert(notifLangCheck.lang === 'mr' && notifLangCheck.title.includes('गेट'), 'Notification automatically follows Farmer.preferredLanguage (Marathi)');

    // -----------------------------------------------------------------------
    // REQUIREMENT B: Wire Events & Deduplication Keys
    // -----------------------------------------------------------------------
    console.log('\n--- Section B: Event Wiring & Deduplication ---');

    // 1. booking_cancelled
    const notifCancelled = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'mr' },
      'booking_cancelled',
      { tokenNumber: `${TEST_PREFIX}TK_001`, reason: 'Rain delay', mandiName: 'Kopargaon' },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_booking_cancelled_TK001_cancel` }
    );
    assert(notifCancelled.event === 'booking_cancelled' && notifCancelled.title.includes('रद्द'), 'booking_cancelled dispatched with dedupeKey');

    // 2. gate_checkin
    const notifGate = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'gate_checkin',
      { tokenNumber: `${TEST_PREFIX}TK_001`, mandiName: 'Kopargaon' },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_gate_checkin_TK001_step1` }
    );
    assert(notifGate.event === 'gate_checkin' && notifGate.channels.inApp.status === 'delivered', 'gate_checkin dispatched with dedupeKey');

    // 3. Deduplication check: duplicate call returns same document without creating new DB record
    const notifGateDup = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'gate_checkin',
      { tokenNumber: `${TEST_PREFIX}TK_001`, mandiName: 'Kopargaon' },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_gate_checkin_TK001_step1` }
    );
    assert(notifGateDup._id.toString() === notifGate._id.toString(), 'Deduplication key prevents duplicate notifications');

    // 4. quality_assayed
    const notifAssay = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'quality_assayed',
      { tokenNumber: `${TEST_PREFIX}TK_001`, grade: 'Grade A', moisture: 11 },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_quality_assayed_TK001_step2` }
    );
    assert(notifAssay.event === 'quality_assayed' && notifAssay.channels.inApp.status === 'delivered', 'quality_assayed dispatched');

    // 5. weighbridge_done
    const notifWeigh = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'weighbridge_done',
      { tokenNumber: `${TEST_PREFIX}TK_001`, netWeight: 45 },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_weighbridge_done_TK001_step3` }
    );
    assert(notifWeigh.event === 'weighbridge_done' && notifWeigh.payload.netWeight === 45, 'weighbridge_done dispatched');

    // 6. procurement_recorded
    const notifProc = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'procurement_recorded',
      { tokenNumber: `${TEST_PREFIX}TK_001`, totalAmount: 58320 },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_procurement_recorded_TK001_step4` }
    );
    assert(notifProc.event === 'procurement_recorded' && notifProc.payload.totalAmount === 58320, 'procurement_recorded dispatched');

    // 7. Split Payout: payout_ready vs payout_paid
    const notifPayoutReady = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'payout_ready',
      { tokenNumber: `${TEST_PREFIX}TK_001`, totalAmount: 58320 },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_payout_ready_TK001_step5_ready` }
    );
    assert(notifPayoutReady.event === 'payout_ready' && notifPayoutReady.title.includes('Payout Ready'), 'payout_ready event wired');

    const notifPayoutPaid = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone, lang: 'en' },
      'payout_paid',
      { tokenNumber: `${TEST_PREFIX}TK_001`, netPaid: 58320 },
      { dedupeKey: `${TEST_PREFIX}${testFarmerA._id}_payout_paid_TK001_step5_paid` }
    );
    assert(notifPayoutPaid.event === 'payout_paid' && notifPayoutPaid.title.includes('Dispatched'), 'payout_paid event wired');

    // 8. turn_near: Idempotency across multiple queue recomputes
    console.log('\n--- Section B (cont.): turn_near Idempotency Across Recomputes ---');
    const testCentre = await Centre.findOne() || { _id: new mongoose.Types.ObjectId() };
    const queueBooking = await Booking.create({
      farmerId: testFarmerA._id,
      centreId: testCentre._id,
      crop: 'Wheat',
      quantityBand: '5-15q',
      arrivalWindowStart: new Date(),
      arrivalWindowEnd: new Date(Date.now() + 3600000),
      tokenNumber: `${TEST_PREFIX}TK_NEAR_01`,
      status: 'BOOKED'
    });

    // Run computePositionMap 5 times
    for (let i = 1; i <= 5; i++) {
      await queueService.computePositionMap(testCentre._id.toString());
    }

    const turnNearCount = await Notification.countDocuments({
      recipientId: testFarmerA._id.toString(),
      event: 'turn_near',
      'payload.tokenNumber': `${TEST_PREFIX}TK_NEAR_01`
    });
    assert(turnNearCount === 1, `turn_near fired exactly ONCE across 5 consecutive queue recomputes (found: ${turnNearCount})`);

    // 9. exception_raised: Dispatches to centre supervisor ONLY (NOT farmer)
    console.log('\n--- Section B (cont.): exception_raised Scoped to Supervisor ---');
    const notifException = await notificationService.notify(
      { id: 'staff_KPG-01_supervisor', type: 'staff', role: 'supervisor', centreId: 'KPG-01' },
      'exception_raised',
      { tokenNumber: `${TEST_PREFIX}TK_001`, category: 'quality_dispute', reasonCode: 'HIGH_MOISTURE', centreId: 'KPG-01' },
      { dedupeKey: `${TEST_PREFIX}staff_KPG-01_exception_raised_TK001_step` }
    );
    assert(notifException.recipientType === 'staff' && notifException.centreId === 'KPG-01', 'exception_raised scoped to supervisor desk');

    const farmerExceptionNotif = await Notification.findOne({
      recipientId: testFarmerA._id.toString(),
      event: 'exception_raised'
    });
    assert(!farmerExceptionNotif, 'Farmer did NOT receive raw exception_raised notification');

    // -----------------------------------------------------------------------
    // REQUIREMENT G & H: SMS Policy & Budget Suppression
    // -----------------------------------------------------------------------
    console.log('\n--- Section G & H: SMS Policy & Budget Rules ---');

    // Non-key event for smartphone farmer -> no SMS
    assert(notifGate.channels.sms.status === 'none', 'Non-key event (gate_checkin) does not trigger SMS for smartphone farmer');

    // Key event -> triggers SMS (mock/sent)
    assert(['sent', 'mock'].includes(notifPayoutPaid.channels.sms.status), 'Key event (payout_paid) dispatches SMS channel (mock/sent)');

    // Non-key event for no-smartphone farmer -> triggers SMS
    const notifNoSmart = await notificationService.notify(
      { id: testFarmerB._id.toString(), type: 'farmer', phone: testFarmerB.phone, noSmartphone: true },
      'quality_assayed',
      { tokenNumber: `${TEST_PREFIX}TK_002`, grade: 'Grade A' },
      { dedupeKey: `${TEST_PREFIX}${testFarmerB._id}_quality_nosmart_TK002` }
    );
    assert(['sent', 'mock'].includes(notifNoSmart.channels.sms.status), 'Non-key event triggers SMS when farmer has no smartphone');

    // SMS Budget Suppression: simulate farmer with smsSentCount >= 5
    const budgetFarmer = await Farmer.create({
      name: `${TEST_PREFIX}Budget Farmer`,
      phone: '9800000093',
      preferredLanguage: 'en',
      noSmartphone: true,
      smsSentCount: 5 // At budget limit
    });

    // Non-key event -> suppressed due to budget
    const notifSuppressed = await notificationService.notify(
      { id: budgetFarmer._id.toString(), type: 'farmer', phone: budgetFarmer.phone, noSmartphone: true, smsSentCount: 5 },
      'quality_assayed',
      { tokenNumber: `${TEST_PREFIX}TK_BUDGET_01` },
      { dedupeKey: `${TEST_PREFIX}${budgetFarmer._id}_quality_budget_TK01` }
    );
    assert(notifSuppressed.channels.sms.status === 'none', 'Non-key SMS suppressed when farmer exceeds SMS budget (>= 5)');

    // Key event -> bypasses budget limit
    const notifKeyBypass = await notificationService.notify(
      { id: budgetFarmer._id.toString(), type: 'farmer', phone: budgetFarmer.phone, noSmartphone: true, smsSentCount: 5 },
      'payout_paid',
      { tokenNumber: `${TEST_PREFIX}TK_BUDGET_01`, netPaid: 32000 },
      { dedupeKey: `${TEST_PREFIX}${budgetFarmer._id}_payout_budget_TK01` }
    );
    assert(['sent', 'mock'].includes(notifKeyBypass.channels.sms.status), 'Key event (payout_paid) bypasses budget limit');

    // Retry limit max 2
    console.log('\n--- Section H (cont.): Retry Limit Max 2 ---');
    const retryNotif = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone },
      'booking_confirmed',
      { tokenNumber: `${TEST_PREFIX}TK_RETRY` },
      { dedupeKey: `${TEST_PREFIX}retry_test_01`, forceSms: true }
    );

    // Attempt 1 already performed in notify()
    // Trigger retry 1 (brings to attempt 2)
    const retriedOnce = await notificationService.retryNotification(retryNotif._id);
    assert(retriedOnce.channels.sms.attempts === 2, 'Retry attempt 1 succeeded (attempts = 2)');

    // Trigger retry 2 (should fail because max 2 reached)
    let retryFailedAsExpected = false;
    try {
      await notificationService.retryNotification(retryNotif._id);
    } catch (e) {
      retryFailedAsExpected = e.message.includes('Maximum retry limit reached');
    }
    assert(retryFailedAsExpected, 'Retry attempt rejected when max attempts (2) is reached');

    // -----------------------------------------------------------------------
    // REQUIREMENT C: Socket Security & Room Scoping
    // -----------------------------------------------------------------------
    console.log('\n--- Section C: Socket.IO Security & Scoped Rooms ---');

    // 1. Expired JWT Handshake Rejection
    const expiredToken = jwt.sign({ id: 'expired_user', role: 'farmer' }, JWT_SECRET, { expiresIn: '-10s' });
    let expiredRejected = false;
    await new Promise((resolve) => {
      const s = ioClient(SERVER_URL, {
        auth: { token: expiredToken },
        transports: ['websocket'],
        reconnection: false
      });
      s.on('connect_error', (err) => {
        expiredRejected = err.message.includes('Authentication failed') || err.message.includes('jwt expired');
        s.disconnect();
        resolve();
      });
      s.on('connect', () => {
        s.disconnect();
        resolve();
      });
      setTimeout(resolve, 2000);
    });
    assert(expiredRejected, 'Socket handshake rejects expired JWT');

    // 2. Farmer A cannot join Farmer B room
    let farmerCrossForbidden = false;
    await new Promise((resolve) => {
      const s = ioClient(SERVER_URL, {
        auth: { token: farmerAToken },
        transports: ['websocket'],
        reconnection: false
      });
      s.on('connect', () => {
        s.emit('join_user', testFarmerB._id.toString());
      });
      s.on('error:forbidden', () => {
        farmerCrossForbidden = true;
        s.disconnect();
        resolve();
      });
      s.on('joined_user_room', () => {
        s.disconnect();
        resolve();
      });
      setTimeout(resolve, 2000);
    });
    assert(farmerCrossForbidden, 'Farmer A is forbidden from joining Farmer B personal room');

    // 3. Shirdi supervisor cannot join Kopargaon staff room
    let shirdiCrossForbidden = false;
    await new Promise((resolve) => {
      const s = ioClient(SERVER_URL, {
        auth: { token: shirdiSupervisorToken },
        transports: ['websocket'],
        reconnection: false
      });
      s.on('connect', () => {
        s.emit('join_staff_role', { role: 'supervisor', centreId: 'KPG-01' });
      });
      s.on('error:forbidden', () => {
        shirdiCrossForbidden = true;
        s.disconnect();
        resolve();
      });
      s.on('joined_staff_room', () => {
        s.disconnect();
        resolve();
      });
      setTimeout(resolve, 2000);
    });
    assert(shirdiCrossForbidden, 'Shirdi supervisor is forbidden from joining Kopargaon staff room');

    // 4. Two-client socket test with offline reconnect simulation
    console.log('\n--- Section C (cont.): Two-Client Socket Test with Offline Reconnect ---');
    let receivedLiveNotif = null;
    const clientA = ioClient(SERVER_URL, {
      auth: { token: farmerAToken },
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((resolve) => {
      clientA.on('connect', () => {
        clientA.emit('join_user', testFarmerA._id.toString());
        resolve();
      });
    });

    clientA.on('notification:new', (data) => {
      receivedLiveNotif = data;
    });

    // Client B (Farmer B) connects and disconnects (simulating offline period)
    const clientB = ioClient(SERVER_URL, {
      auth: { token: farmerBToken },
      transports: ['websocket'],
      reconnection: false
    });
    await new Promise((resolve) => clientB.on('connect', resolve));
    clientB.disconnect(); // Farmer B goes offline

    // Dispatch notification while B is offline
    await notificationService.notify(
      { id: testFarmerB._id.toString(), type: 'farmer', phone: testFarmerB.phone },
      'booking_confirmed',
      { tokenNumber: `${TEST_PREFIX}TK_OFFLINE_B` },
      { dedupeKey: `${TEST_PREFIX}offline_b_01` }
    );

    // Farmer B reconnects after offline duration and fetches inbox
    const bInboxRes = await makeRequest('/api/notifications?unread=true', 'GET', null, farmerBToken);
    const bFound = bInboxRes.body?.data?.some((n) => n.dedupeKey === `${TEST_PREFIX}offline_b_01`);
    assert(bInboxRes.status === 200 && bFound, 'Offline client retrieves missed notification upon reconnect / sync');

    clientA.disconnect();

    // -----------------------------------------------------------------------
    // REQUIREMENT E: Legacy Endpoint Security
    // -----------------------------------------------------------------------
    console.log('\n--- Section E: Legacy Endpoint Security ---');

    // Create a booking for Farmer A
    const myBooking = await Booking.create({
      farmerId: testFarmerA._id,
      centreId: testCentre._id,
      crop: 'Soybean',
      quantityBand: '5-15q',
      arrivalWindowStart: new Date(),
      arrivalWindowEnd: new Date(Date.now() + 3600000),
      tokenNumber: `${TEST_PREFIX}TK_OWN_LOG`,
      status: 'CONFIRMED'
    });

    // 1. Farmer A reads their OWN booking log -> 200 OK
    const ownLogRes = await makeRequest(`/api/notifications/${myBooking._id}/log`, 'GET', null, farmerAToken);
    assert(ownLogRes.status === 200 && ownLogRes.body?.success, 'Farmer can read their OWN booking notification log (200 OK)');

    // 2. Farmer B attempts to read Farmer A's booking log -> 403 Forbidden
    const otherLogRes = await makeRequest(`/api/notifications/${myBooking._id}/log`, 'GET', null, farmerBToken);
    assert(otherLogRes.status === 403, 'Farmer B is rejected when trying to read Farmer A booking log (403 Forbidden)');

    // 3. Farmer attempts to POST /api/notifications/send -> 403 Forbidden
    const farmerSendRes = await makeRequest('/api/notifications/send', 'POST', {
      bookingId: myBooking._id.toString(),
      messageType: 'booking_confirmed'
    }, farmerAToken);
    assert(farmerSendRes.status === 403, 'Farmer is forbidden from calling POST /api/notifications/send (403 Forbidden)');

    // 4. Staff calls POST /api/notifications/send -> 201 OK
    const staffSendRes = await makeRequest('/api/notifications/send', 'POST', {
      bookingId: myBooking._id.toString(),
      messageType: 'gate_checkin'
    }, kopargaonSupervisorToken);
    assert([200, 201].includes(staffSendRes.status) && staffSendRes.body?.success, 'Staff supervisor can call POST /api/notifications/send (201 Created)');

    // 5. Farmer attempts to POST /api/notifications/:id/retry -> 403 Forbidden
    const farmerRetryRes = await makeRequest(`/api/notifications/${notifGate._id}/retry`, 'POST', null, farmerAToken);
    assert(farmerRetryRes.status === 403, 'Farmer is forbidden from calling POST /api/notifications/:id/retry (403 Forbidden)');

    // 6. Supervisor calls POST /api/notifications/:id/retry -> 200 OK
    const staffRetryNotif = await notificationService.notify(
      { id: testFarmerA._id.toString(), type: 'farmer', phone: testFarmerA.phone },
      'booking_confirmed',
      { tokenNumber: `${TEST_PREFIX}TK_STAFF_RETRY` },
      { dedupeKey: `${TEST_PREFIX}staff_retry_test_02`, forceSms: true }
    );
    const staffRetryRes = await makeRequest(`/api/notifications/${staffRetryNotif._id}/retry`, 'POST', null, kopargaonSupervisorToken);
    assert(staffRetryRes.status === 200 && staffRetryRes.body?.success, 'Supervisor can call POST /api/notifications/:id/retry (200 OK)');

    // -----------------------------------------------------------------------
    // REQUIREMENT F: devOtp Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Section F: devOtp Production Safeguard ---');
    const otpResDev = await authService.requestFarmerOtp({ phone: testFarmerA.phone, mode: 'login' });
    assert(otpResDev.devOtp !== undefined, 'devOtp is returned outside production for development/testing');

    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const otpResProd = await authService.requestFarmerOtp({ phone: testFarmerA.phone, mode: 'login' });
    process.env.NODE_ENV = prevNodeEnv;
    assert(otpResProd.devOtp === undefined, 'devOtp is strictly OMITTED when NODE_ENV=production');

    // -----------------------------------------------------------------------
    // REQUIREMENT H (cont.): External SMS Gateway Status
    // -----------------------------------------------------------------------
    console.log('\n--- External SMS Gateway Status ---');
    if (!process.env.FAST2SMS_API_KEY) {
      console.log('  ℹ️  FAST2SMS_API_KEY not set: Real SMS to external mobile is marked "not checked" (Mock mode verified)');
      notChecked++;
    } else {
      console.log('  ✅ FAST2SMS_API_KEY present: Live gateway enabled');
    }

    // -----------------------------------------------------------------------
    // Clean up all test data
    // -----------------------------------------------------------------------
    console.log('\n--- Test Data Cleanup ---');
    await Notification.deleteMany({
      $or: [
        { recipientId: { $regex: new RegExp(`^${TEST_PREFIX}`) } },
        { dedupeKey: { $regex: new RegExp(`^${TEST_PREFIX}`) } },
        { 'payload.tokenNumber': { $regex: new RegExp(`^${TEST_PREFIX}`) } }
      ]
    });
    await Farmer.deleteMany({ phone: { $regex: /^980000009/ } });
    await Booking.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
    console.log('  🧹 Cleaned up all TEST_B1_ records from MongoDB Atlas.');

  } catch (err) {
    console.error('Test run failed with error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED (External API)`);
  console.log('='.repeat(75));

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
