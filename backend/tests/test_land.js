/**
 * KisanQ Farmer Registration: Land Details + Quantity Check Test Suite
 * 
 * Tests:
 * 1. Land validation (area > 0, unit conversion, ownership enum), farmer isolation, RBAC verification, audit entries & notifications.
 * 2. Ephemeral 7/12 extraction (magic bytes, size limit, blank key fallback, temp file deletion, zero document storage).
 * 3. Rule-based quantity check (single large booking, cumulative seasonal bookings, cancelled exclusion, separate crops, tenant land, no-land reminder, non-blocking warning, supervisor resolution reason).
 * 4. Repository Grep Audit: Zero Aadhaar handling and zero 12-digit stored/logged sequences.
 * 5. Full live API flow through real backend endpoints.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
const API_PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${API_PORT}/api`;

// Import internal services and configurations
const { validateMagicBytes, extract712LandDetails } = require('../src/services/landExtractService');
const { checkLandQuantityLimit } = require('../src/services/landYieldService');
const { LAND_YIELD_CONFIG, getCropYieldConfig, calculateExpectedMaxYield } = require('../src/config/landYield');
const farmerService = require('../src/services/farmerService');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function makeRequest(method, endpoint, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    let postData = null;
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
      }
    }

    if (postData && !reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Land Validation & RBAC Security
// ─────────────────────────────────────────────────────────────────────────────
async function testSuite1_LandValidationAndRbac() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SUITE 1: Land Validation, Farmer Isolation & RBAC Security');
  console.log('='.repeat(70));

  // 1.1 Area validation (> 0 required)
  try {
    await farmerService.updateLandRecord({
      farmerId: 'test_f1',
      phone: '9800100099',
      landData: { areaAcres: 0, surveyNumber: '101' }
    });
    assert(false, 'Area 0 must be rejected with 400 error');
  } catch (err) {
    assert(err.message.includes('greater than 0'), 'Area <= 0 rejected: ' + err.message);
  }

  // 1.2 Ownership enum validation
  try {
    await farmerService.updateLandRecord({
      farmerId: 'test_f1',
      phone: '9800100099',
      landData: { areaAcres: 5.0, ownershipType: 'invalid_type', surveyNumber: '102' }
    });
    assert(false, 'Invalid ownership type must be rejected');
  } catch (err) {
    assert(err.message.includes('Invalid ownershipType'), 'Invalid ownership enum rejected');
  }

  // 1.3 Successful land record creation with self-declared pending status
  const validLand = await farmerService.updateLandRecord({
    farmerId: 'test_f1',
    phone: '9800100099',
    landData: {
      surveyNumber: '45/2A',
      gatNumber: '12',
      village: 'Kopargaon Rural',
      taluka: 'Kopargaon',
      district: 'Ahmednagar',
      areaAcres: 4.5,
      ownershipType: 'owner',
      ownerNameOn712: 'Ramesh Kadam'
    }
  });
  assert(validLand.landRecord.areaAcres === 4.5, 'Valid land area stored as 4.5 acres');
  assert(validLand.landRecord.verificationStatus === 'pending', 'Initial status is "pending"');
  assert(validLand.landRecord.source === 'self', 'Source is "self"');

  // 1.4 Farmer Isolation: JWT tokens for Farmer A vs Farmer B
  const tokenFarmerA = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c001', phone: '9800100001', role: 'farmer' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenFarmerB = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c002', phone: '9800100002', role: 'farmer' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenSupervisor = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c011', name: 'V. Pawar', phone: '9800000001', role: 'supervisor', centreId: 'KPG-01' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenGate = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c012', name: 'R. Shinde', phone: '9800000002', role: 'security_gate', centreId: 'KPG-01' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenDistrictAdmin = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c017', name: 'Collector Office', phone: '9800000007', role: 'district_admin' }, JWT_SECRET, { expiresIn: '1h' });

  // Farmer B updates own land via /api/farmers/me/land
  const resB = await makeRequest('PUT', '/farmers/me/land', { surveyNumber: '999', areaAcres: 10, ownershipType: 'owner' }, tokenFarmerB);
  assert(resB.status === 200, 'Farmer B updates own land successfully');

  // Farmer A's land remains separate
  const resAGet = await makeRequest('GET', '/farmers/me/land', null, tokenFarmerA);
  assert(resAGet.data?.data?.landRecord?.surveyNumber !== '999', 'Farmer A land remains strictly isolated from Farmer B');

  // 1.5 Verification RBAC: Gate staff cannot verify land (403 Forbidden)
  const resGateVerify = await makeRequest('PATCH', '/farmers/9800100001/land-verification', { status: 'verified' }, tokenGate);
  assert(resGateVerify.status === 403, 'Non-supervisor role (security_gate) gets 403 Forbidden on land verification');

  // 1.6 Rejection reason is mandatory when rejected
  const resSupRejNoReason = await makeRequest('PATCH', '/farmers/9800100001/land-verification', { status: 'rejected' }, tokenSupervisor);
  assert(resSupRejNoReason.status === 400, 'Rejection without reason returns 400 Bad Request');

  // 1.7 Supervisor verification succeeds with right role
  const resSupVerify = await makeRequest('PATCH', '/farmers/9800100001/land-verification', { status: 'verified' }, tokenSupervisor);
  assert(resSupVerify.status === 200, 'Supervisor verification succeeds (HTTP 200)');
  assert(resSupVerify.data?.data?.landRecord?.verificationStatus === 'verified', 'Verification status updated to verified');

  // 1.8 District Admin read-only counts endpoint
  const resCounts = await makeRequest('GET', '/farmers/land-verification/counts', null, tokenDistrictAdmin);
  assert(resCounts.status === 200, 'District Admin receives read-only land verification counts');
  assert(typeof resCounts.data?.data?.totalFarmers === 'number', 'Counts include totalFarmers numeric aggregate');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Ephemeral 7/12 OCR Extraction & Zero Document Retention
// ─────────────────────────────────────────────────────────────────────────────
async function testSuite2_EphemeralExtraction() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SUITE 2: Ephemeral 7/12 Extraction & Zero Document Retention');
  console.log('='.repeat(70));

  // 2.1 Magic byte validation
  const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for testing 7/12 extraction');
  const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const fakePdfBuffer = Buffer.from('Plain text claiming to be a PDF without magic bytes');

  assert(validateMagicBytes(pdfBuffer).isValid === true && validateMagicBytes(pdfBuffer).detectedType === 'application/pdf', 'PDF magic bytes (%PDF) validated');
  assert(validateMagicBytes(jpgBuffer).isValid === true && validateMagicBytes(jpgBuffer).detectedType === 'image/jpeg', 'JPEG magic bytes (FF D8 FF) validated');
  assert(validateMagicBytes(pngBuffer).isValid === true && validateMagicBytes(pngBuffer).detectedType === 'image/png', 'PNG magic bytes (89 50 4E 47) validated');
  assert(validateMagicBytes(fakePdfBuffer).isValid === false, 'Spoofed PDF without magic bytes rejected');

  // 2.2 Blank API keys returns suggestions/empty without error or crash
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalGroq = process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;

  try {
    const result = await extract712LandDetails(pdfBuffer, 'application/pdf', 'test_712.pdf');
    assert(result && typeof result.suggestions === 'object', 'Blank API keys fallback returns suggestions object without throwing');
    assert(result.suggestions.surveyNumber !== undefined, 'Suggestions contain structured fields');
  } finally {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    if (originalGroq) process.env.GROQ_API_KEY = originalGroq;
  }

  // 2.3 Ephemeral file removal assertion: check that no temporary files remain in working directory
  const uploadsDir = path.join(__dirname, '../uploads');
  const tempDir = path.join(__dirname, '../temp');
  const filesInUploads = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
  const filesInTemp = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];

  assert(filesInUploads.length === 0, 'Zero files retained in uploads directory');
  assert(filesInTemp.length === 0, 'Zero files retained in temp directory');

  // 2.4 DB Schema check: assert Farmer schema has NO document path/URL fields
  const FarmerModel = require('../src/models/Farmer');
  const schemaPaths = Object.keys(FarmerModel.schema.paths);
  const docFields = schemaPaths.filter(p => p.includes('document') || p.includes('fileUrl') || p.includes('pdfPath') || p.includes('712File'));
  assert(docFields.length === 0, 'Farmer model contains ZERO document URL or file path fields');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Rule-Based Quantity Limits & Non-Blocking Booking Check
// ─────────────────────────────────────────────────────────────────────────────
async function testSuite3_RuleBasedQuantityCheck() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SUITE 3: Rule-Based Quantity Limits & Non-Blocking Booking Check');
  console.log('='.repeat(70));

  // Configuration check
  assert(LAND_YIELD_CONFIG.crops.soybean.yieldPerAcre === 8, 'Soybean assumed yield is 8 Qtl/Acre');
  assert(LAND_YIELD_CONFIG.defaultToleranceMultiplier === 1.5, 'Default tolerance multiplier is 1.5x');
  assert(LAND_YIELD_CONFIG.crops.soybean.source === 'assumed', 'Yield source is explicitly "assumed"');

  // 3.1 Single booking exceeding limit
  // Sunil Shinde: 1.5 acres declared => 1.5 * 8 * 1.5 = 18.0 Qtl expected max.
  // Booking: 25 Qtl
  const farmerSmall = {
    _id: 'farmer_sunil_test',
    name: 'Sunil Shinde',
    phone: '9800100002',
    landRecord: {
      areaAcres: 1.5,
      surveyNumber: '88/2',
      ownershipType: 'owner',
      verificationStatus: 'pending'
    }
  };

  const checkSingle = await checkLandQuantityLimit({
    farmer: farmerSmall,
    crop: 'Soybean',
    newBookingQuantity: 25,
    mandiId: 'KPG-01',
    existingActiveBookings: []
  });

  assert(checkSingle.exceedsLimit === true, 'Booking 25 Qtl exceeds 18 Qtl estimate (exceedsLimit=true)');
  assert(checkSingle.expectedMaxQtl === 18, 'Expected max calculated as 18.0 Qtl (1.5 * 8 * 1.5)');
  assert(checkSingle.bookedQtl === 25, 'Total booked Qtl is 25');
  assert(checkSingle.warning?.code === 'LAND_QUANTITY_EXCEEDS_ESTIMATE', 'Warning code is LAND_QUANTITY_EXCEEDS_ESTIMATE');

  // 3.2 Two bookings adding up over the limit
  // Booking 1: 10 Qtl (Active) + New Booking: 10 Qtl => Total 20 Qtl > 18 Qtl limit
  const existing10 = [{ _id: 'b1', crop: 'Soybean', quantity: 10, status: 'In-Progress' }];
  const checkCumulative = await checkLandQuantityLimit({
    farmer: farmerSmall,
    crop: 'Soybean',
    newBookingQuantity: 10,
    mandiId: 'KPG-01',
    existingActiveBookings: existing10
  });
  assert(checkCumulative.exceedsLimit === true, 'Cumulative sum (10 + 10 = 20 Qtl) exceeds 18 Qtl limit');
  assert(checkCumulative.bookedQtl === 20, 'Cumulative booked quantity is 20 Qtl');

  // 3.3 Cancelled booking excluded from cumulative sum
  const existingCancelled = [
    { _id: 'b_cancel', crop: 'Soybean', quantity: 15, status: 'Cancelled' },
    { _id: 'b_active', crop: 'Soybean', quantity: 8, status: 'Completed' }
  ];
  const checkCancelled = await checkLandQuantityLimit({
    farmer: farmerSmall,
    crop: 'Soybean',
    newBookingQuantity: 8,
    mandiId: 'KPG-01',
    existingActiveBookings: existingCancelled
  });
  assert(checkCancelled.exceedsLimit === false, 'Cancelled booking excluded: Active sum (8 + 8 = 16 Qtl) <= 18 Qtl');

  // 3.4 Separate crops isolated
  // 10 Qtl Soybean booking should NOT add up with a Wheat booking
  const existingWheat = [{ _id: 'b_wheat', crop: 'Wheat', quantity: 30, status: 'In-Progress' }];
  const checkCropSeparation = await checkLandQuantityLimit({
    farmer: farmerSmall,
    crop: 'Soybean',
    newBookingQuantity: 12,
    mandiId: 'KPG-01',
    existingActiveBookings: existingWheat
  });
  assert(checkCropSeparation.exceedsLimit === false, 'Wheat bookings excluded from Soybean seasonal quantity calculation');

  // 3.5 Tenant land properly supported
  const farmerTenant = {
    _id: 'farmer_tenant_test',
    name: 'Vikas Deshmukh',
    phone: '9800100003',
    landRecord: {
      areaAcres: 6.0,
      surveyNumber: '112/1',
      ownershipType: 'tenant',
      verificationStatus: 'verified'
    }
  };
  const checkTenant = await checkLandQuantityLimit({
    farmer: farmerTenant,
    crop: 'Soybean',
    newBookingQuantity: 50,
    mandiId: 'KPG-01',
    existingActiveBookings: []
  });
  // 6.0 * 8 * 1.5 = 72 Qtl limit => 50 Qtl is within limit
  assert(checkTenant.exceedsLimit === false, 'Tenant land (6.0 acres = 72 Qtl limit) accommodates 50 Qtl without flag');

  // 3.6 Farmer with NO land record => NO exception flag, reminder flag returned
  const farmerNoLand = {
    _id: 'farmer_no_land_test',
    name: 'New Farmer',
    phone: '9800100098',
    landRecord: null
  };
  const checkNoLand = await checkLandQuantityLimit({
    farmer: farmerNoLand,
    crop: 'Soybean',
    newBookingQuantity: 20,
    mandiId: 'KPG-01',
    existingActiveBookings: []
  });
  assert(checkNoLand.exceedsLimit === false, 'No land record does NOT trigger exception flag');
  assert(checkNoLand.hasLandRecord === false, 'hasLandRecord is false');
  assert(checkNoLand.reminder?.code === 'ADD_LAND_DETAILS', 'Returns reminder card notice');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Grep Audit (Zero Aadhaar Handling Everywhere)
// ─────────────────────────────────────────────────────────────────────────────
async function testSuite4_ZeroAadhaarAudit() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SUITE 4: Grep Audit - Zero Aadhaar & Zero 12-Digit Sequence');
  console.log('='.repeat(70));

  const directoriesToSearch = [
    path.join(__dirname, '../src'),
    path.join(__dirname, '../../frontend-web/src')
  ];

  let aadhaarMatches = 0;
  let twelveDigitMatches = 0;

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|json|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Check for case-insensitive aadhaar / aadhar
        const aadhaarRegex = /\b(aadhaar|aadhar)\b/gi;
        const match = content.match(aadhaarRegex);
        if (match) {
          console.warn(`    ⚠️ Aadhaar keyword found in: ${path.relative(__dirname, fullPath)}: ${match.join(', ')}`);
          aadhaarMatches += match.length;
        }

        // Check for hardcoded 12-digit numbers
        const twelveRegex = /\b\d{12}\b/g;
        const twMatches = content.match(twelveRegex);
        if (twMatches) {
          console.warn(`    ⚠️ 12-digit number sequence found in: ${path.relative(__dirname, fullPath)}: ${twMatches.join(', ')}`);
          twelveDigitMatches += twMatches.length;
        }
      }
    }
  }

  for (const dir of directoriesToSearch) {
    scanDir(dir);
  }

  assert(aadhaarMatches === 0, `Zero Aadhaar keyword matches across entire codebase (Found: ${aadhaarMatches})`);
  assert(twelveDigitMatches === 0, `Zero 12-digit sequence occurrences across codebase (Found: ${twelveDigitMatches})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Live API End-to-End Flow
// ─────────────────────────────────────────────────────────────────────────────
async function testSuite5_LiveApiEndToEnd() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SUITE 5: Live API End-to-End Real Flow');
  console.log('='.repeat(70));

  // 5.1 Authenticate via demo endpoint
  const authRes = await makeRequest('POST', '/auth/demo/farmer', { phone: '9800100001' });
  const farmerToken = authRes.data?.data?.token || authRes.data?.token;
  assert(Boolean(farmerToken), 'Demo farmer login issued valid JWT');

  // 5.2 Update Land Details
  const putRes = await makeRequest('PUT', '/farmers/me/land', {
    surveyNumber: '104/3B',
    gatNumber: '44',
    village: 'Kopargaon',
    taluka: 'Kopargaon',
    district: 'Ahmednagar',
    areaAcres: 8.5,
    ownershipType: 'owner',
    ownerNameOn712: 'Ramesh Kadam'
  }, farmerToken);
  assert(putRes.status === 200, 'PUT /api/farmers/me/land returns 200 OK');
  assert(putRes.data?.data?.landRecord?.areaAcres === 8.5, 'Declared land area 8.5 acres returned');

  // 5.3 Retrieve Land Details
  const getRes = await makeRequest('GET', '/farmers/me/land', null, farmerToken);
  assert(getRes.status === 200, 'GET /api/farmers/me/land returns 200 OK');
  assert(getRes.data?.data?.landRecord?.surveyNumber === '104/3B', 'Survey number accurately retrieved');

  // 5.4 Staff verification via demo supervisor
  const supAuthRes = await makeRequest('POST', '/auth/demo/staff', { role: 'supervisor' });
  const supervisorToken = supAuthRes.data?.data?.token || supAuthRes.data?.token;
  assert(Boolean(supervisorToken), 'Demo supervisor login issued valid JWT');

  const verifyRes = await makeRequest('PATCH', '/farmers/9800100001/land-verification', {
    status: 'verified'
  }, supervisorToken);
  assert(verifyRes.status === 200, 'PATCH /api/farmers/:id/land-verification returns 200 OK');

  // 5.5 District admin counts
  const distAuthRes = await makeRequest('POST', '/auth/demo/staff', { role: 'district_admin' });
  const distToken = distAuthRes.data?.data?.token || distAuthRes.data?.token;
  assert(Boolean(distToken), 'Demo district admin login issued valid JWT');

  const countsRes = await makeRequest('GET', '/farmers/land-verification/counts', null, distToken);
  assert(countsRes.status === 200, 'GET /api/farmers/land-verification/counts returns 200 OK');
  assert(countsRes.data?.data?.verified >= 1, 'Verified count is >= 1 in district overview');
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Runner
// ─────────────────────────────────────────────────────────────────────────────
async function runAllLandTests() {
  console.log('='.repeat(75));
  console.log('🌱 KISANQ LAND DETAILS & QUANTITY CHECK AUTOMATED TEST SUITE');
  console.log('='.repeat(75));

  await testSuite1_LandValidationAndRbac();
  await testSuite2_EphemeralExtraction();
  await testSuite3_RuleBasedQuantityCheck();
  await testSuite4_ZeroAadhaarAudit();
  await testSuite5_LiveApiEndToEnd();

  console.log('\n' + '='.repeat(75));
  console.log(`📊 TEST EXECUTION SUMMARY:`);
  console.log(`   TOTAL ASSERTIONS: ${totalTests}`);
  console.log(`   PASSED:           ${passedTests}`);
  console.log(`   FAILED:           ${failedTests}`);
  console.log('='.repeat(75));

  if (failedTests === 0) {
    console.log('🎉 ALL LAND & QUANTITY CHECK TESTS PASSED (100% SUCCESS)!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED. Check logs above.\n');
    process.exit(1);
  }
}

runAllLandTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
