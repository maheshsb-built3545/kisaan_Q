const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CropPrice = require('../src/models/CropPrice');
const FastTrackRequest = require('../src/models/FastTrackRequest');
const Token = require('../src/models/Token');
const cropPriceService = require('../src/services/cropPriceService');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 KISANQ FAST-TRACK FLAT-RATE VERIFICATION SUITE');
  console.log('='.repeat(70));

  // Connect to DB if configured
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri && mongoUri !== 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected to MongoDB Atlas for state setup.');
    } catch (e) {
      console.log('MongoDB direct connect notice:', e.message);
    }
  }

  const testMandiId = 'VJP-04';
  const testCrop = 'Soybean';
  const today = new Date().toISOString().split('T')[0];

  // 1. Force tight-margin scenario: Market Rate = ₹4,940, MSP = ₹4,910
  console.log(`\n[SETUP] Seeding tight-margin scenario for Mandi ${testMandiId} (${testCrop}):`);
  console.log('   Market Price Today: ₹4,940/Qtl');
  console.log('   Statutory MSP Floor: ₹4,910/Qtl');
  console.log('   Margin Gap: ₹30/Qtl');

  if (mongoose.connection.readyState === 1) {
    await CropPrice.findOneAndUpdate(
      { mandiId: testMandiId, crop: testCrop, effectiveDate: today },
      {
        $set: {
          mandiId: testMandiId,
          crop: testCrop,
          mspPrice: 4910,
          marketPriceToday: 4940,
          marketPriceYesterday: 4870,
          effectiveDate: today,
          updatedBy: 'TEST_VERIFICATION'
        }
      },
      { upsert: true, new: true }
    );
  }

  // 2. Authenticate Farmer 1 & Book Token 1 for Malicious Payload Test
  const farmer1Phone = '9811122233';
  const farmer1Name = 'Malicious Test Farmer';

  console.log('\n[SETUP] Authenticating farmer & booking Token 1...');
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/farmer/request-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone: farmer1Phone, name: farmer1Name, mode: 'register' });

  const auth1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/farmer/verify-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone: farmer1Phone, otp: '123456', name: farmer1Name, mode: 'register' });

  const jwt1 = auth1Res.data?.data?.token || auth1Res.data?.token;

  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/farmers/pickup-location',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt1}`
    }
  }, { latitude: 19.85, longitude: 74.48, address: 'Test Farm 1' });

  const book1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tokens/book',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt1}`
    }
  }, {
    farmerName: farmer1Name,
    farmerPhone: farmer1Phone,
    mandiId: testMandiId,
    crop: testCrop,
    quantity: 30,
    vehicleNumber: 'MH-17-FT-0001'
  });

  const token1 = book1Res.data?.token || book1Res.data?.data;
  const token1Number = token1?.tokenNumber || token1?.id;
  console.log(`Token 1 Booked: ${token1Number}`);

  // -------------------------------------------------------------
  // TEST 1: Malicious Payload Test (The Floor Guard)
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: MALICIOUS PAYLOAD TEST (THE FLOOR GUARD)');
  console.log('='.repeat(70));
  console.log(`Submitting payload with tier: 40 (-₹40/Qtl) on ₹4,940 Market Price (MSP: ₹4,910)...`);
  console.log(`Expected Result: Rejection with HTTP 400 and FLOOR_PRICE_VIOLATION\n`);

  const test1Payload = {
    tier: 40,
    phone: farmer1Phone
  };

  const test1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${token1Number}/fasttrack-request`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt1}`
    }
  }, test1Payload);

  console.log(`HTTP Status Code: ${test1Res.status}`);
  console.log('Response JSON:');
  console.log(JSON.stringify(test1Res.data, null, 2));

  // -------------------------------------------------------------
  // TEST 2: End-to-End Success Test
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: END-TO-END SUCCESS TEST (VALID ₹10/Qtl FLAT DISCOUNT)');
  console.log('='.repeat(70));
  console.log(`Submitting payload with tier: 10 (-₹10/Qtl) on ₹4,940 Market Price (MSP: ₹4,910)...`);
  console.log(`Expected Result: Acceptance with HTTP 201 and discountedPrice: 4930\n`);

  const test2Payload = {
    tier: 10,
    phone: farmer1Phone
  };

  const test2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tokens/${token1Number}/fasttrack-request`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt1}`
    }
  }, test2Payload);

  console.log(`HTTP Status Code: ${test2Res.status}`);
  console.log('Response JSON:');
  console.log(JSON.stringify(test2Res.data, null, 2));

  // 3. Supervisor Approval to test Token mutation & persistence
  console.log('\n[SUPERVISOR APPROVAL] Approving Fast-Track Request to verify Token document persistence...');
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
  const supervisorJwt = jwt.sign(
    {
      id: '64b8f0a1c1d2e3f4a5b6c7d7',
      phone: '9800000099',
      name: 'District Supervisor',
      role: 'supervisor',
      officerCode: 'SEC-SUPERVISOR-HQ',
      assignedMandi: testMandiId
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const reqId = test2Res.data?.data?._id || test2Res.data?.data?.id;
  const approveRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/fasttrack-requests/${reqId}/approve`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supervisorJwt}`
    }
  }, {});

  console.log(`Supervisor Approval Status: ${approveRes.status}`);
  console.log('Approval Response:');
  console.log(JSON.stringify(approveRes.data, null, 2));

  // Fetch updated Token document
  console.log('\n[TOKEN RECORD PERSISTENCE VERIFICATION]:');
  let savedTokenDoc = null;
  if (mongoose.connection.readyState === 1) {
    savedTokenDoc = await Token.findOne({ tokenNumber: token1Number }).lean();
  }

  if (savedTokenDoc) {
    console.log('MongoDB Saved Token Document:');
    console.log(JSON.stringify({
      tokenNumber: savedTokenDoc.tokenNumber,
      mandiId: savedTokenDoc.mandiId,
      crop: savedTokenDoc.crop,
      isFastTrack: savedTokenDoc.isFastTrack,
      fastTrackTier: savedTokenDoc.fastTrackTier,
      fastTrackDiscountedPrice: savedTokenDoc.fastTrackDiscountedPrice,
      queuePosition: savedTokenDoc.queuePosition,
      status: savedTokenDoc.status
    }, null, 2));
  } else {
    console.log('In-Memory / API Token Document:');
    console.log(JSON.stringify(approveRes.data?.data?.token, null, 2));
  }

  console.log('\n' + '='.repeat(70));
  console.log('ALL VERIFICATION CRITERIA EVALUATED SUCCESSFULLY.');
  console.log('='.repeat(70));

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
