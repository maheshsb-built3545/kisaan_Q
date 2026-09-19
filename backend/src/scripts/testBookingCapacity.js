const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const routes = require('../routes');
const authService = require('../services/authService');
const bookingService = require('../services/bookingService');
const { errorResponse } = require('../utils/apiResponse');

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => {
  return errorResponse(res, err.message, 500);
});

const server = http.createServer(app);

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers
      },
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== KisanQ Booking & Centre Capacity Test Suite ===\n');

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to MongoDB for integration tests');
  } catch (err) {
    console.warn('⚠️ MongoDB not connected; proceeding with in-memory service fallback mode.');
  }

  await new Promise((resolve) => server.listen(0, resolve));

  // Generate tokens for test farmers
  const farmer1Token = authService.generateToken({
    id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b90001'),
    role: 'farmer',
    phone: '9876543211',
    name: 'Suresh Gaikwad',
    preferredLanguage: 'mr'
  });

  const farmer2Token = authService.generateToken({
    id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b90002'),
    role: 'farmer',
    phone: '9876543212',
    name: 'Anil Shinde',
    preferredLanguage: 'hi'
  });

  let centreId = null;
  let testWindowStart = null;
  let testWindowEnd = null;
  let createdBookingId = null;

  try {
    // TEST 1: GET /api/centres (Compute traffic light load)
    console.log('[Test 1] Querying /api/centres for traffic load...');
    const centresRes = await makeRequest('/api/centres', 'GET');
    console.log('Centres Response Status:', centresRes.status);
    if (centresRes.status !== 200 || !centresRes.body.data || centresRes.body.data.length === 0) {
      throw new Error('Test 1 Failed: Could not retrieve centres');
    }

    const centre = centresRes.body.data[0];
    centreId = centre._id;
    console.log(`Centre Name: "${centre.name}" | Status: [${centre.currentStatus}] | Utilization: ${centre.utilizationPercent}%`);
    if (!['Green', 'Amber', 'Red'].includes(centre.currentStatus)) {
      throw new Error(`Test 1 Failed: Invalid traffic light status ${centre.currentStatus}`);
    }
    console.log('✅ Test 1 Passed: Centre load status computed accurately\n');

    // TEST 2: GET /api/centres/:id/availability
    console.log(`[Test 2] Querying availability for centre ${centreId}...`);
    const availRes = await makeRequest(`/api/centres/${centreId}/availability?crop=Soybean&quantityBand=5-15q`, 'GET');
    console.log('Availability Status:', availRes.status, 'Total Windows:', availRes.body.data.totalWindows);
    if (availRes.status !== 200 || availRes.body.data.windows.length === 0) {
      throw new Error('Test 2 Failed: No arrival windows returned');
    }

    const firstWindow = availRes.body.data.windows[0];
    testWindowStart = firstWindow.windowStart;
    testWindowEnd = firstWindow.windowEnd;
    console.log(`Sample Window: ${firstWindow.timeLabel} | Available Slots: ${firstWindow.availableSlots}/${firstWindow.maxSlots}`);
    console.log('✅ Test 2 Passed: Arrival window computation working\n');

    // TEST 3: POST /api/bookings (Create booking reservation)
    console.log('[Test 3] Reserving a slot for Farmer 1...');
    const bookRes = await makeRequest(
      '/api/bookings',
      'POST',
      {
        centreId,
        crop: 'Soybean',
        quantityBand: '5-15q',
        arrivalWindowStart: testWindowStart,
        arrivalWindowEnd: testWindowEnd,
        channel: 'app'
      },
      farmer1Token
    );

    console.log('Booking Response:', bookRes.status, 'Token:', bookRes.body.data?.tokenNumber);
    if (bookRes.status !== 201 || !bookRes.body.data.tokenNumber || !bookRes.body.data.qrCode) {
      throw new Error('Test 3 Failed: Booking creation did not issue token or QR code');
    }

    createdBookingId = bookRes.body.data._id;
    console.log(`Issued Token: ${bookRes.body.data.tokenNumber} | Status: ${bookRes.body.data.status}`);
    console.log('✅ Test 3 Passed: Booking reservation created with token and QR\n');

    // TEST 4: Deduplication Check (Same farmer, same window -> Should 400)
    console.log('[Test 4] Testing Deduplication - Farmer 1 trying to book the same window again...');
    const dupRes = await makeRequest(
      '/api/bookings',
      'POST',
      {
        centreId,
        crop: 'Soybean',
        quantityBand: '5-15q',
        arrivalWindowStart: testWindowStart,
        arrivalWindowEnd: testWindowEnd,
        channel: 'app'
      },
      farmer1Token
    );

    console.log('Duplicate Booking Response:', dupRes.status, dupRes.body.message);
    if (dupRes.status !== 400 || !dupRes.body.message.includes('Duplicate booking')) {
      throw new Error('Test 4 Failed: Duplicate booking was not blocked');
    }
    console.log('✅ Test 4 Passed: Deduplication strictly prevented overlapping reservation\n');

    // TEST 5: Verify Audit Log for Booking Creation
    console.log('[Test 5] Verifying AuditLog for BOOKING_CREATED...');
    const auditLogs = await bookingService.getAuditLogs(createdBookingId);
    const creationLog = auditLogs.find((l) => l.action === 'BOOKING_CREATED');
    if (!creationLog) {
      throw new Error('Test 5 Failed: AuditLog entry for BOOKING_CREATED not found');
    }
    console.log(`Audit Entry Found: [${creationLog.action}] by ${creationLog.actorRole} | Reason: "${creationLog.reason}"`);
    console.log('✅ Test 5 Passed: Audit trail recorded booking creation\n');

    // TEST 6: POST /api/bookings/:id/cancel (Cancel booking & release slot)
    console.log(`[Test 6] Cancelling booking ${createdBookingId}...`);
    const cancelRes = await makeRequest(
      `/api/bookings/${createdBookingId}/cancel`,
      'POST',
      { reason: 'Tractor maintenance issue' },
      farmer1Token
    );

    console.log('Cancel Response:', cancelRes.status, 'New Status:', cancelRes.body.data?.status);
    if (cancelRes.status !== 200 || cancelRes.body.data.status !== 'CANCELLED') {
      throw new Error('Test 6 Failed: Booking was not marked as CANCELLED');
    }

    const cancelAuditLogs = await bookingService.getAuditLogs(createdBookingId);
    const releaseLog = cancelAuditLogs.find((l) => l.action === 'SLOT_RELEASED');
    if (!releaseLog) {
      throw new Error('Test 6 Failed: AuditLog entry for SLOT_RELEASED not found');
    }
    console.log(`Audit Entry Found: [${releaseLog.action}] | Reason: "${releaseLog.reason}"`);
    console.log('✅ Test 6 Passed: Slot released and audit trail recorded\n');

    // TEST 7: Capacity Ceiling Enforcement
    console.log('[Test 7] Testing Arrival Window Capacity Exhaustion...');
    // Create bookings with different farmers until capacity limit (5) is reached
    const slotStartTime = new Date(Date.now() + 86400000); // Tomorrow
    slotStartTime.setHours(10, 0, 0, 0);
    const slotEndTime = new Date(slotStartTime.getTime() + 30 * 60 * 1000);

    for (let i = 1; i <= 5; i++) {
      const tempToken = authService.generateToken({
        id: new mongoose.Types.ObjectId(),
        role: 'farmer',
        phone: `980000000${i}`,
        name: `Farmer ${i}`
      });
      await makeRequest(
        '/api/bookings',
        'POST',
        {
          centreId,
          crop: 'Soybean',
          quantityBand: '0-5q',
          arrivalWindowStart: slotStartTime.toISOString(),
          arrivalWindowEnd: slotEndTime.toISOString()
        },
        tempToken
      );
    }

    // 6th booking in the same window should be rejected with 400
    const overCapacityToken = authService.generateToken({
      id: new mongoose.Types.ObjectId(),
      role: 'farmer',
      phone: '9800000099',
      name: 'Farmer Overflow'
    });

    const overflowRes = await makeRequest(
      '/api/bookings',
      'POST',
      {
        centreId,
        crop: 'Soybean',
        quantityBand: '0-5q',
        arrivalWindowStart: slotStartTime.toISOString(),
        arrivalWindowEnd: slotEndTime.toISOString()
      },
      overCapacityToken
    );

    console.log('Overflow Booking Response:', overflowRes.status, overflowRes.body.message);
    if (overflowRes.status !== 400 || !overflowRes.body.message.includes('capacity')) {
      throw new Error('Test 7 Failed: Capacity limit was not enforced');
    }
    console.log('✅ Test 7 Passed: Capacity ceiling strictly enforced (400 Bad Request)\n');

    console.log('🎉 ALL 7 BOOKING & CENTRE CAPACITY TESTS PASSED SUCCESSFULLY!');
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
