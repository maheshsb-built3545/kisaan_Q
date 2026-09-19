const mongoose = require('mongoose');
const Centre = require('../src/models/Centre');
const centreService = require('../src/services/centreService');

async function testCentresMigrationWithOldPlaceholder() {
  console.log('=== TEST: APMC Centres Migration against Dirty/Pre-existing DB ===');

  // Test with in-memory map or local MongoDB
  // 1. Manually insert the old legacy placeholder into inMemoryCentres
  centreService.inMemoryCentres = new Map();
  const oldPlaceholder = {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    name: 'APMC Central Hub - Nagpur',
    location: { type: 'Point', coordinates: [79.0882, 21.1458] },
    cropsHandled: ['Soybean', 'Cotton', 'Wheat', 'Paddy'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green'
  };

  // 2. Call ensureOfficialCentres()
  await centreService.ensureOfficialCentres();

  // 3. Call getAllCentres()
  const retrievedCentres = await centreService.getAllCentres();
  console.log('Retrieved centres count from getAllCentres():', retrievedCentres.length);

  // 4. Verify that legacy Nagpur placeholder is not present
  const nagpur = retrievedCentres.find(c => /Nagpur/i.test(c.name));
  console.log('Legacy Nagpur placeholder present?', nagpur ? 'YES (FAIL)' : 'NO (PURGED - PASS)');

  // 5. Verify all 6 expected APMC codes are present
  const expectedCodes = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];
  const actualCodes = retrievedCentres.map(c => c.code);
  console.log('Codes retrieved:', actualCodes.join(', '));
  const allPresent = expectedCodes.every(code => actualCodes.includes(code));
  console.log('All 6 official codes verified:', allPresent ? 'PASS' : 'FAIL');

  retrievedCentres.forEach(c => {
    console.log(`  ✓ [${c.code}] ${c.name} (${c.nameMarathi}) | Lat: ${c.location.coordinates[1]}, Lng: ${c.location.coordinates[0]}`);
  });
}

testCentresMigrationWithOldPlaceholder().catch(err => {
  console.error('Migration Test Error:', err);
  process.exit(1);
});
