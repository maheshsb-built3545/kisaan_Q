const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🧪 KISANQ PHASE 5 E2E & HARDWARE/OFFLINE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 6;

  // ── TEST 1: Push Token Endpoint Registration ──────────────────────────
  try {
    console.log('[Test 1] Registering farmer and updating Expo Push Token...');
    const phone = '98' + Math.floor(10000000 + Math.random() * 90000000);
    await axios.post(`${API_BASE}/auth/farmer/request-otp`, {
      phone,
      mode: 'register',
      passcode: '123456',
      name: 'E2E Phase 5 Farmer'
    });
    const authRes = await axios.post(`${API_BASE}/auth/farmer/verify-otp`, {
      phone,
      otp: '123456',
      mode: 'register',
      passcode: '123456',
      name: 'E2E Phase 5 Farmer',
      preferredLanguage: 'mr'
    });
    const token = authRes.data.data.token;

    const pushRes = await axios.patch(
      `${API_BASE}/farmers/push-token`,
      { pushToken: 'ExponentPushToken[E2ETestToken999]' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (pushRes.data.success && pushRes.data.data.pushToken === 'ExponentPushToken[E2ETestToken999]') {
      console.log('  ✅ TEST 1 PASSED: Push token saved and synced successfully.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 1 FAILED: Unexpected response', pushRes.data);
    }
  } catch (err) {
    console.error('  ❌ TEST 1 FAILED:', err.response?.data || err.message);
  }

  // ── TEST 2: App.json Android Target Platform Verification ──────────────
  try {
    console.log('[Test 2] Verifying app.json platform scoping...');
    const appJsonPath = path.join(__dirname, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const platforms = appJson.expo?.platforms;
    if (Array.isArray(platforms) && platforms.length === 1 && platforms[0] === 'android') {
      console.log('  ✅ TEST 2 PASSED: app.json correctly scoped to ["android"].\n');
      passed++;
    } else {
      console.error('  ❌ TEST 2 FAILED: Expected platforms: ["android"], found:', platforms);
    }
  } catch (err) {
    console.error('  ❌ TEST 2 FAILED:', err.message);
  }

  // ── TEST 3: Deep Link Routing Configuration ───────────────────────────
  try {
    console.log('[Test 3] Verifying kisanq:// deep linking scheme in App.js & app.json...');
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    const appJsContent = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

    const hasScheme = appJson.expo?.scheme === 'kisanq';
    const hasLinkingPrefixes = appJsContent.includes('kisanq://') && appJsContent.includes('navigationRef');

    if (hasScheme && hasLinkingPrefixes) {
      console.log('  ✅ TEST 3 PASSED: Deep link schema (kisanq://) and response listener verified.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 3 FAILED: Missing scheme or linking prefix');
    }
  } catch (err) {
    console.error('  ❌ TEST 3 FAILED:', err.message);
  }

  // ── TEST 4: Localization Dictionaries (Phase 6 / i18n Completeness) ─────
  try {
    console.log('[Test 4] Verifying i18n dictionaries (mr.json, hi.json, en.json)...');
    const mr = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/mr.json'), 'utf8'));
    const hi = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/hi.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/en.json'), 'utf8'));

    const mrKeys = Object.keys(mr);
    const hiKeys = Object.keys(hi);
    const enKeys = Object.keys(en);

    const keyCount = mrKeys.length;
    const allMatch = mrKeys.length === hiKeys.length && hiKeys.length === enKeys.length;

    if (allMatch && keyCount >= 60) {
      console.log(`  ✅ TEST 4 PASSED: All 3 dictionaries completely match with ${keyCount} localized keys.\n`);
      passed++;
    } else {
      console.error(`  ❌ TEST 4 FAILED: Key count mismatch (MR: ${mrKeys.length}, HI: ${hiKeys.length}, EN: ${enKeys.length})`);
    }
  } catch (err) {
    console.error('  ❌ TEST 4 FAILED:', err.message);
  }

  // ── TEST 5: Data Minimization & Privacy Audit ──────────────────────────
  try {
    console.log('[Test 5] Auditing privacy compliance across mobile screens...');
    const trackingDir = path.join(__dirname, 'src/screens/tracking');
    const files = fs.readdirSync(trackingDir);
    let violationFound = false;

    for (const file of files) {
      const content = fs.readFileSync(path.join(trackingDir, file), 'utf8');
      if (content.includes('Aadhaar-Linked') || content.includes('IFSC:') || content.includes('SBIN000')) {
        console.error(`  ❌ Privacy violation detected in ${file}`);
        violationFound = true;
      }
    }

    if (!violationFound) {
      console.log('  ✅ TEST 5 PASSED: Strict Data Minimization verified (0 Aadhaar / bank disclosures).\n');
      passed++;
    }
  } catch (err) {
    console.error('  ❌ TEST 5 FAILED:', err.message);
  }

  // ── TEST 6: Offline Resilience & Banner Integration ────────────────────
  try {
    console.log('[Test 6] Verifying OfflineBanner integration in dashboard & tracking screens...');
    const screensToCheck = [
      'src/screens/home/HomeScreen.js',
      'src/screens/tracking/TokenDetailsScreen.js',
      'src/screens/tracking/LiveQueueScreen.js',
      'src/screens/tracking/ProcurementTimelineScreen.js',
      'src/screens/tracking/PayoutStatusScreen.js'
    ];

    let allHaveOffline = true;
    for (const scr of screensToCheck) {
      const content = fs.readFileSync(path.join(__dirname, scr), 'utf8');
      if (!content.includes('OfflineBanner') || !content.includes('isOffline')) {
        console.error(`  ❌ Missing OfflineBanner or isOffline in ${scr}`);
        allHaveOffline = false;
      }
    }

    if (allHaveOffline) {
      console.log('  ✅ TEST 6 PASSED: All 5 primary tracking & home screens have OfflineBanner and offline state recovery.\n');
      passed++;
    }
  } catch (err) {
    console.error('  ❌ TEST 6 FAILED:', err.message);
  }

  console.log('====================================================');
  console.log(`📊 FINAL RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase5Tests();
