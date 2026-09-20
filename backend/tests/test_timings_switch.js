const {
  ASSUMED_DEFAULTS,
  computeMedian,
  recordSample,
  clearSamples,
  getTiming,
  getCentreTimings
} = require('../src/config/timings');

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

function runTimingsTests() {
  console.log('=== RUNNING TIMINGS & TELEMETRY SWITCH UNIT TESTS (PRD 2.8) ===');
  clearSamples();

  const centreId = 'KPG-01';

  // 1. Initial State: Assumed Defaults
  console.log('\n--- 1. Testing Initial Assumed Defaults ---');
  assert(ASSUMED_DEFAULTS.leaveByPace === 8.0, 'Leave-by assumed pace is 8.0 min/truck');
  assert(ASSUMED_DEFAULTS.gateServiceTime === 3.5, 'Gate check-in assumed time is 3.5 min');
  assert(ASSUMED_DEFAULTS.qualityServiceTime === 5.0, 'Quality grading assumed time is 5.0 min');
  assert(ASSUMED_DEFAULTS.weighbridgeServiceTime === 8.0, 'Weighbridge assumed time is 8.0 min');
  assert(ASSUMED_DEFAULTS.procurementServiceTime === 4.0, 'Procurement assumed time is 4.0 min');

  const initialTiming = getTiming(centreId, 'leaveByPace');
  assert(initialTiming.value === 8.0, `Initial value is 8.0 min (Got: ${initialTiming.value})`);
  assert(initialTiming.source === 'assumed', `Initial source is 'assumed' (Got: ${initialTiming.source})`);
  assert(initialTiming.samples === 0, `Initial samples count is 0 (Got: ${initialTiming.samples})`);
  assert(initialTiming.display === 'assumed', `Initial display is 'assumed' (Got: ${initialTiming.display})`);

  // 2. Feeding 1 to 19 Samples (Must Remain Assumed)
  console.log('\n--- 2. Feeding 19 Samples (Must Remain Assumed) ---');
  // Sample values varying around 6.5 - 7.5
  for (let i = 1; i <= 19; i++) {
    recordSample(centreId, 'leaveByPace', 6.0 + (i % 3) * 0.5);
    const midCheck = getTiming(centreId, 'leaveByPace');
    assert(midCheck.source === 'assumed', `Sample ${i}: source remains 'assumed'`);
    assert(midCheck.samples === i, `Sample ${i}: samples count is ${i}`);
    assert(midCheck.display === 'assumed', `Sample ${i}: display is 'assumed'`);
  }

  // 3. Feeding 20th Sample (Must Switch to Measured)
  console.log('\n--- 3. Feeding 20th Sample (Must Switch to Measured with Rolling Median) ---');
  recordSample(centreId, 'leaveByPace', 7.0);

  const switchedTiming = getTiming(centreId, 'leaveByPace');
  assert(switchedTiming.source === 'measured', `Sample 20: source successfully switched to 'measured' (Got: ${switchedTiming.source})`);
  assert(switchedTiming.samples === 20, `Sample 20: samples count is 20 (Got: ${switchedTiming.samples})`);
  assert(switchedTiming.display === 'measured (20 samples)', `Display string is 'measured (20 samples)' (Got: ${switchedTiming.display})`);
  assert(typeof switchedTiming.value === 'number', `Value is calculated rolling median: ${switchedTiming.value}`);

  // 4. Test Desk Service Times Switch at 20 Samples
  console.log('\n--- 4. Testing Desk Service Times Switch (Desk 3: Weighbridge) ---');
  const wbInitial = getTiming(centreId, 'weighbridgeServiceTime');
  assert(wbInitial.value === 8.0 && wbInitial.source === 'assumed', 'Weighbridge starts at 8.0 min assumed');

  // Add 20 observed weighbridge times: [6, 6.5, 7, 7.5, ... ]
  for (let i = 0; i < 20; i++) {
    recordSample(centreId, 'weighbridgeServiceTime', 7.0 + (i % 5) * 0.2);
  }

  const wbMeasured = getTiming(centreId, 'weighbridgeServiceTime');
  assert(wbMeasured.source === 'measured', `Weighbridge switched to 'measured' at 20 samples`);
  assert(wbMeasured.display === 'measured (20 samples)', `Weighbridge display: ${wbMeasured.display}`);
  assert(wbMeasured.value >= 7.0 && wbMeasured.value <= 8.0, `Weighbridge rolling median computed: ${wbMeasured.value}`);

  // 5. Test Full Centre Timings Summary
  console.log('\n--- 5. Testing Centre Timings Snapshot ---');
  const fullSummary = getCentreTimings(centreId);
  assert(fullSummary.leaveByPace.source === 'measured', 'leaveByPace in summary is measured');
  assert(fullSummary.weighbridgeServiceTime.source === 'measured', 'weighbridgeServiceTime in summary is measured');
  assert(fullSummary.gateServiceTime.source === 'assumed', 'gateServiceTime in summary is assumed (0 samples)');
  assert(fullSummary.arrivalCurve.source === 'assumed', 'arrivalCurve in summary is assumed');

  console.log('\n======================================================');
  console.log(`TIMINGS SWITCH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTimingsTests();
