/**
 * Test Step 6: Identity Audit & Body Spoofing Refusal Tests
 * Verifies that:
 * 1. PATCH /api/farmers/pickup-location refuses body phone mismatch with JWT (403)
 * 2. PATCH /api/farmers/push-token refuses body phone mismatch with JWT (403)
 * 3. POST /api/voice-booking/start refuses body phone mismatch with JWT (403)
 * 4. POST /api/waitlist/join refuses body phone mismatch with JWT (403)
 * 5. GET /api/tokens/:tokenNumber/agripool-matches refuses unauthenticated (401) and non-owner farmer (403)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Token, Farmer } = require('../src/models');

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method: method.toUpperCase(),
    headers
  };
  if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  return { status: res.status, data };
}

async function runIdentityTests() {
  console.log('=== RUNNING IDENTITY AUDIT & JWT GUARD TESTS ===');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Farmer A (phone: 9800000101)
  const farmerAToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d1',
    phone: '9800000101',
    name: 'Farmer Alpha',
    role: 'farmer'
  });

  // Farmer B (phone: 9800000102)
  const farmerBToken = signToken({
    id: '64b8f0a1c1d2e3f4a5b6c7d2',
    phone: '9800000102',
    name: 'Farmer Beta',
    role: 'farmer'
  });

  // 1. Pickup Location Spoofing Refusal
  console.log('\n--- 1. Testing PATCH /api/farmers/pickup-location ---');
  // Farmer A sends phone of Farmer B in body
  const resLocSpoof = await apiRequest('patch', '/farmers/pickup-location', {
    phone: '9800000102',
    latitude: 19.88,
    longitude: 74.47,
    address: 'Spoofed Farm'
  }, farmerAToken);
  assert(resLocSpoof.status === 403, `Farmer body phone mismatch refused: [${resLocSpoof.status}] ${resLocSpoof.data?.message}`);

  // Farmer A sends valid request with own identity
  const resLocValid = await apiRequest('patch', '/farmers/pickup-location', {
    latitude: 19.89,
    longitude: 74.48,
    address: 'Valid Alpha Farm'
  }, farmerAToken);
  assert(resLocValid.status === 200, `Farmer updating own pickup location succeeded: [${resLocValid.status}]`);

  // 2. Push Token Spoofing Refusal
  console.log('\n--- 2. Testing PATCH /api/farmers/push-token ---');
  const resPushSpoof = await apiRequest('patch', '/farmers/push-token', {
    phone: '9800000102',
    pushToken: 'ExponentPushToken[attacker]'
  }, farmerAToken);
  assert(resPushSpoof.status === 403, `Farmer push token spoof refused: [${resPushSpoof.status}] ${resPushSpoof.data?.message}`);

  const resPushValid = await apiRequest('patch', '/farmers/push-token', {
    pushToken: 'ExponentPushToken[legit_alpha]'
  }, farmerAToken);
  assert(resPushValid.status === 200, `Farmer updating own push token succeeded: [${resPushValid.status}]`);

  // 3. Voice Booking Identity Spoofing Refusal
  console.log('\n--- 3. Testing POST /api/voice-booking/start ---');
  const resVoiceSpoof = await apiRequest('post', '/voice-booking/start', {
    phone: '9800000102', // Farmer A attempts to start session as Farmer B
    language: 'mr'
  }, farmerAToken);
  assert(resVoiceSpoof.status === 403, `Voice booking start with mismatched phone refused: [${resVoiceSpoof.status}] ${resVoiceSpoof.data?.message}`);

  const resVoiceValid = await apiRequest('post', '/voice-booking/start', {
    language: 'mr'
  }, farmerAToken);
  assert(resVoiceValid.status === 200, `Voice booking start with JWT identity succeeded: [${resVoiceValid.status}]`);

  // 4. Waitlist Join Spoofing Refusal
  console.log('\n--- 4. Testing POST /api/waitlist/join ---');
  const resWaitlistSpoof = await apiRequest('post', '/waitlist/join', {
    farmerPhone: '9800000102', // Farmer A attempts to join as Farmer B
    centreId: 'KPG-01',
    crop: 'Wheat',
    quantity: 50
  }, farmerAToken);
  assert(resWaitlistSpoof.status === 403, `Waitlist join with mismatched phone refused: [${resWaitlistSpoof.status}] ${resWaitlistSpoof.data?.message}`);

  const resWaitlistValid = await apiRequest('post', '/waitlist/join', {
    centreId: 'KPG-01',
    crop: 'Wheat',
    quantity: 50
  }, farmerAToken);
  assert(resWaitlistValid.status === 201, `Waitlist join with JWT identity succeeded: [${resWaitlistValid.status}]`);

  // 5. AgriPool Matches Ownership Refusal
  console.log('\n--- 5. Testing GET /api/tokens/:tokenNumber/agripool-matches ---');
  // Create a token owned by Farmer A
  const testTokenNumber = `TEST-AP-${Date.now()}`;
  if (mongoose.connection.readyState === 0) {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(uri, { dbName: 'kisanq_aveniq' });
  }

  await Token.create({
    tokenNumber: testTokenNumber,
    farmerPhone: '9800000101',
    phone: '9800000101',
    farmerName: 'Farmer Alpha',
    mandiId: 'KPG-01',
    mandiName: 'APMC Kopargaon',
    crop: 'Wheat',
    quantity: 40,
    slotDate: '2026-09-29',
    status: 'BOOKED'
  });

  // 5a. Unauthenticated call -> 401
  const resApUnauth = await apiRequest('get', `/tokens/${testTokenNumber}/agripool-matches`);
  assert(resApUnauth.status === 401, `Unauthenticated agripool call refused: [${resApUnauth.status}]`);

  // 5b. Farmer B calling Farmer A's token -> 403
  const resApFarmerB = await apiRequest('get', `/tokens/${testTokenNumber}/agripool-matches`, null, farmerBToken);
  assert(resApFarmerB.status === 403, `Non-owner Farmer B accessing agripool matches refused: [${resApFarmerB.status}] ${resApFarmerB.data?.message}`);

  // 5c. Farmer A (Owner) calling -> 200
  const resApOwner = await apiRequest('get', `/tokens/${testTokenNumber}/agripool-matches`, null, farmerAToken);
  assert(resApOwner.status === 200, `Token owner Farmer A querying agripool matches succeeded: [${resApOwner.status}]`);

  // Clean up
  await Token.deleteOne({ tokenNumber: testTokenNumber });
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log('\n=============================================');
  console.log(`IDENTITY AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runIdentityTests().catch(async err => {
  console.error('Unhandled test failure:', err);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
