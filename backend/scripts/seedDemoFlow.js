const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const { Farmer, Token, Booking, Waitlist, SlotOffer, FastTrackRound, Complaint, StaffUser } = require('../src/models');

const DEMO_PREFIX = 'DEMO_';
const CENTRE_ID = 'KPG-01';
const MANDI_NAME = 'APMC Kopargaon';

// Demo Farmers Data
const DEMO_FARMERS = [
  { id: '64b8f0a1c1d2e3f4a5b6d101', phone: '9800000101', name: 'Anand Shinde (Demo Farmer 1)', crop: 'Soybean', qty: 25 },
  { id: '64b8f0a1c1d2e3f4a5b6d102', phone: '9800000102', name: 'Balasaheb Thorat (Demo Farmer 2)', crop: 'Soybean', qty: 30 },
  { id: '64b8f0a1c1d2e3f4a5b6d103', phone: '9800000103', name: 'Chandrakant Deshmukh (Demo Farmer 3)', crop: 'Soybean', qty: 40 },
  { id: '64b8f0a1c1d2e3f4a5b6d104', phone: '9800000104', name: 'Dattatray Pawar (Demo Farmer 4)', crop: 'Soybean', qty: 35 },
  { id: '64b8f0a1c1d2e3f4a5b6d105', phone: '9800000105', name: 'Eknath Gaikwad (Demo Farmer 5)', crop: 'Soybean', qty: 20 },
  { id: '64b8f0a1c1d2e3f4a5b6d106', phone: '9800000106', name: 'Fulchand Jadhav (Demo Farmer 6)', crop: 'Wheat', qty: 50 },
  { id: '64b8f0a1c1d2e3f4a5b6d107', phone: '9800000107', name: 'Gajanan Patil (Demo Farmer 7 - Waitlist)', crop: 'Soybean', qty: 25 },
  { id: '64b8f0a1c1d2e3f4a5b6d108', phone: '9800000108', name: 'Haribhau Kale (Demo Farmer 8 - Near No-Show)', crop: 'Soybean', qty: 30 },
  { id: '64b8f0a1c1d2e3f4a5b6d109', phone: '9800000109', name: 'Ishwar More (Demo Farmer 9 - Active Check-In)', crop: 'Soybean', qty: 35 },
];

async function cleanupDemoRecords() {
  console.log('🧹 [DEMO DATA CLEANUP] Removing prior DEMO records...');
  const demoPhones = DEMO_FARMERS.map((f) => f.phone);

  await Token.deleteMany({
    $or: [
      { tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } },
      { phone: { $in: demoPhones } }
    ]
  });

  await Booking.deleteMany({
    $or: [
      { bookingId: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } }
    ]
  });

  await Waitlist.deleteMany({
    $or: [
      { farmerPhone: { $in: demoPhones } },
      { centreId: CENTRE_ID, farmerName: { $regex: /Demo Farmer/i } }
    ]
  });

  await SlotOffer.deleteMany({
    $or: [
      { farmerPhone: { $in: demoPhones } },
      { releasedTokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } }
    ]
  });

  await FastTrackRound.deleteMany({
    $or: [
      { roundId: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { centreId: CENTRE_ID, slotHour: new Date().getHours() }
    ]
  });

  await Complaint.deleteMany({
    $or: [
      { tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } }
    ]
  });

  await Farmer.deleteMany({ phone: { $in: demoPhones } });

  console.log('✨ [DEMO DATA CLEANUP] Prior DEMO records successfully removed.\n');
}

