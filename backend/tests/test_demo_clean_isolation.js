const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const mongoose = require('mongoose');
require('dotenv').config();
const { Token, Waitlist, FastTrackRound, Complaint, Farmer, StaffUser } = require('../src/models');
const { execSync } = require('child_process');

async function testCleanIsolation() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('=== BEFORE CLEANUP COUNTS ===');
  const countsBefore = {
    totalTokens: await Token.countDocuments(),
    demoTokens: await Token.countDocuments({ tokenNumber: /^DEMO_/ }),
    nonDemoTokens: await Token.countDocuments({ tokenNumber: { $not: /^DEMO_/ } }),
    totalFarmers: await Farmer.countDocuments(),
    demoFarmers: await Farmer.countDocuments({ phone: /^98000001/ }),
    nonDemoFarmers: await Farmer.countDocuments({ phone: { $not: /^98000001/ } }),
    totalRounds: await FastTrackRound.countDocuments(),
    demoRounds: await FastTrackRound.countDocuments({ roundId: /^DEMO_/ }),
    nonDemoRounds: await FastTrackRound.countDocuments({ roundId: { $not: /^DEMO_/ } }),
    staffUsers: await StaffUser.countDocuments()
  };
  console.log(JSON.stringify(countsBefore, null, 2));

  // Run --clean
  console.log('\nRunning node scripts/seedDemoFlow.js --clean...');
  execSync('node scripts/seedDemoFlow.js --clean', { stdio: 'inherit' });

  console.log('\n=== AFTER CLEANUP COUNTS ===');
  const countsAfter = {
    totalTokens: await Token.countDocuments(),
    demoTokens: await Token.countDocuments({ tokenNumber: /^DEMO_/ }),
    nonDemoTokens: await Token.countDocuments({ tokenNumber: { $not: /^DEMO_/ } }),
    totalFarmers: await Farmer.countDocuments(),
    demoFarmers: await Farmer.countDocuments({ phone: /^98000001/ }),
    nonDemoFarmers: await Farmer.countDocuments({ phone: { $not: /^98000001/ } }),
    totalRounds: await FastTrackRound.countDocuments(),
    demoRounds: await FastTrackRound.countDocuments({ roundId: /^DEMO_/ }),
    nonDemoRounds: await FastTrackRound.countDocuments({ roundId: { $not: /^DEMO_/ } }),
    staffUsers: await StaffUser.countDocuments()
  };
  console.log(JSON.stringify(countsAfter, null, 2));

  const nonDemoPreserved = (
    countsBefore.nonDemoTokens === countsAfter.nonDemoTokens &&
    countsBefore.nonDemoFarmers === countsAfter.nonDemoFarmers &&
    countsBefore.nonDemoRounds === countsAfter.nonDemoRounds &&
    countsBefore.staffUsers === countsAfter.staffUsers &&
    countsAfter.demoTokens === 0 &&
    countsAfter.demoRounds === 0 &&
    countsAfter.demoFarmers === 0
  );

  console.log('\n✅ PROVED: ONLY DEMO_ records removed? ' + (nonDemoPreserved ? 'YES! Zero collateral data loss.' : 'NO'));

  // Re-seed demo flow so demo state remains initialized
  console.log('\nRe-seeding demo flow for testing...');
  execSync('node scripts/seedDemoFlow.js', { stdio: 'inherit' });

  await mongoose.disconnect();
}
testCleanIsolation().catch(console.error);
