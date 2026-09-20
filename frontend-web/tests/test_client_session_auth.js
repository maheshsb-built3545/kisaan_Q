// Mock browser localStorage in Node environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

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

async function runClientAuthTests() {
  console.log('=== RUNNING FRONTEND CLIENT SESSION AUTHENTICATION TEST ===');

  const { farmerClient, staffClient } = await import('../src/api/client.js');

  const FARMER_TOKEN = 'FARMER_JWT_SAMPLE_TOKEN_AAAAAA';
  const STAFF_TOKEN = 'STAFF_JWT_SAMPLE_TOKEN_ZZZZZZ';

  // SCENARIO 1: Both tokens present simultaneously in localStorage
  console.log('\n--- Scenario 1: Both Tokens Stored Simultaneously in localStorage ---');
  localStorage.setItem('kisanq_farmer_token', FARMER_TOKEN);
  localStorage.setItem('kisanq_staff_token', STAFF_TOKEN);

  // Intercept and assert farmerClient request
  let farmerConfig = { headers: {} };
  for (const interceptor of farmerClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) farmerConfig = await interceptor.fulfilled(farmerConfig);
  }
  assert(
    farmerConfig.headers.Authorization === `Bearer ${FARMER_TOKEN}`,
    `farmerClient sent farmer token: ${farmerConfig.headers.Authorization}`
  );
  assert(
    !farmerConfig.headers.Authorization.includes(STAFF_TOKEN),
    'farmerClient did NOT leak or send staff token'
  );

  // Intercept and assert staffClient request
  let staffConfig = { headers: {} };
  for (const interceptor of staffClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) staffConfig = await interceptor.fulfilled(staffConfig);
  }
  assert(
    staffConfig.headers.Authorization === `Bearer ${STAFF_TOKEN}`,
    `staffClient sent staff token: ${staffConfig.headers.Authorization}`
  );
  assert(
    !staffConfig.headers.Authorization.includes(FARMER_TOKEN),
    'staffClient did NOT leak or send farmer token'
  );

  // SCENARIO 2: Only Farmer Token present (Staff logged out) -> No cross-fallback to farmer token
  console.log('\n--- Scenario 2: Only Farmer Token Present (Staff Logged Out) ---');
  localStorage.clear();
  localStorage.setItem('kisanq_farmer_token', FARMER_TOKEN);

  let s2FarmerConfig = { headers: {} };
  for (const interceptor of farmerClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) s2FarmerConfig = await interceptor.fulfilled(s2FarmerConfig);
  }
  assert(
    s2FarmerConfig.headers.Authorization === `Bearer ${FARMER_TOKEN}`,
    `farmerClient correctly sent farmer token when alone`
  );

  let s2StaffConfig = { headers: {} };
  for (const interceptor of staffClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) s2StaffConfig = await interceptor.fulfilled(s2StaffConfig);
  }
  assert(
    s2StaffConfig.headers.Authorization === undefined,
    'staffClient sent NO Authorization header (zero cross-fallback to farmer token)'
  );

  // SCENARIO 3: Only Staff Token present (Farmer logged out) -> No cross-fallback to staff token
  console.log('\n--- Scenario 3: Only Staff Token Present (Farmer Logged Out) ---');
  localStorage.clear();
  localStorage.setItem('kisanq_staff_token', STAFF_TOKEN);

  let s3StaffConfig = { headers: {} };
  for (const interceptor of staffClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) s3StaffConfig = await interceptor.fulfilled(s3StaffConfig);
  }
  assert(
    s3StaffConfig.headers.Authorization === `Bearer ${STAFF_TOKEN}`,
    `staffClient correctly sent staff token when alone`
  );

  let s3FarmerConfig = { headers: {} };
  for (const interceptor of farmerClient.interceptors.request.handlers) {
    if (interceptor.fulfilled) s3FarmerConfig = await interceptor.fulfilled(s3FarmerConfig);
  }
  assert(
    s3FarmerConfig.headers.Authorization === undefined,
    'farmerClient sent NO Authorization header (zero cross-fallback to staff token)'
  );

  console.log('\n======================================================');
  console.log(`FRONTEND SESSION CLIENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runClientAuthTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
