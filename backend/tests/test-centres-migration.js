const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Centre = require('../src/models/Centre');
const centreService = require('../src/services/centreService');

async function testCentresMigrationWithOldPlaceholder() {
  console.log('=== TEST: APMC Centres Migration against Dirty/Pre-existing DB ===');

  // Create isolated in-memory mongo instance simulating a pre-existing dirty DB
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // 1. Insert the old legacy placeholder into the Centre collection
  const oldPlaceholder = {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    name: 'APMC Central Hub - Nagpur',
    location: { type: 'Point', coordinates: [79.0882, 21.1458] },
    cropsHandled: ['Soybean', 'Cotton', 'Wheat', 'Paddy'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green'
  };
  await Centre.create(oldPlaceholder);

  let initialDocs = await Centre.find({}).lean();
  console.log('1. Pre-existing DB documents count:', initialDocs.length);
  console.log('   Pre-existing document name:', initialDocs[0].name);

  // 2. Call getAllCentres() which triggers the safe code-check and ensureOfficialCentres()
  const retrievedCentres = await centreService.getAllCentres();

  console.log('2. Retrieved centres count from getAllCentres():', retrievedCentres.length);

  // 3. Verify that old placeholder was deleted
  const nagpurPlaceholder = await Centre.findOne({ name: /Nagpur/i });
  console.log('3. Legacy Nagpur placeholder exists in DB?', nagpurPlaceholder ? 'YES (FAIL)' : 'NO (PURGED - PASS)');

  // 4. Verify all 6 official codes exist in DB
  const dbDocs = await Centre.find({}).lean();
  console.log('4. Total centres in DB after migration:', dbDocs.length);
  const codes = dbDocs.map(c => c.code);
  console.log('   Centres codes in DB:', codes.join(', '));

  const expectedCodes = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];
  const allPresent = expectedCodes.every(code => codes.includes(code));
  console.log('   All 6 official codes verified in DB:', allPresent ? 'PASS' : 'FAIL');

  await mongoose.disconnect();
  await mongod.stop();
}

testCentresMigrationWithOldPlaceholder().catch(err => {
  console.error('Migration Test Error:', err);
  process.exit(1);
});
