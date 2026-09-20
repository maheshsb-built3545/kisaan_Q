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
  console.log('🔒 KISANQ B3 — COMPREHENSIVE RBAC & CENTRE SCOPING TEST SUITE');
  console.log('='.repeat(75));

  let passed = 0;
  let failed = 0;
  let notChecked = 0;

  function assert(condition, message, evidence = null) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      if (evidence) console.log(`     ↳ Observed: ${typeof evidence === 'object' ? JSON.stringify(evidence) : evidence}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      if (evidence) console.error(`     ↳ Observed: ${typeof evidence === 'object' ? JSON.stringify(evidence) : evidence}`);
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

    // Tokens for testing matrix
    const srdOfficerToken = jwt.sign(
      { id: 'srd_ro', phone: '9800000016', name: 'SRD Resource Officer', role: 'resource_officer', assignedMandi: 'SRD-02' },
      JWT_SECRET
    );
    const kpgSupervisorToken = jwt.sign(
      { id: 'kpg_sup', phone: '9800000008', name: 'KPG Supervisor', role: 'supervisor', assignedMandi: 'KPG-01' },
      JWT_SECRET
    );
    const srdSupervisorToken = jwt.sign(
      { id: 'srd_sup', phone: '9800000018', name: 'SRD Supervisor', role: 'supervisor', assignedMandi: 'SRD-02' },
      JWT_SECRET
    );
    const districtAdminToken = jwt.sign(
      { id: 'dist_admin', phone: '9900000001', name: 'District Collector Admin', role: 'district_admin', assignedMandi: 'DISTRICT_HQ' },
      JWT_SECRET
    );
    const farmerToken = jwt.sign(
      { id: 'farmer_01', phone: '9876543210', name: 'Citizen Farmer', role: 'farmer' },
      JWT_SECRET
    );

    // -----------------------------------------------------------------------
    // 3. GET /api/planning/me Profile & Scope Access
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: GET /api/planning/me Profile & Centre Config ---');
    const meRes = await makeRequest('/api/planning/me', 'GET', null, kpgOfficerToken);
    assert(meRes.status === 200, 'GET /api/planning/me returns 200 OK for resource_officer');
    assert(meRes.body?.data?.user?.role === 'resource_officer', 'Returned user role is resource_officer');
    assert(meRes.body?.data?.centre?.code === 'KPG-01', 'Returned centre is Kopargaon (KPG-01)');

    // -----------------------------------------------------------------------
    // 4. Enumeration: /api/planning Routes Scoping
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Enumerating /api/planning Routes ---');
    // Own centre GET -> 200 OK
    const planOwn = await makeRequest('/api/planning/me?centreId=KPG-01', 'GET', null, kpgOfficerToken);
    assert(planOwn.status === 200, 'KPG Officer allowed GET /api/planning/me for KPG-01 (200 OK)');

    // Foreign centre GET -> 403 Forbidden
    const planForeign = await makeRequest('/api/planning/me?centreId=SRD-02', 'GET', null, kpgOfficerToken);
    assert(planForeign.status === 403, 'KPG Officer refused GET /api/planning/me for SRD-02 (403 Forbidden)');

    // Farmer access -> 403 Forbidden
    const planFarmer = await makeRequest('/api/planning/me', 'GET', null, farmerToken);
    assert(planFarmer.status === 403, 'Farmer refused /api/planning/me (403 Forbidden)');

    // District Admin read-only -> GET allowed
    const planAdminGet = await makeRequest('/api/planning/me?centreId=SRD-02', 'GET', null, districtAdminToken);
    assert(planAdminGet.status === 200, 'District Admin allowed GET /api/planning/me across centres (200 OK)');

    // -----------------------------------------------------------------------
    // 5. Enumeration: /api/fasttrack Routes Scoping
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Enumerating /api/fasttrack Routes ---');
    // FastTrack decision with Foreign officer -> 403
    const ftDecForeign = await makeRequest('/api/fasttrack/rounds/FTR-SAMPLE-01/decision', 'POST', {
      centreId: 'KPG-01',
      approved: true
    }, srdOfficerToken); // SRD officer deciding KPG round
    assert(ftDecForeign.status === 403, 'SRD Officer refused POST /api/fasttrack/rounds/:id/decision for KPG-01 (403 Forbidden)');

    // FastTrack decision with Farmer -> 403
    const ftDecFarmer = await makeRequest('/api/fasttrack/rounds/FTR-SAMPLE-01/decision', 'POST', {
      centreId: 'KPG-01',
      approved: true
    }, farmerToken);
    assert(ftDecFarmer.status === 403, 'Farmer refused POST /api/fasttrack/rounds/:id/decision (403 Forbidden)');

    // District Admin write action on /api/fasttrack/decision -> 403 (Read-only rule)
    const ftDecAdmin = await makeRequest('/api/fasttrack/rounds/FTR-SAMPLE-01/decision', 'POST', {
      centreId: 'KPG-01',
      approved: true
    }, districtAdminToken);
    assert(ftDecAdmin.status === 403, 'District Admin refused operational POST decision on FastTrack (403 Forbidden - Read Only)');

    // District Admin GET /api/fasttrack/rounds -> 200
    const ftListAdmin = await makeRequest('/api/fasttrack/rounds?centreId=KPG-01', 'GET', null, districtAdminToken);
    assert(ftListAdmin.status === 200, 'District Admin allowed GET /api/fasttrack/rounds across centres (200 OK)');

    // -----------------------------------------------------------------------
    // 6. Enumeration: /api/complaints Routes Scoping
    // -----------------------------------------------------------------------
    console.log('\n--- Section 6: Enumerating /api/complaints Routes ---');
    // Supervisor own centre GET -> 200
    const cmpSupOwn = await makeRequest('/api/complaints?centreId=KPG-01', 'GET', null, kpgSupervisorToken);
    assert(cmpSupOwn.status === 200, 'KPG Supervisor allowed GET /api/complaints for KPG-01 (200 OK)');

    // Supervisor foreign centre GET -> 403
    const cmpSupForeign = await makeRequest('/api/complaints?centreId=SRD-02', 'GET', null, kpgSupervisorToken);
    assert(cmpSupForeign.status === 403, 'KPG Supervisor refused GET /api/complaints for SRD-02 (403 Forbidden)');

    // Supervisor resolve foreign complaint -> 403
    const cmpResolveForeign = await makeRequest('/api/complaints/CMP-2026-0001/resolve', 'PATCH', {
      centreId: 'SRD-02',
      resolutionNotes: 'Resolved'
    }, kpgSupervisorToken);
    assert(cmpResolveForeign.status === 403, 'KPG Supervisor refused resolving complaint at SRD-02 (403 Forbidden)');

    // Resource officer (read-only on complaints) trying to resolve -> 403
    const cmpResolveRO = await makeRequest('/api/complaints/CMP-2026-0001/resolve', 'PATCH', {
      centreId: 'KPG-01',
      resolutionNotes: 'Resolved'
    }, kpgOfficerToken);
    assert(cmpResolveRO.status === 403, 'Resource Officer refused resolving complaint (Supervisor only, 403 Forbidden)');

    // District Admin read-only GET -> 200
    const cmpAdminGet = await makeRequest('/api/complaints/all', 'GET', null, districtAdminToken);
    assert(cmpAdminGet.status === 200, 'District Admin allowed GET /api/complaints/all district-wide (200 OK)');

    // District Admin write action on complaint resolve -> 403
    const cmpAdminResolve = await makeRequest('/api/complaints/CMP-2026-0001/resolve', 'PATCH', {
      centreId: 'KPG-01',
      resolutionNotes: 'Illegal Admin Action'
    }, districtAdminToken);
    assert(cmpAdminResolve.status === 403, 'District Admin refused PATCH /api/complaints/:id/resolve (403 Forbidden - Read Only)');

    // -----------------------------------------------------------------------
    // 7. Enumeration: /api/waitlist and /api/slots Routes Scoping
    // -----------------------------------------------------------------------
    console.log('\n--- Section 7: Enumerating /api/waitlist and /api/slots Routes ---');
    // Supervisor own centre waitlist GET -> 200
    const waitlistOwn = await makeRequest('/api/waitlist/centre/KPG-01', 'GET', null, kpgSupervisorToken);
    assert(waitlistOwn.status === 200, 'KPG Supervisor allowed GET /api/waitlist/centre/KPG-01 (200 OK)');

    // Supervisor foreign centre waitlist GET -> 403
    const waitlistForeign = await makeRequest('/api/waitlist/centre/SRD-02', 'GET', null, kpgSupervisorToken);
    assert(waitlistForeign.status === 403, 'KPG Supervisor refused GET /api/waitlist/centre/SRD-02 (403 Forbidden)');

    // Farmer unauthorized accept attempt on another farmer's offer -> 403/400
    const offerAcceptUnauthorized = await makeRequest('/api/slots/offers/65f1a2b3c4d5e6f7a8b9c0d1/accept', 'POST', {
      phone: '9876543210' // Farmer 1 phone trying to accept non-existent/other farmer's offer
    }, farmerToken);
    assert(offerAcceptUnauthorized.status === 404 || offerAcceptUnauthorized.status === 400 || offerAcceptUnauthorized.status === 403, 'Unauthorized offer claim rejected cleanly', `HTTP ${offerAcceptUnauthorized.status}`);

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
