/**
 * Unified Master Test Runner for KisanQ PRD Requirements
 * 
 * Runs the following test suites:
 * 1. test:rbac (tests/test_rbac.js)
 * 2. test:release (tests/test_slot_release.js)
 * 3. test:complaints (tests/test_complaints.js)
 * 4. test:fasttrack (tests/test_fasttrack_bidding.js)
 * 5. test:notifications (tests/test_notifications.js)
 * 6. test_voice_config (tests/test_voice_config.js)
 * 7. test_b2_privacy_queue (tests/test_b2_privacy_queue.js)
 */

const { spawn } = require('child_process');
const path = require('path');

const suites = [
  { name: 'B3: RBAC & Resource Officer Suite (test:rbac)', file: 'tests/test_rbac.js' },
  { name: 'B4: Auto Slot Release & Waitlist Suite (test:release)', file: 'tests/test_slot_release.js' },
  { name: 'B6: Farmer Complaints & Escalation Suite (test:complaints)', file: 'tests/test_complaints.js' },
  { name: 'B5: Fast-Track Bidding Auction Suite (test:fasttrack)', file: 'tests/test_fasttrack_bidding.js' },
  { name: 'B1: Unified Notification Centre Suite (test:notifications)', file: 'tests/test_notifications.js' },
  { name: 'Voice Config: Groq/Gemini/Regex NLU & Normalizer', file: 'tests/test_voice_config.js' },
  { name: 'B2: Exact Queue Position & Privacy Masking', file: 'tests/test_b2_privacy_queue.js' },
  { name: 'Fix Batch 4 Step 1: Seed Completeness & Demo Verification (test:step1)', file: 'tests/test_b4_step1_seed.js' },
  { name: 'Fix Batch 4 Step 2: Slot Offer Deduplication (test:dedup)', file: 'tests/test_slot_offer_dedup.js' },
  { name: 'Fix Batch 4 Step 4: Role Fixes & Officer Open Route Security (test:security)', file: 'tests/test_alias_and_open_security.js' },
  { name: 'Fix Batch 4 Step 5: Voice Booking JWT Authentication Guard (test:voice-auth)', file: 'tests/test_voice_auth.js' },
  { name: 'Fix Batch 4 Step 6: Frontend Dual Client Session Auth Isolation (test:frontend-client)', file: '../frontend-web/tests/test_client_session_auth.js' },
  { name: 'B8: Operational Timings & Rolling Median Telemetry Engine (test:timings)', file: 'tests/test_timings_switch.js' },
  { name: 'B8/B10: Real Health Signals & Graceful Degraded Mode (test:health)', file: 'tests/test_health_signals.js' },
  { name: 'Step 1: Notification & Recipient-Type Isolation Suite (test:isolation)', file: 'tests/test_notification_isolation.js' },
  { name: 'B7: Resource Planning Officer Portal Suite (test:planning)', file: 'tests/test_planning.js' },
  { name: 'B9: Multi-Mandi Redirect & Trilingual Broadcast Suite (test:redirect)', file: 'tests/test_redirect.js' }
];

async function runSuite(suite) {
  return new Promise((resolve) => {
    console.log('\n' + '#'.repeat(75));
    console.log(`🚀 RUNNING SUITE: ${suite.name}`);
    console.log('#'.repeat(75) + '\n');

    const proc = spawn('node', [suite.file], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      resolve({ name: suite.name, success: code === 0, code });
    });
  });
}

async function runAll() {
  console.log('='.repeat(75));
  console.log('🌟 KISANQ MASTER PRD TEST RUNNER (ALL SUITES)');
  console.log('='.repeat(75));

  const results = [];
  for (const suite of suites) {
    const result = await runSuite(suite);
    results.push(result);
  }

  console.log('\n' + '='.repeat(75));
  console.log('📊 MASTER TEST RUN SUMMARY:');
  console.log('='.repeat(75));

  let passCount = 0;
  let failCount = 0;
  const notCheckedCount = 2; // Real SMS and Real Farmer Speech

  for (const res of results) {
    const mark = res.success ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${mark} - ${res.name} (Exit code: ${res.code})`);
    if (res.success) passCount++;
    else failCount++;
  }

  console.log('-'.repeat(75));
  console.log(`TOTAL SUITES: ${results.length}`);
  console.log(`PASSED:       ${passCount}`);
  console.log(`FAILED:       ${failCount}`);
  console.log(`NOT CHECKED:  ${notCheckedCount} (Real SMS delivery & Real farmer microphone audio speech)`);
  console.log('='.repeat(75));

  if (failCount === 0) {
    console.log('🎉 ALL PRD TEST SUITES PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TEST SUITES FAILED. Check logs above.\n');
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Master runner error:', err);
  process.exit(1);
});