async function seedDemoFlow() {
  console.log('================================================================================');
  console.log('🌱 KISANQ — SEED DEMO FLOW (IDEMPOTENT, DEMO_ PREFIXED, ZERO DB:RESET)');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas.\n');

  const isCleanupOnly = process.argv.includes('--clean') || process.argv.includes('--cleanup');
  await cleanupDemoRecords();

  if (isCleanupOnly) {
    console.log('✅ Cleanup mode completed. Exiting without re-seeding.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  // Slot 30-40 minutes ahead
  const slotDateStr = todayStr;
  const slotAheadStart = new Date(now.getTime() + 35 * 60 * 1000);
  const slotAheadHour = slotAheadStart.getHours();
  const slotAheadFormatted = `${String(slotAheadHour).padStart(2, '0')}:00 - ${String(slotAheadHour + 1).padStart(2, '0')}:00`;

  // 1. Seed Demo Farmers (Registered in farmer directory)
  console.log('1️⃣ Seeding 9 Demo Farmers in Citizen Registry...');
  for (const f of DEMO_FARMERS) {
    await Farmer.create({
      phone: f.phone,
      name: f.name,
      state: 'Maharashtra',
      district: 'Ahmednagar',
      village: 'Kopargaon Rural',
      crop: f.crop,
      landArea: 3.5,
      preferredLanguage: 'mr',
      registeredVia: 'app',
      noSmartphone: false,
      smsSentCount: 0,
      pickupLocation: {
        type: 'Point',
        coordinates: [74.48, 19.88],
        address: 'Kopargaon Farm'
      }
    });
  }
  console.log('   ↳ 9 Demo Farmers registered.\n');

  // 2. Seed 6 Farmers with Confirmed Bookings at Kopargaon (30-40 min ahead)
  console.log(`2️⃣ Seeding 6 Confirmed Bookings at Kopargaon for upcoming slot (${slotAheadFormatted})...`);
  const seededTokens = [];
  for (let i = 0; i < 6; i++) {
    const f = DEMO_FARMERS[i];
    const tokNum = `${DEMO_PREFIX}TK_KPG_2026_${String(101 + i)}`;

    const tokenDoc = await Token.create({
      tokenNumber: tokNum,
      id: tokNum,
      farmerId: f.id,
      farmerName: f.name,
      farmerPhone: f.phone,
      phone: f.phone,
      mandiId: CENTRE_ID,
      mandiCode: 'KPG',
      mandiName: MANDI_NAME,
      crop: f.crop,
      quantity: f.qty,
      quantityBand: f.qty <= 5 ? '0-5q' : f.qty <= 15 ? '5-15q' : '15q+',
      slotDate: slotDateStr,
      slotTime: slotAheadFormatted,
      slotLabel: slotAheadFormatted,
      status: 'BOOKED',
      queuePosition: i + 1,
      estimatedWaitTime: (i + 1) * 12,
      stages: [
        { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in & Security', status: 'Pending', timestamp: null },
        { stageIndex: 1, id: 'QUALITY_GRADING', title: 'Quality Grading & Assaying', status: 'Pending', timestamp: null },
        { stageIndex: 2, id: 'WEIGHBRIDGE', title: 'Digital Weighbridge', status: 'Pending', timestamp: null },
        { stageIndex: 3, id: 'PROCUREMENT', title: 'Procurement Agreement', status: 'Pending', timestamp: null },
        { stageIndex: 4, id: 'PAYOUT', title: 'DBT Settlement', status: 'Pending', timestamp: null }
      ]
    });
    seededTokens.push(tokenDoc);
  }
  console.log('   ↳ 6 Confirmed Bookings created for Farmers 1 through 6.\n');

  // 3. Fast-Track Round in JOINING status (5 Joinable Farmers)
  console.log('3️⃣ Seeding Fast-Track Round in JOINING status at Kopargaon (5 joinable farmers)...');
  const fastTrackRound = await FastTrackRound.create({
    roundId: `${DEMO_PREFIX}FTR_KPG_${todayStr}_H${slotAheadHour}`,
    centreId: CENTRE_ID,
    mandiId: CENTRE_ID,
    mandiName: MANDI_NAME,
    slotDate: slotDateStr,
    slotHour: slotAheadHour,
    status: 'JOINING',
    participants: [],
    candidateQueue: [],
    currentLeader: null,
    reserveFee: 200,
    bidStep: 10,
    bidCeiling: 500,
    capPerHour: 5
  });
  console.log(`   ↳ Fast-Track Round created: ${fastTrackRound.roundId} (Status: JOINING, Reserve: ₹200, Ceiling: ₹500).\n`);

  // 4. One Full Slot with a Waitlisted Farmer (Farmer 7)
  console.log('4️⃣ Seeding Full Slot and Waitlisted Farmer (Farmer 7: 9800000107)...');
  const waitlistFarmer7 = await Waitlist.create({
    farmerId: DEMO_FARMERS[6].id,
    farmerName: DEMO_FARMERS[6].name,
    farmerPhone: DEMO_FARMERS[6].phone,
    centreId: CENTRE_ID,
    mandiId: CENTRE_ID,
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    requestedSlotDate: todayStr,
    requestedSlotTime: '11:00 AM - 01:00 PM',
    priority: 0,
    status: 'WAITING',
    joinedAt: new Date()
  });
  console.log(`   ↳ Farmer 7 waitlisted for 11:00 AM - 01:00 PM full slot at Kopargaon.\n`);

  // 5. One Booking Near No-Show Limit (Farmer 8: 9800000108)
  console.log('5️⃣ Seeding Booking Near No-Show Limit (Farmer 8: 9800000108)...');
  // Slot started 8 minutes ago (Warned 3 mins ago, Grace threshold is 10 mins -> 2 mins remaining)
  const noShowSlotStart = new Date(now.getTime() - 8 * 60 * 1000);
  const noShowSlotHour = noShowSlotStart.getHours();
  const noShowSlotFormatted = `${String(noShowSlotHour).padStart(2, '0')}:00 - ${String(noShowSlotHour + 1).padStart(2, '0')}:00`;

  const noShowToken = await Token.create({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_NOSHOW_08`,
    id: `${DEMO_PREFIX}TK_KPG_NOSHOW_08`,
    farmerId: DEMO_FARMERS[7].id,
    farmerName: DEMO_FARMERS[7].name,
    farmerPhone: DEMO_FARMERS[7].phone,
    phone: DEMO_FARMERS[7].phone,
    mandiId: CENTRE_ID,
    mandiCode: 'KPG',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    slotDate: todayStr,
    slotTime: noShowSlotFormatted,
    slotLabel: noShowSlotFormatted,
    status: 'BOOKED',
    warnedAt: new Date(now.getTime() - 3 * 60 * 1000), // Warned 3 minutes ago
    stages: [
      { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Pending', timestamp: null }
    ]
  });
  console.log(`   ↳ Farmer 8 booking (${noShowToken.tokenNumber}) is at 8m elapsed (WarnedAt set, 2m to grace cancellation).\n`);

  // 6. One Checked-In Active Token for Grievance / Dispute Testing (Farmer 9: 9800000109)
  console.log('6️⃣ Seeding Active Checked-in Token for Grievance Filing (Farmer 9: 9800000109)...');
  const activeToken = await Token.create({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_ACTIVE_09`,
    id: `${DEMO_PREFIX}TK_KPG_ACTIVE_09`,
    farmerId: DEMO_FARMERS[8].id,
    farmerName: DEMO_FARMERS[8].name,
    farmerPhone: DEMO_FARMERS[8].phone,
    phone: DEMO_FARMERS[8].phone,
    mandiId: CENTRE_ID,
    mandiCode: 'KPG',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 35,
    slotDate: todayStr,
    slotTime: '08:00 AM - 11:00 AM',
    status: 'GATE_IN',
    currentStageIndex: 1,
    stages: [
      { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Completed', timestamp: new Date(now.getTime() - 20 * 60 * 1000) },
      { stageIndex: 1, id: 'QUALITY_GRADING', title: 'Quality Grading & Assaying', status: 'In Progress', timestamp: now }
    ]
  });
  console.log(`   ↳ Farmer 9 token (${activeToken.tokenNumber}) is active at QUALITY_GRADING desk for grievance tests.\n`);

  // ---------------------------------------------------------------------------
  // Demo Login Credentials Display (No Secrets)
  // ---------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('📋 DEMO LOGIN CREDENTIALS & SCENARIO GUIDE (DEMO DATA ONLY)');
  console.log('================================================================================');
  console.log(`
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🌾 FARMER LOGINS (Citizen OTP Portal / Farmer Command Center)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • 9800000101 (Farmer 1: Anand Shinde)       -> Confirmed booking, join Fast-Track      │
│ • 9800000102 (Farmer 2: Balasaheb Thorat)   -> Confirmed booking, join Fast-Track      │
│ • 9800000103 (Farmer 3: Chandrakant D.)     -> Confirmed booking, join Fast-Track      │
│ • 9800000104 (Farmer 4: Dattatray Pawar)    -> Confirmed booking, join Fast-Track      │
│ • 9800000105 (Farmer 5: Eknath Gaikwad)     -> Confirmed booking, join Fast-Track (5th)│
│ • 9800000106 (Farmer 6: Fulchand Jadhav)    -> Confirmed booking (Slot 35 min ahead)   │
│ • 9800000107 (Farmer 7: Gajanan Patil)      -> Waitlisted Farmer (Full slot candidate) │
│ • 9800000108 (Farmer 8: Haribhau Kale)      -> Near No-Show (Warned, ~2m to auto-drop) │
│ • 9800000109 (Farmer 9: Ishwar More)        -> Active Checked-in Token (Grievance test)│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🏛️ STAFF LOGINS (Staff Desk & Supervisor Exception Portals)                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • 9800000008 (Kopargaon Mandi Supervisor)   -> Grievance desk, Exception overrides     │
│ • 9800000010 (Resource Planning Officer KPG)-> Fast-track quorum/bid approvals         │
│ • 9800000007 (District Agricultural Admin)  -> District read-only oversight            │
└────────────────────────────────────────────────────────────────────────────────────────┘

💡 Demo Verification Instructions:
  1. Fast-Track Round Demo: Log in with 9800000101 to 9800000105 and click 'Join Auction' on Round ${fastTrackRound.roundId}. When 5th farmer joins, round becomes LIVE.
  2. Grievance Desk Demo: Log in with 9800000109 (Active Token: ${activeToken.tokenNumber}), click 'Report Grievance', file dispute on Quality Assaying. It immediately appears on Supervisor desk (9800000008).
  3. No-Show Auto-Release Demo: Observe token ${noShowToken.tokenNumber} (Farmer 8). Trigger reallocation or wait for grace expiration to watch slot auto-offer to Waitlisted Farmer 7 (9800000107).
  4. Cleanup Command: Run 'node scripts/seedDemoFlow.js --clean' to safely delete all demo records.
`);

  await mongoose.disconnect();
  console.log('✅ Demo flow seeded successfully. Idempotent state initialized.\n');
}

seedDemoFlow().catch((err) => {
  console.error('❌ Error executing seedDemoFlow:', err);
  process.exit(1);
});
