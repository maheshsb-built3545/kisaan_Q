const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Centre = require('../src/models/Centre');
const StaffUser = require('../src/models/StaffUser');
const Farmer = require('../src/models/Farmer');

const SEED_CENTRES = [
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    code: 'KPG-01',
    name: 'APMC Kopargaon',
    nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Kopargaon, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4829, 19.8370]
    },
    cropsHandled: ['Wheat', 'Soybean', 'Onion', 'Cotton'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green',
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 60, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 3, durationMinutes: 30 },
      { crop: 'Soybean', maxDailySlots: 40, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d2'),
    code: 'SRD-02',
    name: 'APMC Shirdi',
    nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Shirdi, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4754, 19.7668]
    },
    cropsHandled: ['Wheat', 'Soybean', 'Onion'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Amber',
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 50, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d3'),
    code: 'RHT-03',
    name: 'APMC Rahata',
    nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Rahata, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.4800, 19.7171]
    },
    cropsHandled: ['Wheat', 'Cotton', 'Soybean'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green',
    capacityConfig: [
      { crop: 'Wheat', maxDailySlots: 40, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d4'),
    code: 'VJP-04',
    name: 'APMC Vaijapur',
    nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती',
    district: 'Chhatrapati Sambhajinagar',
    locationName: 'Vaijapur, Chhatrapati Sambhajinagar',
    location: {
      type: 'Point',
      coordinates: [74.8332, 19.9489]
    },
    cropsHandled: ['Onion', 'Wheat', 'Soybean'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Amber',
    capacityConfig: [
      { crop: 'Onion', maxDailySlots: 50, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d5'),
    code: 'SRP-05',
    name: 'APMC Shrirampur',
    nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती',
    district: 'Ahilyanagar',
    locationName: 'Shrirampur, Ahilyanagar',
    location: {
      type: 'Point',
      coordinates: [74.7007, 19.6420]
    },
    cropsHandled: ['Soybean', 'Cotton', 'Wheat'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Red',
    capacityConfig: [
      { crop: 'Soybean', maxDailySlots: 45, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 2, durationMinutes: 30 }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d6'),
    code: 'LSG-06',
    name: 'APMC Lasalgaon',
    nameMarathi: 'लासलगाव कांदा बाजार समिती',
    district: 'Nashik',
    locationName: 'Lasalgaon, Niphad, Nashik',
    location: {
      type: 'Point',
      coordinates: [74.2378, 20.1427]
    },
    cropsHandled: ['Red Onion', 'Wheat', 'Maize'],
    workingHours: { start: '08:00', end: '18:00' },
    currentStatus: 'Green',
    capacityConfig: [
      { crop: 'Red Onion', maxDailySlots: 70, quantityBands: ['0-5q', '5-15q', '15q+'], lanes: 4, durationMinutes: 20 }
    ]
  }
];

async function seedDatabase() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB successfully.');

    // 1. Seed Mandi Centres
    console.log('Seeding Mandi Centres...');
    for (const centreData of SEED_CENTRES) {
      await Centre.findByIdAndUpdate(
        centreData._id,
        centreData,
        { upsert: true, new: true, runValidators: true }
      );
      console.log(`  ✓ Centre seeded: ${centreData.name} [Status: ${centreData.currentStatus}]`);
    }

    // 2. Seed Staff Accounts
    console.log('Seeding Staff Accounts...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const staffSeedData = [
      {
        name: 'supervisor',
        phone: '9800000001',
        role: 'supervisor',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'guard',
        phone: '9800000002',
        role: 'operator',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'weighmaster',
        phone: '9800000003',
        role: 'staff',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'admin',
        phone: '9800000004',
        role: 'district_admin',
        centreId: null,
        passwordHash,
        isActive: true
      }
    ];

    for (const staff of staffSeedData) {
      await StaffUser.findOneAndUpdate(
        { phone: staff.phone },
        staff,
        { upsert: true, new: true }
      );
      console.log(`  ✓ Staff seeded: ${staff.name} [Phone: ${staff.phone}] (Role: ${staff.role})`);
    }

    // 3. Seed Sample Farmer
    console.log('Seeding Sample Farmer...');
    const farmerSeed = {
      phone: '9876543210',
      name: 'रामचंद्र पाटील (Ramchandra Patil)',
      preferredLanguage: 'mr',
      registeredVia: 'app',
      pickupLocation: {
        type: 'Point',
        coordinates: [74.4829, 19.8370],
        address: 'Kopargaon, Ahilyanagar'
      }
    };
    await Farmer.findOneAndUpdate(
      { phone: farmerSeed.phone },
      farmerSeed,
      { upsert: true, new: true }
    );
    console.log(`  ✓ Sample Farmer seeded: ${farmerSeed.name} (${farmerSeed.phone})`);

    console.log('\n✅ Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed: [Name: ' + error.name + '] Message: ' + error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

seedDatabase();
