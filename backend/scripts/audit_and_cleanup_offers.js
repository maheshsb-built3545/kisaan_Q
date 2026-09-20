const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const mongoose = require('mongoose');
const { SlotOffer } = require('../src/models');

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  console.log('================================================================================');
  console.log('🔍 SLOT OFFER RECORDS AUDIT & PREFIX-MATCH CLEANUP');
  console.log('================================================================================\n');

  const beforeTotal = await SlotOffer.countDocuments();
  console.log(`Initial Total SlotOffers in Database: ${beforeTotal}\n`);

  // Grouped query by status, centre, and prefix
  const allOffers = await SlotOffer.find({}).lean();
  const grouped = {};
  for (const o of allOffers) {
    const status = o.status || 'UNKNOWN';
    const centre = o.centreId || o.mandiId || 'UNKNOWN';
    let prefix = 'NO_TOKEN';
    if (o.releasedTokenNumber) {
      if (o.releasedTokenNumber.startsWith('TEST_')) prefix = 'TEST_';
      else if (o.releasedTokenNumber.startsWith('DEMO_')) prefix = 'DEMO_';
      else if (o.releasedTokenNumber.startsWith('KQ-')) prefix = 'KQ-';
      else prefix = o.releasedTokenNumber;
    }
    const key = `status: ${status} | centre: ${centre} | prefix: ${prefix}`;
    grouped[key] = (grouped[key] || 0) + 1;
  }

  console.log('📊 SlotOffer Records Grouped (Status, Centre, Released Token Prefix):');
  for (const [k, count] of Object.entries(grouped)) {
    console.log(`  • ${k} => count: ${count}`);
  }

  // Identify records matching TEST_ prefix or clearly test-created test fixtures
  const testPrefixQuery = {
    $or: [
      { releasedTokenNumber: { $regex: /^TEST_/ } },
      { releasedTokenNumber: 'RELEASED_EXP_SAMPLE' },
      { id: { $regex: /^TEST_/ } },
      { farmerPhone: { $regex: /^TEST_/ } }
    ]
  };

  const testMatchCount = await SlotOffer.countDocuments(testPrefixQuery);
  console.log(`\n🎯 Records strictly matching TEST_ prefix or test sample: ${testMatchCount}`);

  // Perform deletion of ONLY matching test records
  const deleteResult = await SlotOffer.deleteMany(testPrefixQuery);
  console.log(`🧹 Deleted test records: ${deleteResult.deletedCount}`);

  const afterTotal = await SlotOffer.countDocuments();
  console.log(`\n📈 Before Count: ${beforeTotal} | After Count: ${afterTotal} (Removed: ${beforeTotal - afterTotal})`);

  // Check remaining unclear / non-TEST_ records
  const remaining = await SlotOffer.find({}).lean();
  const unclearByPrefix = {};
  for (const o of remaining) {
    let prefix = 'NO_TOKEN';
    if (o.releasedTokenNumber) {
      if (o.releasedTokenNumber.startsWith('DEMO_')) prefix = 'DEMO_';
      else if (o.releasedTokenNumber.startsWith('KQ-')) prefix = 'KQ-';
      else prefix = o.releasedTokenNumber;
    }
    unclearByPrefix[prefix] = (unclearByPrefix[prefix] || 0) + 1;
  }

  console.log('\n📋 Remaining Non-TEST_ Records Summary (by token prefix):');
  for (const [p, c] of Object.entries(unclearByPrefix)) {
    console.log(`  • Prefix "${p}": ${c} records`);
  }

  // Breakdown of KQ- records to show where they came from
  const kqOffers = remaining.filter(o => o.releasedTokenNumber && o.releasedTokenNumber.startsWith('KQ-'));
  const kqByPhone = {};
  for (const o of kqOffers) {
    kqByPhone[o.farmerPhone] = (kqByPhone[o.farmerPhone] || 0) + 1;
  }
  console.log('\n📋 Origin Analysis of KQ- Prefix Records (grouped by recipient phone):');
  for (const [phone, count] of Object.entries(kqByPhone)) {
    console.log(`  • Farmer ${phone}: ${count} offers (Origin: test_fasttrack_bidding runId loop + background job duplication)`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
