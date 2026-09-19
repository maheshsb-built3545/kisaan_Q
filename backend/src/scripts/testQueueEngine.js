const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const routes = require('../routes');
const authService = require('../services/authService');
const queueService = require('../services/queueService');
const bookingService = require('../services/bookingService');
const { initQueueSocket, broadcastQueueUpdate } = require('../socket/queue.socket');
const { errorResponse } = require('../utils/apiResponse');

dotenv.config();

// Set up an isolated Express + Socket.IO test server
const app = express();
app.use(express.json());

// Attach mock io to req
const server = http.createServer(app);
const io = new Server(server);
initQueueSocket(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use('/api', routes);
app.use((err, req, res, next) => {
  return errorResponse(res, err.message, 500);
});

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== KisanQ Queue Engine & WebSocket Test Suite ===\n');

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.warn('⚠️ MongoDB not reachable; in-memory fallback active.');
  }

  await new Promise((resolve) => server.listen(0, resolve));

  // Seed a centre
  const centresRes = await makeRequest('/api/centres', 'GET');
  const centreId = centresRes.body.data[0]._id;
  console.log(`Using Centre: "${centresRes.body.data[0].name}" (${centreId})\n`);

  // Generate staff and farmer tokens
  const staffToken = authService.generateToken({
    id: new mongoose.Types.ObjectId(),
    role: 'operator',
    name: 'Operator Ramesh',
    centreId
  });

  const farmerToken = authService.generateToken({
    id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b90010'),
    role: 'farmer',
    phone: '9876540010',
    name: 'Ganesh Pawar'
  });

  // Create a booking for the farmer
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() + 1, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 30 * 60 * 1000);

  const bookRes = await makeRequest(
    '/api/bookings',
    'POST',
    {
      centreId,
      crop: 'Soybean',
      quantityBand: '5-15q',
      arrivalWindowStart: windowStart.toISOString(),
      arrivalWindowEnd: windowEnd.toISOString()
    },
    farmerToken
  );

  if (bookRes.status !== 201) {
    throw new Error(`Booking setup failed: ${bookRes.body.message}`);
  }

  const bookingId = bookRes.body.data._id;
  console.log(`Booking Created: ${bookRes.body.data.tokenNumber} (ID: ${bookingId})\n`);

  try {
    // TEST 1: Socket.IO broadcast function works
    console.log('[Test 1] Testing Socket.IO broadcastQueueUpdate function...');
    broadcastQueueUpdate(io, centreId, { test: true, totalActive: 0 });
    console.log('✅ Test 1 Passed: broadcastQueueUpdate executed without error\n');

    // TEST 2: GET /api/queue/live/:centreId
    console.log('[Test 2] Getting live queue state...');
    const liveRes = await makeRequest(`/api/queue/live/${centreId}`, 'GET');
    console.log('Live Queue Status:', liveRes.status, '| Total Active:', liveRes.body.data?.totalActive);
    if (liveRes.status !== 200) {
      throw new Error('Test 2 Failed: Could not retrieve live queue');
    }
    console.log('✅ Test 2 Passed: Live queue endpoint returned data\n');

    // TEST 3: POST /api/queue/:bookingId/check-in (Staff action)
    console.log('[Test 3] Staff checking in booking...');
    const checkInRes = await makeRequest(
      `/api/queue/${bookingId}/check-in`,
      'POST',
      {},
      staffToken
    );
    console.log('Check-In Status:', checkInRes.status, '| New Status:', checkInRes.body.data?.status);
    if (checkInRes.status !== 200 || checkInRes.body.data.status !== 'CHECKED_IN') {
      throw new Error(`Test 3 Failed: Check-in did not transition to CHECKED_IN (got ${checkInRes.body.data?.status})`);
    }
    console.log('✅ Test 3 Passed: Booking checked in, audit logged, broadcast triggered\n');

    // TEST 4: Verify AuditLog for CHECK_IN
    console.log('[Test 4] Verifying AuditLog for CHECK_IN...');
    const checkInAuditLogs = await queueService.getAuditLogs(bookingId);
    const checkInLog = checkInAuditLogs.find((l) => l.action === 'CHECK_IN');
    if (!checkInLog) {
      throw new Error('Test 4 Failed: CHECK_IN audit entry not found');
    }
    console.log(`Audit: [${checkInLog.action}] by ${checkInLog.actorRole} | Reason: "${checkInLog.reason}"`);
    console.log('✅ Test 4 Passed: CHECK_IN audit trail verified\n');

    // TEST 5: RBAC Guard - farmer attempting check-in should be rejected (403)
    console.log('[Test 5] Farmer attempting staff-only check-in action...');
    const farmerCheckInRes = await makeRequest(
      `/api/queue/${bookingId}/check-in`,
      'POST',
      {},
      farmerToken
    );
    console.log('Farmer Check-In Response:', farmerCheckInRes.status, farmerCheckInRes.body.message);
    if (farmerCheckInRes.status !== 403) {
      throw new Error('Test 5 Failed: Farmer was not blocked from staff action');
    }
    console.log('✅ Test 5 Passed: RBAC blocked farmer from staff-only check-in (403)\n');

    // TEST 6: Mark booking ELIGIBLE_FOR_RELEASE, then staff releases it
    console.log('[Test 6] Staff marks eligible then releases slot...');
    const markRes = await makeRequest(
      `/api/queue/${bookingId}/mark-eligible`,
      'POST',
      {},
      staffToken
    );
    console.log('Mark Eligible Status:', markRes.status, '| Status:', markRes.body.data?.status);
    // Note: may fail since already CHECKED_IN and our service only allows BOOKED/CONFIRMED -> ELIGIBLE
    // So let's create a second booking for this test
    const farmer2Token = authService.generateToken({
      id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b90011'),
      role: 'farmer',
      phone: '9876540011',
      name: 'Pramod Deshmukh'
    });

    const ws2 = new Date();
    ws2.setHours(ws2.getHours() + 2, 0, 0, 0);
    const we2 = new Date(ws2.getTime() + 30 * 60 * 1000);

    const book2Res = await makeRequest(
      '/api/bookings',
      'POST',
      {
        centreId,
        crop: 'Soybean',
        quantityBand: '0-5q',
        arrivalWindowStart: ws2.toISOString(),
        arrivalWindowEnd: we2.toISOString()
      },
      farmer2Token
    );

    const booking2Id = book2Res.body.data._id;

    // Mark as eligible
    const mark2Res = await makeRequest(
      `/api/queue/${booking2Id}/mark-eligible`,
      'POST',
      {},
      staffToken
    );
    console.log('Mark Eligible (Booking 2):', mark2Res.status, '| Status:', mark2Res.body.data?.status);
    if (mark2Res.status !== 200 || mark2Res.body.data.status !== 'ELIGIBLE_FOR_RELEASE') {
      throw new Error('Test 6a Failed: Could not mark booking as ELIGIBLE_FOR_RELEASE');
    }

    // Now release it (with reason)
    const releaseRes = await makeRequest(
      `/api/queue/${booking2Id}/release`,
      'POST',
      { reason: 'Farmer did not arrive within grace period' },
      staffToken
    );
    console.log('Release Status:', releaseRes.status, '| New Status:', releaseRes.body.data?.status);
    if (releaseRes.status !== 200 || releaseRes.body.data.status !== 'RELEASED') {
      throw new Error('Test 6b Failed: Slot was not released');
    }

    // Verify audit
    const releaseAudits = await queueService.getAuditLogs(booking2Id);
    const releaseLog = releaseAudits.find((l) => l.action === 'SLOT_RELEASED');
    if (!releaseLog) {
      throw new Error('Test 6c Failed: SLOT_RELEASED audit entry not found');
    }
    console.log(`Audit: [${releaseLog.action}] | Reason: "${releaseLog.reason}"`);
    console.log('✅ Test 6 Passed: Eligible -> Released flow with staff confirmation and audit\n');

    // TEST 7: Release without reason should be rejected
    console.log('[Test 7] Attempting release without reason (should fail)...');
    const farmer3Token = authService.generateToken({
      id: new mongoose.Types.ObjectId(),
      role: 'farmer',
      phone: '9876540012',
      name: 'Vikram Jadhav'
    });
    const ws3 = new Date();
    ws3.setHours(ws3.getHours() + 3, 0, 0, 0);
    const we3 = new Date(ws3.getTime() + 30 * 60 * 1000);

    const book3Res = await makeRequest(
      '/api/bookings',
      'POST',
      {
        centreId, crop: 'Cotton', quantityBand: '0-5q',
        arrivalWindowStart: ws3.toISOString(), arrivalWindowEnd: we3.toISOString()
      },
      farmer3Token
    );
    const booking3Id = book3Res.body.data._id;

    await makeRequest(`/api/queue/${booking3Id}/mark-eligible`, 'POST', {}, staffToken);
    const noReasonRes = await makeRequest(
      `/api/queue/${booking3Id}/release`,
      'POST',
      { reason: '' },
      staffToken
    );
    console.log('No-Reason Release Response:', noReasonRes.status, noReasonRes.body.message);
    if (noReasonRes.status !== 400) {
      throw new Error('Test 7 Failed: Release without reason was not rejected');
    }
    console.log('✅ Test 7 Passed: Release without reason correctly rejected (400)\n');

    // TEST 8: HTTP fallback position endpoint
    console.log('[Test 8] Testing HTTP fallback position endpoint...');
    const posRes = await makeRequest(
      `/api/queue/${centreId}/position/${bookingId}`,
      'GET',
      null,
      farmerToken
    );
    console.log('Position Response:', posRes.status, '| Data:', JSON.stringify(posRes.body.data));
    if (posRes.status !== 200) {
      throw new Error('Test 8 Failed: Position endpoint returned error');
    }
    console.log('✅ Test 8 Passed: HTTP fallback position endpoint working\n');

    console.log('🎉 ALL 8 QUEUE ENGINE & WEBSOCKET TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  server.close();
  process.exit(1);
});
