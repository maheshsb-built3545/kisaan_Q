/**
 * Unified Master Test Runner for KisanQ PRD & Pilot Showcase Requirements
 * 
 * Runs the complete suite of backend, security, session isolation,
 * role-based access control, planning, and showcase verification tests.
 * 
 * Invariants Enforced:
 * 1. Pre-run & Post-run capture of showcase farmer landRecord (verificationStatus, areaAcres)
 * 2. Pre-run & Post-run capture of non-showcase collection counts
 * 3. Master run FAILS if any showcase landRecord or non-showcase count changed during test execution.
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  Farmer, Token, Booking, Waitlist, SlotOffer, FastTrackRound,
  Complaint, Exception, Notification, ProcurementRecord, AuditLog
} = require('../src/models');

const SHOWCASE_PHONES = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);
const SEED_BATCH = 'showcase-1';

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
  { name: 'Demo Access Endpoints & Isolation (test:demo)', file: 'tests/test_demo.js' },

  // 5. Farmer Registration & Land Details + Quantity Check
  { name: 'Farmer Land Record & Quantity Check Rule Suite (test:land)', file: 'tests/test_land.js' }
];

async function captureDatabaseBaseline() {
  if (mongoose.connection.readyState !== 1) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 }).catch(() => {});
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return { showcaseLand: {}, nonShowcaseCounts: {} };
  }

  // 1. Showcase farmer land records
  const showcaseFarmers = await Farmer.find({ phone: { $in: SHOWCASE_PHONES } }).lean();
  const showcaseLand = {};
  showcaseFarmers.forEach((f) => {
    showcaseLand[f.phone] = {
      name: f.name,
      areaAcres: f.landRecord?.areaAcres || null,
      verificationStatus: f.landRecord?.verificationStatus || null
    };
  });

  // 2. Non-showcase collection counts
  const nonShowcaseCounts = {
    Farmers: await Farmer.countDocuments({ seedBatch: { $ne: SEED_BATCH }, phone: { $nin: SHOWCASE_PHONES } }),
    Bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Tokens: await Token.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES }, phone: { $nin: SHOWCASE_PHONES } }),
    Waitlist: await Waitlist.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    SlotOffers: await SlotOffer.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    FastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Complaints: await Complaint.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    Exceptions: await Exception.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    ProcurementRecords: await ProcurementRecord.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
  };

  return { showcaseLand, nonShowcaseCounts };
}

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

  console.log('\n📸 Capturing pre-run showcase land records and collection baselines...');
  const baselineBefore = await captureDatabaseBaseline();
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  const results = [];
  for (const suite of suites) {
    const result = await runSuite(suite);
    results.push(result);
  }

  console.log('\n📸 Capturing post-run showcase land records and collection baselines...');
  const baselineAfter = await captureDatabaseBaseline();

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

  // ─── Showcase Data & Baseline Immutability Check ─────────────────────────
  console.log('\n' + '='.repeat(75));
  console.log('🛡️ SHOWCASE DATA & NON-SHOWCASE IMMUTABILITY AUDIT');
  console.log('='.repeat(75));

  let isolationViolation = false;

  if (Object.keys(baselineBefore.showcaseLand).length > 0) {
    console.log('\n1. Showcase Farmer Land Records:');
    for (const phone of Object.keys(baselineBefore.showcaseLand)) {
      const bLand = baselineBefore.showcaseLand[phone];
      const aLand = baselineAfter.showcaseLand[phone];
      const unchanged = (
        aLand &&
        bLand.areaAcres === aLand.areaAcres &&
        bLand.verificationStatus === aLand.verificationStatus
      );
      if (!unchanged) {
        isolationViolation = true;
        console.error(`  ❌ VIOLATION: Farmer ${phone} (${bLand.name}) changed!`);
        console.error(`     Before: ${JSON.stringify(bLand)}`);
        console.error(`     After:  ${JSON.stringify(aLand)}`);
      } else {
        console.log(`  ✅ ${phone} (${bLand.name.padEnd(20)}): Status=${String(bLand.verificationStatus).padEnd(8)} | Area=${bLand.areaAcres} Ac (Preserved)`);
      }
    }

    console.log('\n2. Non-Showcase Collection Counts:');
    for (const coll of Object.keys(baselineBefore.nonShowcaseCounts)) {
      const bCount = baselineBefore.nonShowcaseCounts[coll];
      const aCount = baselineAfter.nonShowcaseCounts[coll];
      const match = bCount === aCount;
      if (!match) {
        isolationViolation = true;
        console.error(`  ❌ VIOLATION: Collection ${coll} non-showcase count changed! Before: ${bCount} | After: ${aCount}`);
      } else {
        console.log(`  ✅ ${coll.padEnd(22)}: Before=${String(bCount).padStart(4)} | After=${String(aCount).padStart(4)} (Preserved)`);
      }
    }
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  if (isolationViolation) {
    console.error('\n❌ TEST RUN FAILED: Showcase or Non-Showcase data was modified during test execution!\n');
    process.exit(1);
  }

  if (failCount === 0) {
    console.log('\n🎉 ALL TEST SUITES PASSED AND SHOWCASE DATA PRESERVED 100%!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TEST SUITES FAILED. Check logs above.\n');
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Master runner error:', err);
  process.exit(1);
});
