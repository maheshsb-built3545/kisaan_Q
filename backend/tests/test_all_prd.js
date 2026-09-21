/**
 * Unified Master Test Runner for KisanQ PRD & Pilot Showcase Requirements
 * 
 * Runs the complete suite of backend, security, session isolation,
 * role-based access control, planning, and showcase verification tests.
 */

const { spawn } = require('child_process');
const path = require('path');

const suites = [
  // 1. Session Isolation & Token Identity Suites
  { name: 'Dual-Client Session Isolation (test:session-isolation)', file: 'tests/test_session_isolation.js' },
  { name: 'Tokens by Phone JWT Identity Guard (test:tokens-by-phone)', file: 'tests/test_tokens_by_phone.js' },
  { name: 'Identity Audit & Farmer Booking Guards (test:identity-audit)', file: 'tests/test_identity_audit_fixes.js' },
  { name: 'Production Security & Dev-Auth Bypass Lockdown (test:production-security)', file: 'tests/test_production_security.js' },
  { name: 'Fast-Track Aliases & Open Route Security (test:alias-security)', file: 'tests/test_alias_and_open_security.js' },
  { name: 'JWT Identity Isolation & Centre Scoping (test:jwt-isolation)', file: 'tests/test_jwt_identity_isolation.js' },
  { name: 'Strict Cross-Area Session Rejection (test:strict-session)', file: 'tests/test_strict_session_rejection.js' },
  { name: 'PRD Endpoint Names Harmonization (test:endpoint-names)', file: 'tests/test_endpoint_names.js' },

  // 2. Core Operational Pilot Modules
  { name: 'B3: RBAC & Resource Officer Suite (test:rbac)', file: 'tests/test_rbac.js' },
  { name: 'B4: Auto Slot Release & Waitlist Suite (test:release)', file: 'tests/test_slot_release.js' },
  { name: 'B6: Farmer Complaints & Escalation Suite (test:complaints)', file: 'tests/test_complaints.js' },
  { name: 'B5: Fast-Track Bidding Auction Suite (test:fasttrack)', file: 'tests/test_fasttrack_bidding.js' },
  { name: 'B1: Unified Notification Centre Suite (test:notifications)', file: 'tests/test_notifications.js' },
  { name: 'Voice Config: Groq/Gemini/Regex NLU & Normalizer', file: 'tests/test_voice_config.js' },
  { name: 'B2: Exact Queue Position & Privacy Masking', file: 'tests/test_b2_privacy_queue.js' },
  { name: 'Slot Offer Deduplication Guard (test:dedup)', file: 'tests/test_slot_offer_dedup.js' },
  { name: 'Voice Booking JWT Authentication Guard (test:voice-auth)', file: 'tests/test_voice_auth.js' },
  { name: 'B8: Operational Timings & Rolling Median Telemetry (test:timings)', file: 'tests/test_timings_switch.js' },
  { name: 'B8/B10: Real Health Signals & Graceful Degraded Mode (test:health)', file: 'tests/test_health_signals.js' },
  { name: 'Notification Recipient-Type Isolation Suite (test:isolation)', file: 'tests/test_notification_isolation.js' },
  { name: 'B7: Resource Planning Officer Portal Suite (test:planning)', file: 'tests/test_planning.js' },
  { name: 'B9: Multi-Mandi Redirect & Trilingual Broadcast Suite (test:redirect)', file: 'tests/test_redirect.js' },

  // 3. Showcase Pilot Verification
  { name: 'Pilot Showcase Integrity & Real Evidence Suite (verify:showcase)', file: 'tests/verify_showcase_checks.js' },

  // 4. Demo Access Endpoints
  { name: 'Demo Access Endpoints & Isolation (test:demo)', file: 'tests/test_demo.js' }
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
  console.log('🌟 KISANQ MASTER PRD & PILOT TEST RUNNER (ALL SUITES)');
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
    console.log('🎉 ALL TEST SUITES PASSED SUCCESSFULLY!\n');
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
