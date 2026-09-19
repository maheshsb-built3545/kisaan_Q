const io = require('socket.io-client');
const assert = require('assert');
const { TOKEN_STATUS, normalizeStatus } = require('../src/utils/statusEnums');

const BACKEND_URL = 'http://localhost:5000';
const MANDI_ID = 'KPG-01';
const FARMER_PHONE = '9876500001';
const FARMER_NAME = 'Balasaheb Vikhe';

async function run() {
  console.log('🚀 Starting Gate Exit & Status Synchronization Verification Test...\n');

  // 1. Verify Enum Definitions
  console.log('▶ [1/6] Verifying Status Enum Standardization...');
  assert.strictEqual(TOKEN_STATUS.BOOKED, 'Booked');
  assert.strictEqual(TOKEN_STATUS.IN_PROGRESS, 'In-Progress');
  assert.strictEqual(TOKEN_STATUS.GATE_EXIT_REQUESTED, 'Gate-Exit-Requested');
  assert.strictEqual(TOKEN_STATUS.CANCELLED, 'Cancelled');
  assert.strictEqual(TOKEN_STATUS.COMPLETED, 'Completed');

  assert.strictEqual(normalizeStatus('GATE_EXIT_REQUESTED'), 'Gate-Exit-Requested');
  assert.strictEqual(normalizeStatus('GATE-EXIT-REQUESTED'), 'Gate-Exit-Requested');
  assert.strictEqual(normalizeStatus('gate_exit_requested'), 'Gate-Exit-Requested');
  assert.strictEqual(normalizeStatus('EXIT_REQUESTED'), 'Gate-Exit-Requested');
  assert.strictEqual(normalizeStatus('GATE_IN'), 'In-Progress');
  assert.strictEqual(normalizeStatus('COMPLETED'), 'Completed');
  assert.strictEqual(normalizeStatus('CANCELLED'), 'Cancelled');
  console.log('✔ Enum standardization and normalizer verified!\n');

  // 2. Setup Socket.IO Client for Real-Time Event Capture
  console.log('▶ [2/6] Connecting to Socket.IO Gateway...');
  const socket = io(BACKEND_URL, { transports: ['websocket'] });
  const capturedEvents = [];

  await new Promise((resolve) => {
    socket.on('connect', () => {
      console.log(`✔ Socket.IO connected (${socket.id}). Joining mandi room ${MANDI_ID}...`);
      socket.emit('join_mandi', MANDI_ID);
      socket.emit('join_admin');
      resolve();
    });
  });

  socket.on('GATE_EXIT_REQUESTED', (data) => {
    console.log('⚡ [SOCKET.IO EVENT] GATE_EXIT_REQUESTED received:', data.tokenNumber);
    capturedEvents.push({ type: 'GATE_EXIT_REQUESTED', data });
  });

  socket.on('EXIT_REQUESTED', (data) => {
    console.log('⚡ [SOCKET.IO EVENT] EXIT_REQUESTED alias received:', data.tokenNumber);
    capturedEvents.push({ type: 'EXIT_REQUESTED', data });
  });

  socket.on('EXIT_APPROVED', (data) => {
    console.log('⚡ [SOCKET.IO EVENT] EXIT_APPROVED received:', data.tokenNumber, 'Fee:', data.penaltyAmount);
    capturedEvents.push({ type: 'EXIT_APPROVED', data });
  });

  socket.on('HARDWARE_EVENT', (data) => {
    console.log('⚡ [SOCKET.IO EVENT] HARDWARE_EVENT received:', data.device, data.action);
    capturedEvents.push({ type: 'HARDWARE_EVENT', data });
  });

  // 3. Book a Token and advance to Gate In
  console.log('\n▶ [3/6] Booking token and advancing through Gate Check-In...');
  const bookRes = await fetch(`${BACKEND_URL}/api/tokens/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandiId: MANDI_ID,
      mandiName: 'APMC Kopargaon',
      farmerName: FARMER_NAME,
      farmerPhone: FARMER_PHONE,
      phone: FARMER_PHONE,
      crop: 'Soybean',
      quantity: 35,
      slotLabel: 'Morning 08:00 – 11:00 AM',
      slotDate: 'Today'
    })
  });
  const bookData = await bookRes.json();
  const tokenNumber = bookData.token.tokenNumber || bookData.token.id;
  console.log(`✔ Token generated: ${tokenNumber} (Status: ${bookData.token.status})`);

  // Gate Check-in Stage
  const gateInRes = await fetch(`${BACKEND_URL}/api/tokens/${tokenNumber}/stage-progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stageId: 'GATE_CHECKIN',
      stageIndex: 0,
      officerName: 'Ramesh Shinde, Security Head',
      officerSigId: 'SEC-D1-KPG-9812',
      status: 'Completed'
    })
  });
  const gateInData = await gateInRes.json();
  console.log(`✔ Gate Check-In Completed for #${tokenNumber} (Status: ${gateInData.token.status})`);

  // 4. Request Gate Exit
  console.log('\n▶ [4/6] Farmer requests Gate Exit / Produce Rejection...');
  const exitReqRes = await fetch(`${BACKEND_URL}/api/tokens/${tokenNumber}/request-exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Excess moisture / produce rejection by merchant' })
  });
  const exitReqData = await exitReqRes.json();
  assert.strictEqual(exitReqData.success, true);
  assert.strictEqual(normalizeStatus(exitReqData.status), TOKEN_STATUS.GATE_EXIT_REQUESTED);
  console.log(`✔ Gate exit requested successfully for #${tokenNumber}. Status: ${exitReqData.status}`);

  // 5. Verify Mandi Query Filter includes Gate-Exit-Requested tokens (Fixing Root Cause A)
  console.log('\n▶ [5/6] Verifying Mandi Queue API includes Gate-Exit-Requested token in active list...');
  const mandiTokensRes = await fetch(`${BACKEND_URL}/api/tokens/mandi/${MANDI_ID}`);
  const mandiTokensData = await mandiTokensRes.json();
  const foundToken = mandiTokensData.tokens.find((t) => (t.tokenNumber || t.id) === tokenNumber);
  assert.ok(foundToken, `Token ${tokenNumber} MUST be returned in mandi queue API!`);
  assert.strictEqual(normalizeStatus(foundToken.status), TOKEN_STATUS.GATE_EXIT_REQUESTED);
  console.log(`✔ Root Cause A Fix Confirmed: Token ${tokenNumber} with status "${foundToken.status}" is included in Mandi Queue API results!`);

  // 6. Officer Authorizes Gate Exit
  console.log('\n▶ [6/6] Officer authorizes Gate Exit & opens boom barrier...');
  const approveRes = await fetch(`${BACKEND_URL}/api/tokens/${tokenNumber}/approve-exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officerName: 'Ramesh Shinde, Security Head',
      officerSigId: 'SEC-D1-KPG-EXIT',
      penaltyAmount: 150,
      reason: 'Produce rejected by assayer'
    })
  });
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.success, true);
  assert.strictEqual(normalizeStatus(approveData.status), TOKEN_STATUS.CANCELLED);
  assert.strictEqual(approveData.penaltyAmount, 150);
  console.log(`✔ Gate exit authorized. Penalty ₹${approveData.penaltyAmount} assessed. Status: ${approveData.status}`);

  // Verify farmer dues updated
  const duesRes = await fetch(`${BACKEND_URL}/api/tokens/farmer/${FARMER_PHONE}/dues`);
  const duesData = await duesRes.json();
  assert.strictEqual(duesData.farmer.pendingDues, 150);
  console.log(`✔ Farmer dues ledger updated: ₹${duesData.farmer.pendingDues} pending dues registered.`);

  // Verify account is unlocked for rebooking
  const rebookRes = await fetch(`${BACKEND_URL}/api/tokens/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandiId: MANDI_ID,
      mandiName: 'APMC Kopargaon',
      farmerName: FARMER_NAME,
      farmerPhone: FARMER_PHONE,
      phone: FARMER_PHONE,
      crop: 'Wheat',
      quantity: 20,
      slotLabel: 'Midday 11:00 AM – 02:00 PM',
      slotDate: 'Today'
    })
  });
  const rebookData = await rebookRes.json();
  assert.strictEqual(rebookRes.status, 201, 'Farmer should be unlocked to book a new slot after gate exit authorization!');
  console.log(`✔ Account Unlocked: Farmer successfully booked new token #${rebookData.token.tokenNumber || rebookData.token.id}!`);

  // Cleanup rebooked token
  await fetch(`${BACKEND_URL}/api/tokens/${rebookData.token.tokenNumber || rebookData.token.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Test complete cleanup' })
  });

  await new Promise((r) => setTimeout(r, 500));
  socket.disconnect();

  console.log('\n===============================================================');
  console.log('🏆 ALL GATE EXIT & STATUS SYNCHRONIZATION TESTS PASSED 100%!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
