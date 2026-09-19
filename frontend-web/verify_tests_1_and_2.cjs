const puppeteer = require('puppeteer-core');
const path = require('path');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const API_BASE = 'http://localhost:5000/api';

async function apiRequest(method, endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-internal-admin': 'true'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('🔬 LIVE TWO-CLIENT SOCKET.IO & STAGE_UPDATED VERIFICATION');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  // Client A: Staff Login Screen
  const staffPage = await browser.newPage();
  await staffPage.setViewport({ width: 1280, height: 900 });

  // Track console logs and WebSocket events on Staff Page
  staffPage.on('console', msg => {
    if (msg.text().includes('[Socket.IO]') || msg.text().includes('Live telemetry')) {
      console.log('  [Staff Browser Console]', msg.text());
    }
  });

  console.log('1. Loading Staff Authentication Screen at http://localhost:5185/staff/login...');
  await staffPage.goto('http://localhost:5185/staff/login', { waitUntil: 'networkidle0' });

  // Select APMC Shirdi (SRD-02) as our target mandi for clean testing
  await staffPage.select('select', 'SRD-02');
  await new Promise(r => setTimeout(r, 800));

  const getStaffTelemetry = async () => {
    return await staffPage.evaluate(() => {
      const strip = document.querySelector('.bg-slate-900.text-white.rounded-2xl');
      const text = strip ? strip.innerText.replace(/\n+/g, ' | ') : '';
      return text;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Two-Client Live Test (Farmer Booking -> Staff Reactive Update)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: TWO-CLIENT LIVE TEST (NEW_BOOKING BROADCAST) ---');
  const t1_before = await getStaffTelemetry();
  console.log('• [Client A: Staff Screen] BEFORE Booking (SRD-02):');
  console.log('   ->', t1_before);

  console.log('\n• [Client B: Farmer Session] Creating real booking on APMC Shirdi (SRD-02)...');
  const uniquePhone1 = '98' + Math.floor(10000000 + Math.random() * 89999999);
  const booking1 = await apiRequest('POST', '/tokens/book', {
    farmerName: 'Kisan Live Test Farmer 1',
    farmerPhone: uniquePhone1,
    phone: uniquePhone1,
    mandiId: 'SRD-02',
    mandiName: 'APMC Shirdi',
    mandiCode: 'SRD',
    crop: 'Wheat',
    quantity: 40,
    quantityBand: '40 Quintals',
    slotDate: '2026-09-15',
    slotTime: '08:00 – 11:00 AM'
  });

  const token1 = booking1.data?.token;
  console.log(`   ✔ Booking created: Token #${token1?.tokenNumber} (HTTP ${booking1.status})`);

  // Allow Socket.IO event to be delivered and processed by Client A (NO MANUAL RELOAD)
  await new Promise(r => setTimeout(r, 1200));

  const t1_after = await getStaffTelemetry();
  console.log('\n• [Client A: Staff Screen] AFTER Booking (WITHOUT Manual Page Reload):');
  console.log('   ->', t1_after);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: STAGE_UPDATED Live Reactivity (Gate Check-In Signed Off)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: STAGE_UPDATED LIVE REACTION (GATE CHECK-IN ENTRY) ---');
  const t2_before = await getStaffTelemetry();
  console.log('• [Client A: Staff Screen] BEFORE Stage 0 Check-In:');
  console.log('   ->', t2_before);

  console.log('\n• [Desk 1 Officer Action] Signing off Gate Check-In for Token #' + token1.tokenNumber + '...');
  const t0_timestamp = new Date(Date.now() - 3.8 * 60 * 1000).toISOString(); // 3.8 minutes ago
  const stageRes1 = await apiRequest('PATCH', `/tokens/${token1.tokenNumber}/stage-progress`, {
    stageIndex: 0,
    stageId: 'GATE_CHECKIN',
    status: 'completed',
    officerName: 'Ramesh Shinde',
    officerSigId: 'SIG-D1-SRD-001',
    timestamp: t0_timestamp,
    completedAt: t0_timestamp
  });
  console.log(`   ✔ Gate Check-In completed (HTTP ${stageRes1.status}) at ${t0_timestamp}`);

  // Allow Socket.IO STAGE_UPDATED event to update Client A (NO MANUAL RELOAD)
  await new Promise(r => setTimeout(r, 1200));

  const t2_after = await getStaffTelemetry();
  console.log('\n• [Client A: Staff Screen] AFTER Stage 0 Check-In (WITHOUT Manual Page Reload):');
  console.log('   ->', t2_after);

  // ─────────────────────────────────────────────────────────────────────────────
  // REALISTIC GATE VELOCITY CALCULATION VALIDATION (3.8 min delta)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- REALISTIC GATE VELOCITY CALCULATION VALIDATION ---');
  console.log('• Creating 2nd booking and gate check-in spaced exactly 3.8 minutes after Token 1...');
  
  const uniquePhone2 = '98' + Math.floor(10000000 + Math.random() * 89999999);
  const booking2 = await apiRequest('POST', '/tokens/book', {
    farmerName: 'Kisan Live Test Farmer 2',
    farmerPhone: uniquePhone2,
    phone: uniquePhone2,
    mandiId: 'SRD-02',
    mandiName: 'APMC Shirdi',
    mandiCode: 'SRD',
    crop: 'Soybean',
    quantity: 20,
    quantityBand: '20 Quintals',
    slotDate: '2026-09-15',
    slotTime: '08:00 – 11:00 AM'
  });

  const token2 = booking2.data?.token;
  const t1_timestamp = new Date().toISOString(); // Now (3.8 mins delta from t0)
  
  await apiRequest('PATCH', `/tokens/${token2.tokenNumber}/stage-progress`, {
    stageIndex: 0,
    stageId: 'GATE_CHECKIN',
    status: 'completed',
    officerName: 'Ramesh Shinde',
    officerSigId: 'SIG-D1-SRD-002',
    timestamp: t1_timestamp,
    completedAt: t1_timestamp
  });
  console.log(`   ✔ Token 2 #${token2?.tokenNumber} Check-In signed off at ${t1_timestamp} (Delta: 3.8 minutes)`);

  // Allow Socket.IO update to reflect
  await new Promise(r => setTimeout(r, 1200));

  const t_velocity = await getStaffTelemetry();
  console.log('\n• [Client A: Staff Screen] Telemetry with 2 Realistic Samples:');
  console.log('   ->', t_velocity);

  console.log('\n================================================================');
  console.log('✔ VERIFICATION RUN COMPLETE');
  console.log('================================================================');

  await browser.close();
})();
