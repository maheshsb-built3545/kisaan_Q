/**
 * KisanQ — Database Purge & Clean Seeding Script
 * Run via: npm run db:reset
 */

const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const Token = require('../src/models/Token');
const Farmer = require('../src/models/Farmer');
const Booking = require('../src/models/Booking');
const QueueState = require('../src/models/QueueState');
const ProcurementRecord = require('../src/models/ProcurementRecord');
const Exception = require('../src/models/Exception');

const DEMO_FARMERS = [
  {
    name: 'Mahesh Borde',
    phone: '9876543210',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Kopargaon (Station Road)',
    crop: 'Wheat',
    landArea: 3.5,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-KPG-2026-0811',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Suresh Patil',
    phone: '9876543211',
    preferredLanguage: 'hi',
    registeredVia: 'manual_admin',
    village: 'Shirdi (Nimgaon)',
    crop: 'Soybean',
    landArea: 4.2,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-SRD-2026-0422',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Ganesh Deshmukh',
    phone: '9876543212',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Rahata (Sakori)',
    crop: 'Onion',
    landArea: 2.8,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-RHT-2026-0933',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Ramesh Jadhav',
    phone: '9876543213',
    preferredLanguage: 'mr',
    registeredVia: 'manual_admin',
    village: 'Vaijapur (Shivaji Nagar)',
    crop: 'Cotton',
    landArea: 5.5,
    district: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    kisanId: 'MH-VJP-2026-0155',
    pendingDues: 0,
    cancellationHistory: []
  },
  {
    name: 'Prakash Shinde',
    phone: '9876543214',
    preferredLanguage: 'en',
    registeredVia: 'manual_admin',
    village: 'Shrirampur (Belapur Road)',
    crop: 'Wheat',
    landArea: 3.0,
    district: 'Ahmednagar',
    state: 'Maharashtra',
    kisanId: 'MH-SRP-2026-0788',
    pendingDues: 0,
    cancellationHistory: []
  }
];

async function resetDatabase() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI or MONGO_URI is not set in environment.');
    process.exit(1);
  }
  
  console.log('================================================================');
  console.log('🏛️ KISANQ DATABASE PURGE & DEMO SEEDING UTILITY');
  console.log('================================================================');
  console.log(`Connecting to MongoDB...`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(' Connected to MongoDB Atlas cluster.\n');

    // 1. Purge all dynamic operational collections
    console.log('🧹 Purging operational collections...');
    const tokenDel = await Token.deleteMany({});
    console.log(`  ✓ Tokens cleared: ${tokenDel.deletedCount}`);

    try {
      const bookDel = await Booking.deleteMany({});
      console.log(`  ✓ Bookings cleared: ${bookDel.deletedCount}`);
    } catch (e) {
      console.log(`  ℹ Booking collection skipped: ${e.message}`);
    }

    try {
      const qDel = await QueueState.deleteMany({});
      console.log(`  ✓ Queue states reset: ${qDel.deletedCount}`);
    } catch (e) {
      console.log(`  ℹ QueueState collection skipped: ${e.message}`);
    }

    try {
      const procDel = await ProcurementRecord.deleteMany({});
      console.log(`  ✓ Procurement records cleared: ${procDel.deletedCount}`);
    } catch (e) {
      console.log(`  ℹ ProcurementRecord collection skipped: ${e.message}`);
    }

    try {
      const expDel = await Exception.deleteMany({});
      console.log(`  ✓ Exceptions cleared: ${expDel.deletedCount}`);
    } catch (e) {
      console.log(`  ℹ Exception collection skipped: ${e.message}`);
    }

    // 2. Clear all dues and history for existing farmers
    console.log('\n🧹 Clearing dues & cancellation history for existing farmers...');
    const farmerUpdate = await Farmer.updateMany({}, {
      $set: {
        pendingDues: 0,
        cancellationHistory: []
      }
    });
    console.log(`  ✓ Farmers reset: ${farmerUpdate.modifiedCount}`);

    // 3. Upsert standard demonstration farmers
    console.log('\n🌱 Seeding standard regional demonstration farmers...');
    for (const farmerData of DEMO_FARMERS) {
      await Farmer.findOneAndUpdate(
        { phone: farmerData.phone },
        { $set: farmerData },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Farmer provisioned: ${farmerData.name} (+91 ${farmerData.phone}) - ${farmerData.village} [${farmerData.crop}]`);
    }

    console.log('\n================================================================');
    console.log('✅ DATABASE RESET COMPLETED SUCCESSFULLY!');
    console.log('   All single-active-token locks lifted.');
    console.log('   Demo farmers ready for clean verification.');
    console.log('================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ DATABASE RESET FAILED:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase, DEMO_FARMERS };
