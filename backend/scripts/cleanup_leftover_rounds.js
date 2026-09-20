const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const mongoose = require('mongoose');
const { FastTrackRound, FastTrackBid } = require('../src/models');

const LEFTOVER_ROUNDS = [
  'FTR-2026-1375', // created by test_fasttrack_bidding.js (Scenario 1)
  'FTR-2026-3718', // created by test_fasttrack_bidding.js (Scenario 2)
  'FTR-2026-8276', // created by test_fasttrack_bidding.js (Scenario 3)
  'FTR-2026-9008', // created by test_endpoint_names.js
  'FTR-2026-3998'  // created by test_alias_and_open_security.js
];

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  console.log('================================================================================');
  console.log('🧹 CLEANUP LEFTOVER NON-DEMO FAST-TRACK ROUNDS');
  console.log('================================================================================\n');

  console.log('Target rounds to remove (with creating test origins):');
  LEFTOVER_ROUNDS.forEach(id => console.log(`  • ${id}`));

  const targetDocs = await FastTrackRound.find({ roundId: { $in: LEFTOVER_ROUNDS } }).lean();
  const targetIds = targetDocs.map(d => d._id);

  console.log(`\nFound ${targetDocs.length} matching leftover round documents in DB.`);

  // Delete bids referencing these rounds
  if (targetIds.length > 0) {
    const resBids = await FastTrackBid.deleteMany({ roundId: { $in: targetIds } });
    console.log(`Deleted ${resBids.deletedCount} associated FastTrackBid records.`);
  }

  // Delete ONLY these exact roundIds
  const resRound = await FastTrackRound.deleteMany({ roundId: { $in: LEFTOVER_ROUNDS } });
  console.log(`Deleted ${resRound.deletedCount} leftover FastTrackRound records.`);

  const afterRounds = await FastTrackRound.find({}).lean();
  console.log('\nFastTrackRounds remaining in DB:');
  afterRounds.forEach(r => console.log(`  • ${r.roundId} (${r.status})`));

  await mongoose.disconnect();
}

run().catch(console.error);
