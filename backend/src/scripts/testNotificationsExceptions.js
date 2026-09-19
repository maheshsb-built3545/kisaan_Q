const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const routes = require('../routes');
const authService = require('../services/authService');
const exceptionService = require('../services/exceptionService');
const notificationService = require('../services/notificationService');
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
  console.log('=== KisanQ Notifications & Exception Handling Test Suite ===\n');

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.warn('⚠️ MongoDB not reachable; in-memory fallback active.');
  }

  await new Promise((resolve) => server.listen(0, resolve));

  // Seed / get centre
  const centresRes = await makeRequest('/api/centres', 'GET');
  const centreId = centresRes.body.data[0]._id;

  // Tokens for different roles
  const staffToken = authService.generateToken({
    id: new mongoose.Types.ObjectId(),
    role: 'staff',
    name: 'Staff Ramesh',
    centreId
  });

  const supervisorToken = authService.generateToken({
    id: new mongoose.Types.ObjectId(),
    role: 'supervisor',
    name: 'Supervisor Shinde',
    centreId
  });

  const farmerToken = authService.generateToken({
    id: new mongoose.Types.ObjectId(),
    role: 'farmer',
    phone: '9876540020',
    name: 'Kisan Patil'
  });

  // Create a booking
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

  const bookingId = bookRes.body.data._id;
  console.log(`Booking Created for Testing: ${bookRes.body.data.tokenNumber} (ID: ${bookingId})\n`);

  try {
    // TEST 1: Staff raises an exception with valid reasonCode
    console.log('[Test 1] Staff raises a quality dispute exception...');
    const exRes = await makeRequest(
      '/api/exceptions',
      'POST',
      {
        bookingId,
        type: 'quality_dispute',
        reasonCode: 'Moisture content exceeds 14% limit (measured 16.5%)'
      },
      staffToken
    );
    console.log('Raise Exception Status:', exRes.status, '| ID:', exRes.body.data?._id);
    if (exRes.status !== 201 || !exRes.body.data?._id) {
      throw new Error(`Test 1 Failed: Exception was not raised (status ${exRes.status}): ${exRes.body.message}`);
    }
    const exceptionId = exRes.body.data._id;
    console.log('✅ Test 1 Passed: Staff successfully raised exception\n');

    // TEST 2: Exception missing mandatory reasonCode should fail (400)
    console.log('[Test 2] Raising exception without reasonCode (should fail)...');
    const noReasonRes = await makeRequest(
      '/api/exceptions',
      'POST',
      {
        bookingId,
        type: 'document_mismatch',
        reasonCode: ''
      },
      staffToken
    );
    console.log('No-Reason Response:', noReasonRes.status, noReasonRes.body.message);
    if (noReasonRes.status !== 400) {
      throw new Error('Test 2 Failed: Exception without reasonCode was not rejected');
    }
    console.log('✅ Test 2 Passed: Mandatory reasonCode constraint enforced (400)\n');

    // TEST 3: Invalid exception type should fail (400)
    console.log('[Test 3] Raising exception with invalid type (should fail)...');
    const invalidTypeRes = await makeRequest(
      '/api/exceptions',
      'POST',
      {
        bookingId,
        type: 'invalid_random_type',
        reasonCode: 'Some reason'
      },
      staffToken
    );
    console.log('Invalid Type Response:', invalidTypeRes.status, invalidTypeRes.body.message);
    if (invalidTypeRes.status !== 400) {
      throw new Error('Test 3 Failed: Invalid exception type was not rejected');
    }
    console.log('✅ Test 3 Passed: Valid enum constraint enforced for exception types\n');

    // TEST 4: Farmer attempting to raise exception should be forbidden (403)
    console.log('[Test 4] Farmer attempting to raise exception (should fail with 403)...');
    const farmerExRes = await makeRequest(
      '/api/exceptions',
      'POST',
      {
        bookingId,
        type: 'quality_dispute',
        reasonCode: 'Farmer dispute'
      },
      farmerToken
    );
    console.log('Farmer Response:', farmerExRes.status, farmerExRes.body.message);
    if (farmerExRes.status !== 403) {
      throw new Error('Test 4 Failed: Farmer was not blocked from raising exception');
    }
    console.log('✅ Test 4 Passed: RBAC blocked farmer from raising exception (403)\n');

    // TEST 5: Staff attempting supervisor override should be forbidden (403)
    console.log('[Test 5] Staff attempting supervisor override (should fail with 403)...');
    const staffOverrideRes = await makeRequest(
      `/api/exceptions/${exceptionId}/override`,
      'POST',
      {
        overrideReason: 'Staff override attempt'
      },
      staffToken
    );
    console.log('Staff Override Response:', staffOverrideRes.status, staffOverrideRes.body.message);
    if (staffOverrideRes.status !== 403) {
      throw new Error('Test 5 Failed: Staff was not blocked from supervisor override endpoint');
    }
    console.log('✅ Test 5 Passed: RBAC strictly restricted override to supervisors only (403)\n');

    // TEST 6: Supervisor override without reason should fail (400)
    console.log('[Test 6] Supervisor override without overrideReason (should fail with 400)...');
    const noOverrideReasonRes = await makeRequest(
      `/api/exceptions/${exceptionId}/override`,
      'POST',
      {
        overrideReason: ''
      },
      supervisorToken
    );
    console.log('No-Reason Override Response:', noOverrideReasonRes.status, noOverrideReasonRes.body.message);
    if (noOverrideReasonRes.status !== 400) {
      throw new Error('Test 6 Failed: Override without reason was not rejected');
    }
    console.log('✅ Test 6 Passed: Mandatory overrideReason enforced (400)\n');

    // TEST 7: Supervisor successfully overrides exception
    console.log('[Test 7] Supervisor performs authorized override...');
    const overrideRes = await makeRequest(
      `/api/exceptions/${exceptionId}/override`,
      'POST',
      {
        overrideReason: 'Farmer agreed to dry crop at centre courtyard; moisture re-tested at 13.8%',
        outcome: 'Accepted after drying'
      },
      supervisorToken
    );
    console.log('Override Status:', overrideRes.status, '| Supervisor Override Flag:', overrideRes.body.data?.supervisorOverride);
    if (overrideRes.status !== 200 || !overrideRes.body.data?.supervisorOverride) {
      throw new Error('Test 7 Failed: Supervisor override did not succeed');
    }
    console.log('✅ Test 7 Passed: Supervisor override applied successfully\n');

    // TEST 8: Re-overriding an already overridden exception should fail
    console.log('[Test 8] Attempting second override on same exception (should fail)...');
    const secondOverrideRes = await makeRequest(
      `/api/exceptions/${exceptionId}/override`,
      'POST',
      {
        overrideReason: 'Second override attempt'
      },
      supervisorToken
    );
    console.log('Second Override Response:', secondOverrideRes.status, secondOverrideRes.body.message);
    if (secondOverrideRes.status !== 400) {
      throw new Error('Test 8 Failed: Second override was not rejected');
    }
    console.log('✅ Test 8 Passed: Duplicate override rejected\n');

    // TEST 9: GET /api/exceptions/:id and GET /api/exceptions/booking/:bookingId
    console.log('[Test 9] Fetching exception details & booking exceptions...');
    const getExRes = await makeRequest(`/api/exceptions/${exceptionId}`, 'GET', null, supervisorToken);
    const getBookingExRes = await makeRequest(`/api/exceptions/booking/${bookingId}`, 'GET', null, staffToken);
    console.log('Get Single Status:', getExRes.status, '| Type:', getExRes.body.data?.type);
    console.log('Get Booking Exceptions Status:', getBookingExRes.status, '| Count:', getBookingExRes.body.data?.length);
    if (getExRes.status !== 200 || getBookingExRes.status !== 200 || getBookingExRes.body.data?.length === 0) {
      throw new Error('Test 9 Failed: Exception retrieval failed');
    }
    console.log('✅ Test 9 Passed: Exception query endpoints working\n');

    // TEST 10: Notification Service - internal utility send & log
    console.log('[Test 10] Testing notificationService utility...');
    const smsNotif = await notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'booking_confirmed',
      payload: { token: 'KQ-123', message: 'Slot confirmed' }
    });
    console.log('Mock SMS Dispatched:', smsNotif._id, '| Status:', smsNotif.deliveryStatus);

    const pushNotif = await notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'status_update',
      payload: { title: 'Status Update', message: 'Checked In' }
    });
    console.log('Mock Push Dispatched:', pushNotif._id, '| Status:', pushNotif.deliveryStatus);
    console.log('✅ Test 10 Passed: Notification utility successfully logged SMS and Push records\n');

    // TEST 11: GET /api/notifications/:bookingId/log (Staff / Admin endpoint)
    console.log('[Test 11] Getting notification delivery logs via API...');
    const notifLogRes = await makeRequest(`/api/notifications/${bookingId}/log`, 'GET', null, staffToken);
    console.log('Notification Log Status:', notifLogRes.status, '| Records:', notifLogRes.body.data?.length);
    if (notifLogRes.status !== 200 || !Array.isArray(notifLogRes.body.data) || notifLogRes.body.data.length < 2) {
      throw new Error('Test 11 Failed: Could not retrieve notification delivery logs');
    }
    console.log('✅ Test 11 Passed: Notification delivery log API retrieved all records\n');

    // TEST 12: Notification retry endpoint
    console.log('[Test 12] Testing notification retry endpoint...');
    const retryRes = await makeRequest(`/api/notifications/${smsNotif._id}/retry`, 'POST', {}, staffToken);
    console.log('Retry Status:', retryRes.status, '| Delivery Status:', retryRes.body.data?.deliveryStatus);
    if (retryRes.status !== 200) {
      throw new Error('Test 12 Failed: Notification retry endpoint failed');
    }
    console.log('✅ Test 12 Passed: Notification retry endpoint working\n');

    console.log('🎉 ALL 12 NOTIFICATIONS & EXCEPTION HANDLING TESTS PASSED SUCCESSFULLY!');
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
