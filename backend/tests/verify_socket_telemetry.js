const io = require('socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// Simulates StaffLogin's calculateTelemetry logic exactly as in StaffLogin.jsx
async function fetchTelemetry(mandiId) {
  const [centresRes, tokensRes] = await Promise.all([
    httpRequest({ host: 'localhost', port: 5000, path: '/api/centres', method: 'GET' }),
    httpRequest({ host: 'localhost', port: 5000, path: `/api/tokens/mandi/${mandiId}`, method: 'GET' })
  ]);

  const tokens = tokensRes.data?.tokens || [];
  const activeTokens = tokens.filter(t => !['COMPLETED', 'Completed', 'CANCELLED', 'Cancelled'].includes(t.status));
  const yardTrucks = tokens.filter(t => {
    if (['COMPLETED', 'Completed', 'CANCELLED', 'Cancelled'].includes(t.status)) return false;
    return (t.currentStageIndex !== undefined && t.currentStageIndex > 0) ||
      (t.stages?.[0]?.status === 'completed' || t.stages?.[0]?.status === 'Completed') ||
      ['GATE_IN', 'INSPECTED', 'WEIGHED', 'PROCUREMENT', 'GATE_EXIT_REQUESTED', 'CHECKED_IN'].includes(t.status);
  });

  const checkInTimestamps = tokens
    .map((t) => {
      const s0 = t.stages?.[0];
      if (s0 && (s0.status === 'completed' || s0.status === 'Completed' || t.currentStageIndex > 0)) {
        const ts = s0.completedAt || s0.timestamp || t.createdAt;
        return ts ? new Date(ts).getTime() : null;
      }
      return null;
    })
    .filter((ts) => ts && !isNaN(ts))
    .sort((a, b) => a - b);

  let isPaceLive = false;
  let gateVelocityStr = '~3.5 min/truck';
  let sampleDeltas = [];

  if (checkInTimestamps.length >= 2) {
    const deltasMin = [];
    for (let i = 1; i < checkInTimestamps.length; i++) {
      const deltaMs = checkInTimestamps[i] - checkInTimestamps[i - 1];
      const deltaMin = deltaMs / (60 * 1000);
      if (deltaMin > 0 && deltaMin < 120) {
        deltasMin.push(deltaMin);
      }
    }
    if (deltasMin.length > 0) {
      sampleDeltas = deltasMin;
      const avg = deltasMin.reduce((a, b) => a + b, 0) / deltasMin.length;
      gateVelocityStr = `${Math.max(1.0, Math.min(15.0, avg)).toFixed(1)} min/truck`;
      isPaceLive = true;
    }
  }

  return {
    totalActiveQueue: activeTokens.length,
    trucksInYard: yardTrucks.length,
    gateVelocity: gateVelocityStr,
    isPaceLive,
    sampleDeltas,
    totalTokens: tokens.length
  };
}

async function runEndToEndVerification() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  STARTING MULTI-CLIENT SOCKET.IO TELEMETRY VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const mandiId = 'KPG-01';

  // 1. Session A: Staff Client Connects and joins room
  console.log('[Session A: Staff Client] Initializing connection to Socket.IO...');
  const staffSocket = io(SOCKET_URL, { transports: ['websocket'] });

  const receivedEvents = [];

  await new Promise((resolve) => {
    staffSocket.on('connect', () => {
      console.log(`[Session A: Staff Client] Connected with Socket ID: ${staffSocket.id}`);
      staffSocket.emit('join_mandi', mandiId);
      console.log(`[Session A: Staff Client] Emitted join_mandi for room: mandi:${mandiId}`);
      resolve();
    });
  });

  staffSocket.on('NEW_BOOKING', (payload) => {
    console.log('\n⚡ [Session A: Staff Client] Received NEW_BOOKING event:');
    console.log(JSON.stringify(payload, null, 2));
    receivedEvents.push({ event: 'NEW_BOOKING', payload, time: new Date().toISOString() });
  });

  staffSocket.on('STAGE_UPDATED', (payload) => {
    console.log('\n⚡ [Session A: Staff Client] Received STAGE_UPDATED event:');
    console.log(JSON.stringify(payload, null, 2));
    receivedEvents.push({ event: 'STAGE_UPDATED', payload, time: new Date().toISOString() });
  });

  staffSocket.on('TOKEN_COMPLETED', (payload) => {
    console.log('\n⚡ [Session A: Staff Client] Received TOKEN_COMPLETED event:');
    console.log(JSON.stringify(payload, null, 2));
    receivedEvents.push({ event: 'TOKEN_COMPLETED', payload, time: new Date().toISOString() });
  });

  // Initial Telemetry fetch for Session A
  const initialTelemetry = await fetchTelemetry(mandiId);
  console.log('\n[Session A: Staff Client] Initial Rendered Telemetry:');
  console.log(`  - Total Active Queue: ${initialTelemetry.totalActiveQueue}`);
  console.log(`  - Trucks In Yard:     ${initialTelemetry.trucksInYard}`);
  console.log(`  - Gate Velocity:      ${initialTelemetry.gateVelocity} (Live Pace: ${initialTelemetry.isPaceLive})`);

  // 2. Session B: Create Farmer Booking for KPG-01
  const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Session B: Farmer Client] Submitting new booking for APMC Kopargaon (Phone: ${uniquePhone})...`);
  const bookingPayload = {
    farmerName: 'Ramesh Patil',
    farmerPhone: uniquePhone,
    phone: uniquePhone,
    crop: 'Soybean',
    quantity: 45,
    vehicleNumber: 'MH-17-AZ-4412',
    vehicleType: 'Tractor Trolley',
    mandiId: 'KPG-01',
    preferredDate: 'Today',
    preferredTimeSlot: '10:00 AM - 12:00 PM',
    distanceKm: 8.5
  };

  const bookingRes = await httpRequest({
    host: 'localhost',
    port: 5000,
    path: '/api/tokens/book',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, bookingPayload);

  console.log(`[Session B: Farmer Client] Booking response status: ${bookingRes.status}`);
  const createdToken = bookingRes.data?.data?.token || bookingRes.data?.token || bookingRes.data?.data;
  const tokenNumber = createdToken?.tokenNumber || bookingRes.data?.tokenNumber || bookingRes.data?.data?.tokenNumber || bookingRes.data?.token?.tokenNumber;
  console.log(`[Session B: Farmer Client] Token created: #${tokenNumber} for Mandi: ${mandiId}`);

  // Wait for Socket.IO event propagation
  await new Promise((r) => setTimeout(r, 600));

  // Telemetry after new booking
  const postBookingTelemetry = await fetchTelemetry(mandiId);
  console.log('\n[Session A: Staff Client] Telemetry After NEW_BOOKING Event:');
  console.log(`  - Total Active Queue: ${postBookingTelemetry.totalActiveQueue} (Incremented from ${initialTelemetry.totalActiveQueue} to ${postBookingTelemetry.totalActiveQueue})`);
  console.log(`  - Trucks In Yard:     ${postBookingTelemetry.trucksInYard}`);
  console.log(`  - Gate Velocity:      ${postBookingTelemetry.gateVelocity}`);

  // 3. Advance Stage: GATE_CHECKIN (Stage 0 completed -> enters yard)
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Session B / Gate Marshall] Advancing Token #${tokenNumber} to Stage 0 (GATE_CHECKIN)...`);

  const stageUpdateRes = await httpRequest({
    host: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stageIndex: 0,
    stageId: 'GATE_CHECKIN',
    officerName: 'G. K. Thorat',
    status: 'Completed'
  });

  console.log(`[Gate Marshall] Stage update response status: ${stageUpdateRes.status}`);

  // Wait for Socket.IO event propagation
  await new Promise((r) => setTimeout(r, 600));

  const postGateInTelemetry = await fetchTelemetry(mandiId);
  console.log('\n[Session A: Staff Client] Telemetry After STAGE_UPDATED (GATE_CHECKIN) Event:');
  console.log(`  - Total Active Queue: ${postGateInTelemetry.totalActiveQueue}`);
  console.log(`  - Trucks In Yard:     ${postGateInTelemetry.trucksInYard} (Incremented from ${postBookingTelemetry.trucksInYard} to ${postGateInTelemetry.trucksInYard})`);
  console.log(`  - Gate Velocity:      ${postGateInTelemetry.gateVelocity} (Live Pace: ${postGateInTelemetry.isPaceLive})`);

  // 4. Advance Stage: QUALITY_GRADING (Stage 1)
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Quality Assayer] Advancing Token #${tokenNumber} to Stage 1 (QUALITY_GRADING)...`);

  await httpRequest({
    host: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stageIndex: 1,
    stageId: 'QUALITY_GRADING',
    grade: 'Grade-A',
    officerName: 'S. Patil',
    status: 'Completed'
  });

  await new Promise((r) => setTimeout(r, 600));

  // 5. Advance Stage: WEIGHBRIDGE (Stage 2)
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Weighbridge Officer] Advancing Token #${tokenNumber} to Stage 2 (WEIGHBRIDGE)...`);

  await httpRequest({
    host: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stageIndex: 2,
    stageId: 'WEIGHBRIDGE',
    grossWeight: 4520,
    tareWeight: 1200,
    netWeight: 3320,
    officerName: 'S. N. Shinde',
    status: 'Completed'
  });

  await new Promise((r) => setTimeout(r, 600));

  const postWeighedTelemetry = await fetchTelemetry(mandiId);
  console.log('\n[Session A: Staff Client] Telemetry After STAGE_UPDATED (WEIGHBRIDGE) Event:');
  console.log(`  - Total Active Queue: ${postWeighedTelemetry.totalActiveQueue}`);
  console.log(`  - Trucks In Yard:     ${postWeighedTelemetry.trucksInYard}`);

  // 6. Advance Stage: PROCUREMENT (Stage 3)
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Procurement Desk] Signing PO for Token #${tokenNumber} (PROCUREMENT)...`);

  await httpRequest({
    host: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stageIndex: 3,
    stageId: 'PROCUREMENT',
    poNumber: 'PO-2026-9901',
    totalAmount: 58320,
    officerName: 'APMC Secretary Desk',
    status: 'Completed'
  });

  await new Promise((r) => setTimeout(r, 600));

  // 7. Complete Token: PAYOUT (Stage 4)
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log(`[Treasury Desk] Settling and completing Token #${tokenNumber} (PAYOUT)...`);

  await httpRequest({
    host: 'localhost',
    port: 5000,
    path: `/api/tokens/${tokenNumber}/stage-progress`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    stageIndex: 4,
    stageId: 'PAYOUT',
    officerName: 'Treasury Officer',
    status: 'Completed'
  });

  await new Promise((r) => setTimeout(r, 600));

  const postCompletionTelemetry = await fetchTelemetry(mandiId);
  console.log('\n[Session A: Staff Client] Telemetry After TOKEN_COMPLETED Event:');
  console.log(`  - Total Active Queue: ${postCompletionTelemetry.totalActiveQueue} (Decremented from ${postWeighedTelemetry.totalActiveQueue} to ${postCompletionTelemetry.totalActiveQueue})`);
  console.log(`  - Trucks In Yard:     ${postCompletionTelemetry.trucksInYard} (Decremented from ${postWeighedTelemetry.trucksInYard} to ${postCompletionTelemetry.trucksInYard})`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  TOTAL SOCKET.IO EVENTS RECEIVED BY SESSION A: ${receivedEvents.length}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  staffSocket.disconnect();
  process.exit(0);
}

runEndToEndVerification().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
