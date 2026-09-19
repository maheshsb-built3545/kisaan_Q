const mongoose = require('mongoose');
const models = require('../models');

console.log('--- Verifying KisanQ Mongoose Models ---');

const expectedModels = [
  'Farmer',
  'Centre',
  'Booking',
  'QueueState',
  'ProcurementRecord',
  'StaffUser',
  'AuditLog',
  'Notification',
  'Exception'
];

let allValid = true;

expectedModels.forEach((modelName) => {
  const Model = models[modelName];
  if (!Model || !Model.schema) {
    console.error(`❌ Model ${modelName} is missing or has no schema!`);
    allValid = false;
  } else {
    const indexes = Model.schema.indexes();
    console.log(`✅ Model ${modelName} loaded successfully (${indexes.length} custom index definitions)`);
  }
});

if (allValid) {
  console.log('\n✨ All 9 KisanQ models verified successfully with 0 errors.');
  process.exit(0);
} else {
  console.error('\n❌ Model verification failed.');
  process.exit(1);
}
