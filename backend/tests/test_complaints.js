require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Token, Complaint } = require('../src/models');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const TEST_PREFIX = 'TEST_B6_';

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

async function runComplaintTests() {
  console.log('='.repeat(75));
  console.log('⚖️ KISANQ B6 — FARMER COMPLAINTS & GRIEVANCE ROUTING TEST');
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

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri && mongoUri !== 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    try {
      await mongoose.connect(mongoUri);
    } catch (e) {
      console.warn('DB connect notice:', e.message);
    }
  }

  const phoneFarmerA = '9800000061';
  const phoneFarmerB = '9800000062';
  const tokActiveA = `${TEST_PREFIX}TK_ACTIVE_01`;
  const tokCancelledA = `${TEST_PREFIX}TK_CANCELLED_01`;
  const tokShirdiB = `${TEST_PREFIX}TK_SHIRDI_01`;

  // JWTs for various roles
  const farmerAJwt = jwt.sign({ id: 'farmer_a_id', phone: phoneFarmerA, role: 'farmer', name: 'Farmer A' }, JWT_SECRET);
  const farmerBJwt = jwt.sign({ id: 'farmer_b_id', phone: phoneFarmerB, role: 'farmer', name: 'Farmer B' }, JWT_SECRET);
  const supervisorKpgJwt = jwt.sign({ id: 'sup_kpg', phone: '9800000008', role: 'supervisor', name: 'KPG Supervisor', assignedMandi: 'KPG-01' }, JWT_SECRET);
  const supervisorSrdJwt = jwt.sign({ id: 'sup_srd', phone: '9800000088', role: 'supervisor', name: 'SRD Supervisor', assignedMandi: 'SRD-02' }, JWT_SECRET);
  const officerJwt = jwt.sign({ id: 'officer_qa', phone: '9800000002', role: 'quality_assayer', name: 'Assayer Patil', assignedMandi: 'KPG-01' }, JWT_SECRET);
  const resourceOfficerJwt = jwt.sign({ id: 'ro_kpg', phone: '9800000010', role: 'resource_officer', name: 'RO Kulkarni', assignedMandi: 'KPG-01' }, JWT_SECRET);

  try {
    // -----------------------------------------------------------------------
    // Section 1: Clean and Seed Test Tokens in MongoDB Atlas
    // -----------------------------------------------------------------------
    console.log('\n--- Section 1: Test Data Setup ---');
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      await Complaint.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });

      // 1. Active Token for Farmer A at Kopargaon (Quality stage)
      await Token.create({
        tokenNumber: tokActiveA,
        farmerName: 'Farmer A',
        farmerPhone: phoneFarmerA,
        phone: phoneFarmerA,
        mandiId: 'KPG-01',
        mandiCode: 'KPG',
        mandiName: 'APMC Kopargaon',
        crop: 'Soybean',
        quantity: 35,
        slotDate: new Date().toISOString().split('T')[0],
        slotTime: '08:00 AM - 11:00 AM',
        status: 'GATE_IN',
        currentStageIndex: 1,
        stages: [
          { stageIndex: 0, id: 'GATE_CHECKIN', status: 'Completed' },
          { stageIndex: 1, id: 'QUALITY_GRADING', status: 'In Progress' }
        ]
      });

      // 2. Cancelled Token for Farmer A
      await Token.create({
        tokenNumber: tokCancelledA,
        farmerName: 'Farmer A',
        farmerPhone: phoneFarmerA,
        phone: phoneFarmerA,
        mandiId: 'KPG-01',
        mandiCode: 'KPG',
        mandiName: 'APMC Kopargaon',
        crop: 'Wheat',
        quantity: 20,
        status: 'CANCELLED'
      });

      // 3. Active Token for Farmer B at Shirdi (Weighbridge stage)
      await Token.create({
        tokenNumber: tokShirdiB,
        farmerName: 'Farmer B',
        farmerPhone: phoneFarmerB,
        phone: phoneFarmerB,
        mandiId: 'SRD-02',
        mandiCode: 'SRD',
        mandiName: 'APMC Shirdi',
        crop: 'Cotton',
        quantity: 50,
        status: 'INSPECTED',
        currentStageIndex: 2,
        stages: [
          { stageIndex: 0, id: 'GATE_CHECKIN', status: 'Completed' },
          { stageIndex: 1, id: 'QUALITY_GRADING', status: 'Completed' },
          { stageIndex: 2, id: 'WEIGHBRIDGE', status: 'In Progress' }
        ]
      });

      assert(true, 'Test tokens seeded in MongoDB Atlas');
    }

    // -----------------------------------------------------------------------
    // Section 2: Farmer Filing Grievance (Active Window Gate -> Payout)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Farmer Grievance Creation & Validations ---');
    // Test A: Valid complaint on active token
    const validComplaintRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: tokActiveA,
      checkpoint: 'QUALITY_GRADING',
      category: 'ASSAYING_DISPUTE',
      description: 'Assayer assigned Grade B instead of Grade A for clean moisture lot'
    }, farmerAJwt);

    assert(validComplaintRes.status === 201, 'POST /api/complaints returns 201 Created for active token');
    const compA = validComplaintRes.body?.data;
    assert(compA?.complaintId?.startsWith('CMP-'), `Generated complaint ID: ${compA?.complaintId}`);
    assert(compA?.status === 'PENDING', 'Initial grievance status is PENDING per PRD contract');
    assert(compA?.checkpoint === 'QUALITY_GRADING', 'Canonical checkpoint mapped to QUALITY_GRADING');
    assert(compA?.category === 'ASSAYING_DISPUTE', 'Dispute category is ASSAYING_DISPUTE');
    assert(compA?.source === 'farmer', 'Complaint source is farmer');

    // Test A.2: Exactly 1 open complaint per checkpoint per token
    const duplicateCheckpointRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: tokActiveA,
      checkpoint: 'QUALITY_GRADING',
      category: 'ASSAYING_DISPUTE',
      description: 'Second duplicate complaint on quality grading checkpoint'
    }, farmerAJwt);
    assert(duplicateCheckpointRes.status === 400, 'Second complaint on same checkpoint for same token rejected with 400 (1 open per checkpoint rule)');

    // Test B: Attempt complaint on cancelled token (Must be rejected)
    const cancelledComplaintRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: tokCancelledA,
      checkpoint: 'GATE_CHECKIN',
      description: 'Trying to complain on cancelled slot'
    }, farmerAJwt);
    assert(cancelledComplaintRes.status === 400, 'Complaint on cancelled token rejected with 400');

    // Test C: Attempt complaint on non-existent token
    const nonExistentRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: 'KQ-NONEXISTENT-9999',
      checkpoint: 'WEIGHBRIDGE',
      description: 'Invalid token test'
    }, farmerAJwt);
    assert(nonExistentRes.status === 404, 'Complaint on non-existent token rejected with 404');

    // Test D: Farmer B cannot file complaint on Farmer A's token
    const unauthorizedRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: tokActiveA,
      checkpoint: 'WEIGHBRIDGE',
      description: 'Farmer B unauthorized hijack attempt'
    }, farmerBJwt);
    assert(unauthorizedRes.status === 403, 'Unauthorized filing on stranger token rejected with 403');

    // -----------------------------------------------------------------------
    // Section 3: Second Complaint at Shirdi Centre
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: Filing Second Complaint at Shirdi APMC ---');
    const compShirdiRes = await makeRequest('/api/complaints', 'POST', {
      tokenNumber: tokShirdiB,
      checkpoint: 'WEIGHBRIDGE',
      category: 'WEIGHMENT_VARIANCE',
      description: 'Tare weight mismatch on scale #2 by 150 kg'
    }, farmerBJwt);
    assert(compShirdiRes.status === 201, 'Farmer B filed grievance at Shirdi APMC (201 Created)');
    const compShirdiId = compShirdiRes.body?.data?.complaintId;

    // -----------------------------------------------------------------------
    // Section 4: Supervisor Scoping & Query Filtering
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Supervisor Centre Scoping & Query Filters ---');
    // Kopargaon Supervisor query
    const kpgSupRes = await makeRequest('/api/complaints', 'GET', null, supervisorKpgJwt);
    assert(kpgSupRes.status === 200, 'GET /api/complaints as Kopargaon supervisor returns 200 OK');
    const kpgList = kpgSupRes.body?.data?.complaints || [];
    assert(kpgList.every((c) => c.centreId === 'KPG-01'), 'Kopargaon supervisor only sees complaints for KPG-01');
    assert(kpgList.some((c) => c.complaintId === compA?.complaintId), 'Kopargaon complaint present in supervisor view');

    // Shirdi Supervisor query
    const srdSupRes = await makeRequest('/api/complaints', 'GET', null, supervisorSrdJwt);
    const srdList = srdSupRes.body?.data?.complaints || [];
    assert(srdList.every((c) => c.centreId === 'SRD-02'), 'Shirdi supervisor only sees complaints for SRD-02');
    assert(srdList.some((c) => c.complaintId === compShirdiId), 'Shirdi complaint present in supervisor view');

    // -----------------------------------------------------------------------
    // Section 5: Officer Read-Only Access & Resolution Lockout
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Officer Read-Only Permissions ---');
    // Quality Assayer can view
    const qaViewRes = await makeRequest('/api/complaints', 'GET', null, officerJwt);
    assert(qaViewRes.status === 200, 'Quality Assayer has read-only access to complaints');

    // Resource Officer can view
    const roViewRes = await makeRequest('/api/complaints', 'GET', null, resourceOfficerJwt);
    assert(roViewRes.status === 200, 'Resource Officer has read-only access to complaints');

    // Officer attempting to resolve (Must be rejected with 403)
    const officerResolveRes = await makeRequest(`/api/complaints/${compA?.complaintId}/resolve`, 'PATCH', {
      status: 'RESOLVED',
      resolutionNotes: 'Unauthorized officer resolution'
    }, officerJwt);
    assert(officerResolveRes.status === 403, 'Desk officer resolution attempt rejected with 403 (Read-only restriction)');

    // -----------------------------------------------------------------------
    // Section 6: Supervisor Resolution & Cross-Centre Security
    // -----------------------------------------------------------------------
    console.log('\n--- Section 6: Supervisor Resolution & Cross-Centre Security ---');
    // Resolution without reason rejected with 400
    const noNotesRes = await makeRequest(`/api/complaints/${compA?.complaintId}/resolve`, 'PATCH', {
      status: 'RESOLVED',
      resolutionNotes: ''
    }, supervisorKpgJwt);
    assert(noNotesRes.status === 400, 'Resolution attempt without mandatory notes rejected with 400');

    // Shirdi supervisor cannot resolve Kopargaon grievance
    const crossCentreRes = await makeRequest(`/api/complaints/${compA?.complaintId}/resolve`, 'PATCH', {
      status: 'RESOLVED',
      resolutionNotes: 'Shirdi supervisor cross-centre attempt'
    }, supervisorSrdJwt);
    assert(crossCentreRes.status === 403, 'Cross-centre supervisor resolution rejected with 403');

    // Valid resolution by Kopargaon supervisor
    const validResolveRes = await makeRequest(`/api/complaints/${compA?.complaintId}/resolve`, 'PATCH', {
      status: 'RESOLVED',
      resolutionNotes: 'Sample re-assayed in presence of supervisor. Grade upgraded to Grade A.'
    }, supervisorKpgJwt);
    assert(validResolveRes.status === 200, 'Kopargaon supervisor resolved grievance with 200 OK');
    assert(validResolveRes.body?.data?.status === 'RESOLVED', 'Complaint status updated to RESOLVED');
    assert(validResolveRes.body?.data?.resolutionNotes?.includes('Grade upgraded to Grade A'), 'Resolution notes persisted');

    // Query with source filter
    const sourceFarmerRes = await makeRequest('/api/complaints?source=farmer', 'GET', null, supervisorKpgJwt);
    assert(sourceFarmerRes.status === 200, 'GET /api/complaints?source=farmer returns 200 OK');
    assert(sourceFarmerRes.body?.data?.complaints.every((c) => c.source === 'farmer'), 'Source filter farmer strictly matched');

    // -----------------------------------------------------------------------
    // Section 7: Farmer History View (GET /api/complaints/my)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 7: Farmer Grievance History ---');
    const myComplaintsRes = await makeRequest('/api/complaints/my', 'GET', null, farmerAJwt);
    assert(myComplaintsRes.status === 200, 'GET /api/complaints/my returns 200 OK');
    const myHistory = myComplaintsRes.body?.data?.complaints || [];
    assert(myHistory.some((c) => c.complaintId === compA?.complaintId), 'Resolved grievance visible in farmer grievance history');

    // -----------------------------------------------------------------------
    // Section 8: Disclaimers
    // -----------------------------------------------------------------------
    console.log('\n--- Section 8: Real World Disclaimers ---');
    console.log('  ⚠️ Real SMS dispatch: NOT CHECKED (no Fast2SMS key)');
    console.log('  ⚠️ Real farmer speech: NOT CHECKED (no clips in backend/tests/audio-real/)');
    notChecked += 2;

    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await Token.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      await Complaint.deleteMany({ tokenNumber: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
      console.log('\n🧹 Cleaned up TEST_B6_ records from MongoDB Atlas.');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(75));
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED | ${notChecked} NOT CHECKED`);
  console.log('='.repeat(75));

  if (failed > 0) process.exit(1);
}

runComplaintTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
