require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { StaffUser, Farmer, Centre } = require('../src/models');
const authService = require('../src/services/authService');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';

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

async function runRbacTests() {
  console.log('='.repeat(75));
  console.log('🔒 KISANQ B3 — RESOURCE PLANNING OFFICER & RBAC TEST SUITE');
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

  // Connect to DB and ensure seeds
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri && mongoUri !== 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    try {
      await mongoose.connect(mongoUri);
      await authService.seedStaffRegistry();
    } catch (e) {
      console.warn('DB connect notice:', e.message);
    }
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Verify 6 Resource Planning Officers Seeded
    // -----------------------------------------------------------------------
    console.log('\n--- Section 1: 6-Centre Resource Planning Officer Seeds ---');
    const centres = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];
    
    if (mongoose.connection.readyState === 1) {
      const seededOfficers = await StaffUser.find({ role: 'resource_officer' }).lean();
      assert(seededOfficers.length >= 6, `Found ${seededOfficers.length} seeded resource officers (expected >= 6)`);

      for (const c of centres) {
        const found = seededOfficers.some((o) => o.assignedMandi === c);
        assert(found, `Resource Planning Officer exists for centre ${c}`);
      }
    } else {
      console.log('  ℹ️  MongoDB not connected, skipping direct document count');
      notChecked++;
    }

    // -----------------------------------------------------------------------
    // 2. Staff 2FA Authentication for Resource Officer
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Resource Officer 2FA Authentication ---');
    const credRes = await makeRequest('/api/auth/staff/verify-credentials', 'POST', {
      phone: '9800000006',
      password: 'Staff@KisanQ2026',
      role: 'resource_officer'
    });

    assert(credRes.status === 200 && credRes.body?.data?.challengeToken, 'Resource Officer credentials validated (200 OK)');
    const challengeToken = credRes.body?.data?.challengeToken;

    const otpRes = await makeRequest('/api/auth/staff/verify-otp', 'POST', {
      challengeToken,
      otp: '123456'
    });

    assert(otpRes.status === 200 && otpRes.body?.data?.token, 'Resource Officer 2FA verified, session token issued');
    const kpgOfficerToken = otpRes.body?.data?.token;

    // -----------------------------------------------------------------------
    // 3. GET /api/planning/me Profile & Scope Access
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: GET /api/planning/me Profile & Centre Config ---');
    const meRes = await makeRequest('/api/planning/me', 'GET', null, kpgOfficerToken);
    assert(meRes.status === 200, 'GET /api/planning/me returns 200 OK for resource_officer');
    assert(meRes.body?.data?.user?.role === 'resource_officer', 'Returned user role is resource_officer');
    assert(meRes.body?.data?.centre?.code === 'KPG-01', 'Returned centre is Kopargaon (KPG-01)');
    assert(meRes.body?.data?.centre?.dailySlotCap !== undefined, 'Returned centre configuration includes dailySlotCap');

    // -----------------------------------------------------------------------
    // 4. Centre Tenancy Scoping (scopeToCentre)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Multi-Centre Tenancy Scoping (scopeToCentre) ---');
    
    // Kopargaon officer querying Kopargaon -> 200 OK
    const scopedOwnRes = await makeRequest('/api/planning/me?centreId=KPG-01', 'GET', null, kpgOfficerToken);
    assert(scopedOwnRes.status === 200, 'Resource officer accessing own assigned centre (KPG-01) is allowed (200 OK)');

    // Kopargaon officer attempting to query Shirdi -> 403 Forbidden
    const scopedOtherRes = await makeRequest('/api/planning/me?centreId=SRD-02', 'GET', null, kpgOfficerToken);
    assert(scopedOtherRes.status === 403, 'Resource officer attempting to access outside centre (SRD-02) is rejected (403 Forbidden)');

    // -----------------------------------------------------------------------
    // 5. Role-Based Permissions for Other Roles
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Role-Based Authorization Enforcement ---');

    // Farmer token attempting /api/planning/me -> 403 Forbidden
    const farmerToken = jwt.sign({ id: 'farmer_01', phone: '9876543210', role: 'farmer' }, JWT_SECRET);
    const farmerPlanningRes = await makeRequest('/api/planning/me', 'GET', null, farmerToken);
    assert(farmerPlanningRes.status === 403, 'Farmer token is strictly forbidden from accessing /api/planning/me (403 Forbidden)');

    // District admin token can access any centre
    const adminToken = jwt.sign({ id: 'admin_01', phone: '9900000001', role: 'district_admin', assignedMandi: 'DISTRICT_HQ' }, JWT_SECRET);
    const adminResKpg = await makeRequest('/api/planning/me?centreId=KPG-01', 'GET', null, adminToken);
    const adminResSrd = await makeRequest('/api/planning/me?centreId=SRD-02', 'GET', null, adminToken);
    assert(adminResKpg.status === 200 && adminResSrd.status === 200, 'District Admin has cross-centre authority across multiple APMCs');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED`);
  console.log('='.repeat(75));

  if (failed > 0) process.exit(1);
}

runRbacTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
