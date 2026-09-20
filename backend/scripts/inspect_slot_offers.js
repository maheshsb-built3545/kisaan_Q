const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const mongoose = require('mongoose');
const { SlotOffer } = require('../src/models');

async function check() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  const byPhone = await SlotOffer.aggregate([
    { $group: { _id: '$farmerPhone', count: { $sum: 1 }, sampleToken: { $first: '$releasedTokenNumber' }, statuses: { $addToSet: '$status' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('Slot offers by farmer phone:');
  console.log(JSON.stringify(byPhone, null, 2));

  const byReleasedToken = await SlotOffer.aggregate([
    { $group: { _id: '$releasedTokenNumber', count: { $sum: 1 }, phones: { $addToSet: '$farmerPhone' }, statuses: { $addToSet: '$status' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('Slot offers by releasedTokenNumber (top 15):');
  console.log(JSON.stringify(byReleasedToken.slice(0, 15), null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
