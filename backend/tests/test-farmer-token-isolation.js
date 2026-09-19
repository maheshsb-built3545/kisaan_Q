/**
 * KisanQ Farmer Token Isolation & Strict Single-Active-Token Test Suite
 * Validates:
 * 1. 401 Unauthorized for unauthenticated requests to GET /api/tokens/my-tokens
 * 2. Strict user data isolation (Farmers only receive their own active tokens)
 * 3. Newly logged-in farmer has 0 active tokens
 * 4. Booking 1 slot updates active count to 1
 * 5. Attempting to book a second slot is blocked with 409 ACTIVE_TOKEN_EXISTS
 * 6. Cross-account data isolation (Farmer A's tokens never bleed into Farmer B's session)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 KisanQ Citizen Farmer Token Isolation & State Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  // ─── Test 1: 401 Unauthorized without JWT ──────────────────────────────────
  console.log('🔹 Test 1: Guarding /api/tokens/my-tokens against unauthenticated access');
  const noAuthRes = await request('/api/tokens/my-tokens');
  assert(
    noAuthRes.status === 401,
    'GET /api/tokens/my-tokens rejects unauthenticated request with 401',
    `Status: ${noAuthRes.status}, Body: ${JSON.stringify(noAuthRes.body)}`
  );

  // ─── Test 2: 401 on Invalid Bearer Token ────────────────────────────────────
  console.log('\n🔹 Test 2: Guarding against malformed/invalid JWT signature');
  const invalidAuthRes = await request('/api/tokens/my-tokens', {
    headers: { Authorization: 'Bearer invalid_signature_jwt_fake_123' }
  });
  assert(
    invalidAuthRes.status === 401,
    'GET /api/tokens/my-tokens rejects forged JWT token with 401',
    `Status: ${invalidAuthRes.status}`
  );

  // ─── Test 3: Authenticate Farmer Ganesh (Fresh Farmer) ─────────────────────
  console.log('\n🔹 Test 3: Authenticate brand-new Citizen Farmer "Ganesh"');
  const ganeshPhone = `987650${Math.floor(1000 + Math.random() * 9000)}`;
  const ganeshOtpReq = await request('/api/auth/farmer/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: ganeshPhone, name: 'Ganesh Deshmukh' })
  });
  assert(ganeshOtpReq.status === 200, `OTP requested for Ganesh (${ganeshPhone})`);

  const ganeshAuthRes = await request('/api/auth/farmer/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: ganeshPhone, otp: '123456', name: 'Ganesh Deshmukh' })
  });
  assert(
    ganeshAuthRes.status === 200 && ganeshAuthRes.body?.data?.token,
    'Ganesh authenticated and session JWT issued',
    `Body: ${JSON.stringify(ganeshAuthRes.body)}`
  );

  const ganeshJwt = ganeshAuthRes.body?.data?.token;

  // ─── Test 4: Verify Ganesh has exactly 0 active tokens ────────────────────
  console.log('\n🔹 Test 4: Verify initial state for newly registered farmer');
  const ganeshTokensInitial = await request('/api/tokens/my-tokens', {
    headers: { Authorization: `Bearer ${ganeshJwt}` }
  });
  assert(
    ganeshTokensInitial.status === 200 &&
    ganeshTokensInitial.body.success === true &&
    ganeshTokensInitial.body.count === 0 &&
    Array.isArray(ganeshTokensInitial.body.tokens) &&
    ganeshTokensInitial.body.tokens.length === 0,
    'Ganesh initial active tokens count is strictly 0 (Empty State)',
    `Count: ${ganeshTokensInitial.body.count}, Tokens: ${JSON.stringify(ganeshTokensInitial.body.tokens)}`
  );

  // ─── Test 5: Authenticate Farmer Ramesh and book a token for Ramesh ────────
  console.log('\n🔹 Test 5: Authenticate Farmer Ramesh & create separate active booking');
  const rameshPhone = `987651${Math.floor(1000 + Math.random() * 9000)}`;
  await request('/api/auth/farmer/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: rameshPhone, name: 'Ramesh Patil' })
  });
  const rameshAuth = await request('/api/auth/farmer/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: rameshPhone, otp: '123456', name: 'Ramesh Patil' })
  });
  const rameshJwt = rameshAuth.body?.data?.token;

  const rameshBooking = await request('/api/tokens/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rameshJwt}` },
    body: JSON.stringify({
      farmerName: 'Ramesh Patil',
      farmerPhone: rameshPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      mandiCode: 'KPG',
      crop: 'Wheat',
      quantity: 15,
      slotDate: '12-Sep-2026',
      slotTime: '08:00 – 11:00 AM'
    })
  });
  assert(
    rameshBooking.status === 201 && rameshBooking.body.success === true,
    `Ramesh booked Token #${rameshBooking.body?.token?.tokenNumber}`,
    `Status: ${rameshBooking.status}`
  );

  // ─── Test 6: Verify Ramesh's token does NOT bleed into Ganesh's session ───
  console.log('\n🔹 Test 6: Strict Cross-User Data Isolation Verification');
  const ganeshTokensAfterRamesh = await request('/api/tokens/my-tokens', {
    headers: { Authorization: `Bearer ${ganeshJwt}` }
  });
  assert(
    ganeshTokensAfterRamesh.body.count === 0 && ganeshTokensAfterRamesh.body.tokens.length === 0,
    "Zero data leakage: Ramesh's token does not bleed into Ganesh's dashboard",
    `Ganesh token count: ${ganeshTokensAfterRamesh.body.count}`
  );

  // ─── Test 7: Ganesh books 1 slot at APMC Kopargaon ────────────────────────
  console.log('\n🔹 Test 7: Ganesh books exactly 1 slot at APMC Kopargaon');
  const ganeshBooking1 = await request('/api/tokens/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ganeshJwt}` },
    body: JSON.stringify({
      farmerName: 'Ganesh Deshmukh',
      farmerPhone: ganeshPhone,
      mandiId: 'KPG-01',
      mandiName: 'APMC Kopargaon',
      mandiCode: 'KPG',
      crop: 'Soybean',
      quantity: 25,
      slotDate: '12-Sep-2026',
      slotTime: '08:00 – 11:00 AM'
    })
  });
  assert(
    ganeshBooking1.status === 201 && ganeshBooking1.body.success === true,
    `Ganesh successfully booked Token #${ganeshBooking1.body?.token?.tokenNumber}`,
    `Status: ${ganeshBooking1.status}`
  );

  // Verify Ganesh's token count is now strictly 1
  const ganeshTokensAfterBooking = await request('/api/tokens/my-tokens', {
    headers: { Authorization: `Bearer ${ganeshJwt}` }
  });
  assert(
    ganeshTokensAfterBooking.body.count === 1 &&
    ganeshTokensAfterBooking.body.tokens.length === 1 &&
    ganeshTokensAfterBooking.body.tokens[0].tokenNumber === ganeshBooking1.body?.token?.tokenNumber,
    'Ganesh active tokens count is strictly 1 (HUD Mode)',
    `Token: ${ganeshTokensAfterBooking.body.tokens[0]?.tokenNumber}`
  );

  // ─── Test 8: Ganesh attempts 2nd booking -> Blocked with 409 Conflict ──────
  console.log('\n🔹 Test 8: Enforcing Single-Active-Token Constraint on 2nd Booking');
  const ganeshBooking2 = await request('/api/tokens/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ganeshJwt}` },
    body: JSON.stringify({
      farmerName: 'Ganesh Deshmukh',
      farmerPhone: ganeshPhone,
      mandiId: 'SRD-02',
      mandiName: 'APMC Shirdi',
      mandiCode: 'SRD',
      crop: 'Wheat',
      quantity: 10,
      slotDate: '12-Sep-2026',
      slotTime: '11:00 AM – 02:00 PM'
    })
  });
  assert(
    ganeshBooking2.status === 409 &&
    ganeshBooking2.body.error === 'ACTIVE_TOKEN_EXISTS',
    'Backend rejects 2nd active booking with 409 ACTIVE_TOKEN_EXISTS',
    `Status: ${ganeshBooking2.status}, Message: ${ganeshBooking2.body.message}`
  );

  // ─── Test 9: Cancel Ganesh's Token and verify slot released ───────────────
  console.log('\n🔹 Test 9: Token cancellation and active count release');
  const ganeshTokenNum = ganeshBooking1.body?.token?.tokenNumber;
  const cancelRes = await request(`/api/tokens/${ganeshTokenNum}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Slot reschedule request' })
  });
  assert(
    cancelRes.status === 200,
    `Token #${ganeshTokenNum} cancelled successfully`,
    `Status: ${cancelRes.status}`
  );

  const ganeshTokensAfterCancel = await request('/api/tokens/my-tokens', {
    headers: { Authorization: `Bearer ${ganeshJwt}` }
  });
  const activeCountAfterCancel = (ganeshTokensAfterCancel.body.tokens || []).filter(
    (t) => !['Completed', 'COMPLETED', 'Cancelled', 'CANCELLED'].includes(t.status)
  ).length;

  assert(
    activeCountAfterCancel === 0,
    'Active token count returns to 0 after cancellation (Account unlocked)',
    `Active count: ${activeCountAfterCancel}`
  );

  // Clean up Ramesh's token
  if (rameshBooking.body?.token?.tokenNumber) {
    await request(`/api/tokens/${rameshBooking.body.token.tokenNumber}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test cleanup' })
    });
  }

  console.log('\n================================================================');
  console.log(`📊 Test Results: ${passed}/${total} assertions passed (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL FARMER TOKEN ISOLATION & RBAC TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
