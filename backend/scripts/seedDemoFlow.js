const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const { Farmer, Token, Booking, Waitlist, SlotOffer, FastTrackRound, Complaint, StaffUser } = require('../src/models');
const authService = require('../src/services/authService');
const fastTrackConfig = require('../src/config/fastTrackConfig');

const DEMO_PREFIX = 'DEMO_';
const CENTRE_ID = 'KPG-01';
const MANDI_NAME = 'APMC Kopargaon';
const KPG_CENTRE_OBJECT_ID = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');

// Demo Farmers Data (9 Registered Farmers)
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

/**
 * Helper to get date parts in Asia/Kolkata (IST) timezone
 */
function getISTDateParts(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    dateStr: `${map.year}-${map.month}-${map.day}`
  };
}

/**
 * Format 1-hour slot range in standard APMC slot format (e.g. 08:00 AM - 09:00 AM)
 * Handles hour 23 seamlessly (11:00 PM - 12:00 AM)
 */
function formatSlotTimeRange(startHour, durationHours = 1) {
  const formatHour = (h) => {
    const norm = ((h % 24) + 24) % 24;
    const ampm = norm >= 12 ? 'PM' : 'AM';
    const h12 = norm % 12 === 0 ? 12 : norm % 12;
    return `${String(h12).padStart(2, '0')}:00 ${ampm}`;
  };
  return `${formatHour(startHour)} - ${formatHour(startHour + durationHours)}`;
}

/**
 * Format specific hour and minute in standard 12-hour AM/PM format
 */
function formatTimeWithMinutes(hours, minutes) {
  const normHour = ((hours % 24) + 24) % 24;
  const ampm = normHour >= 12 ? 'PM' : 'AM';
  const h12 = normHour % 12 === 0 ? 12 : normHour % 12;
  const hStr = String(h12).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  return `${hStr}:${mStr} ${ampm}`;
}

/**
 * Cleanup prior demo records safely.
 * Deletes ONLY records with DEMO_ prefix or matching DEMO farmer phones.
 */
async function cleanupDemoRecords() {
  console.log('🧹 [DEMO DATA CLEANUP] Removing prior DEMO records (prefix DEMO_ or demo phones)...');
  const demoPhones = DEMO_FARMERS.map((f) => f.phone);

  await Token.deleteMany({
    $or: [
      { tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { id: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } },
      { phone: { $in: demoPhones } }
    ]
  });

  await Booking.deleteMany({
    $or: [
      { bookingId: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } },
      { farmerId: { $in: DEMO_FARMERS.map(f => new mongoose.Types.ObjectId(f.id)) } }
    ]
  });

  await Waitlist.deleteMany({
    $or: [
      { id: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } }
    ]
  });

  await SlotOffer.deleteMany({
    $or: [
      { id: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } },
      { releasedTokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } }
    ]
  });

  await FastTrackRound.deleteMany({
    roundId: { $regex: new RegExp(`^${DEMO_PREFIX}`) }
  });

  await Complaint.deleteMany({
    $or: [
      { complaintId: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } },
      { farmerPhone: { $in: demoPhones } }
    ]
  });

  await Farmer.deleteMany({
    $or: [
      { phone: { $in: demoPhones } },
      { _id: { $in: DEMO_FARMERS.map(f => new mongoose.Types.ObjectId(f.id)) } }
    ]
  });

  console.log('✨ [DEMO DATA CLEANUP] Prior DEMO records successfully removed.\n');
}

async function seedDemoFlow() {
  console.log('================================================================================');
  console.log('🌱 KISANQ — SEED DEMO FLOW (IDEMPOTENT, DEMO_ PREFIXED, ZERO DB:RESET)');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);

  const dbName = mongoose.connection.name;
  console.log(`Connected to database: ${dbName}`);
  if (dbName !== 'kisanq_aveniq') {
    console.error(`❌ Refusing to run: connected to database '${dbName}', expected 'kisanq_aveniq'.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('✅ Database name verified.\n');

  const isCleanupOnly = process.argv.includes('--clean') || process.argv.includes('--cleanup');
  await cleanupDemoRecords();

  if (isCleanupOnly) {
    console.log('✅ Cleanup mode completed. Exiting without re-seeding.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const now = new Date();
  const istNow = getISTDateParts(now);

  // Configurable joining window
  const JOIN_OPEN_MIN = Number(process.env.JOIN_OPEN_MIN) || fastTrackConfig.joiningWindowMinutesBeforeSlot || 45;

  // Upcoming slot is next whole-hour slot (30-60 minutes ahead in IST)
  const slotAheadHour = (istNow.hour + 1) % 24;
  const isNextDay = istNow.hour === 23;
  let slotAheadDateStr = istNow.dateStr;
  if (isNextDay) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    slotAheadDateStr = getISTDateParts(tomorrow).dateStr;
  }
  const slotAheadTimeStr = formatSlotTimeRange(slotAheadHour, 1);

  // Precise slot start date
  const slotAheadStartDate = new Date(now);
  slotAheadStartDate.setHours(slotAheadHour, 0, 0, 0);
  if (isNextDay) slotAheadStartDate.setDate(slotAheadStartDate.getDate() + 1);
  const slotAheadEndDate = new Date(slotAheadStartDate.getTime() + 60 * 60 * 1000);

  // Minutes until slot start
  const minutesUntilSlotStart = Math.round((slotAheadStartDate.getTime() - now.getTime()) / 60000);

  // 1. Seed Demo Farmers (Registered in citizen directory)
  console.log('1️⃣ Seeding 9 Demo Farmers in Citizen Registry...');
  for (const f of DEMO_FARMERS) {
    await Farmer.create({
      _id: new mongoose.Types.ObjectId(f.id),
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

  // 2. Seed 6 Farmers with Confirmed Bookings at Kopargaon (next whole-hour slot)
  console.log(`2️⃣ Seeding 6 Confirmed Bookings at Kopargaon for upcoming slot (${slotAheadDateStr}, ${slotAheadTimeStr})...`);
  const seededTokens = [];
  for (let i = 0; i < 6; i++) {
    const f = DEMO_FARMERS[i];
    const tokNum = `${DEMO_PREFIX}TK_KPG_2026_${String(101 + i)}`;

    // Token record
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
      slotDate: slotAheadDateStr,
      slotTime: slotAheadTimeStr,
      slotLabel: slotAheadTimeStr,
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

    // Booking record
    await Booking.create({
      _id: new mongoose.Types.ObjectId(),
      farmerId: new mongoose.Types.ObjectId(f.id),
      centreId: KPG_CENTRE_OBJECT_ID,
      crop: f.crop,
      quantityBand: f.qty <= 5 ? '0-5q' : f.qty <= 15 ? '5-15q' : '15q+',
      arrivalWindowStart: slotAheadStartDate,
      arrivalWindowEnd: slotAheadEndDate,
      tokenNumber: tokNum,
      status: 'BOOKED',
      channel: 'app'
    });
  }
  console.log('   ↳ 6 Confirmed Bookings created for Farmers 1 through 6 in both Token and Booking collections.\n');

  // 3. Fast-Track Round in JOINING status (Cap 2/hour, 5 minParticipants)
  console.log('3️⃣ Seeding Fast-Track Round in JOINING status at Kopargaon (cap: 2/hr, JOINING, participants: [])...');
  const fastTrackRound = await FastTrackRound.create({
    roundId: `${DEMO_PREFIX}FTR_KPG_${slotAheadDateStr}_H${slotAheadHour}`,
    centreId: CENTRE_ID,
    mandiId: CENTRE_ID,
    mandiName: MANDI_NAME,
    slotDate: slotAheadDateStr,
    slotHour: slotAheadTimeStr,
    status: 'JOINING',
    participants: [],
    candidateQueue: [],
    currentLeader: null,
    reserveFee: 200,
    bidStep: 10,
    bidCeiling: 500,
    capPerHour: 2
  });
  console.log(`   ↳ Fast-Track Round created: ${fastTrackRound.roundId} (Status: JOINING, Reserve: ₹200, Step: ₹10, Ceiling: ₹500, Cap: 2/hr).\n`);

  // 4. One Full Slot with a Waitlisted Farmer (Farmer 7)
  console.log('4️⃣ Seeding Full Slot and Waitlisted Farmer (Farmer 7: 9800000107)...');
  const waitlistFarmer7 = await Waitlist.create({
    id: `${DEMO_PREFIX}WL_KPG_07`,
    farmerId: DEMO_FARMERS[6].id,
    farmerName: DEMO_FARMERS[6].name,
    farmerPhone: DEMO_FARMERS[6].phone,
    centreId: CENTRE_ID,
    mandiId: CENTRE_ID,
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    requestedSlotDate: istNow.dateStr,
    requestedSlotTime: '11:00 AM - 01:00 PM',
    priority: 0,
    status: 'WAITING',
    joinedAt: new Date()
  });
  console.log(`   ↳ Farmer 7 waitlisted for 11:00 AM - 01:00 PM slot at Kopargaon.\n`);

  // 5. One Booking Near No-Show Limit (Farmer 8: 9800000108)
  console.log('5️⃣ Seeding Booking Near No-Show Limit (Farmer 8: 9800000108)...');
  const warnSec = process.env.SLOT_WARN_SEC ? Number(process.env.SLOT_WARN_SEC) : null;
  const graceSec = process.env.SLOT_GRACE_SEC ? Number(process.env.SLOT_GRACE_SEC) : null;
  const offerSec = process.env.SLOT_OFFER_SEC ? Number(process.env.SLOT_OFFER_SEC) : null;

  const warnMs = warnSec !== null ? warnSec * 1000 : (Number(process.env.SLOT_WARN_MINUTES) || 5) * 60 * 1000;
  const graceMs = graceSec !== null ? graceSec * 1000 : (Number(process.env.SLOT_GRACE_MINUTES) || 10) * 60 * 1000;
  const offerMs = offerSec !== null ? offerSec * 1000 : (Number(process.env.SLOT_OFFER_MINUTES) || 10) * 60 * 1000;

  console.log(`   ⏱️ Timer Values: WARN=${warnMs / 1000}s (${warnMs / 60000}m), GRACE=${graceMs / 1000}s (${graceMs / 60000}m), OFFER=${offerMs / 1000}s (${offerMs / 60000}m)`);

  // Target elapsed: graceMs - 120s (~2 minutes remaining before auto-release)
  const remainingBeforeGraceMs = Math.min(120 * 1000, Math.max(30 * 1000, graceMs * 0.2));
  const targetElapsedMs = Math.max(0, graceMs - remainingBeforeGraceMs);
  const noShowSlotStartDate = new Date(now.getTime() - targetElapsedMs);
  const istNoShowStart = getISTDateParts(noShowSlotStartDate);
  const istNoShowEnd = getISTDateParts(new Date(noShowSlotStartDate.getTime() + 60 * 60 * 1000));

  const noShowSlotTimeFormatted = `${formatTimeWithMinutes(istNoShowStart.hour, istNoShowStart.minute)} - ${formatTimeWithMinutes(istNoShowEnd.hour, istNoShowEnd.minute)}`;
  const noShowSlotDateStr = istNoShowStart.dateStr;

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
    slotDate: noShowSlotDateStr,
    slotTime: noShowSlotTimeFormatted,
    slotLabel: noShowSlotTimeFormatted,
    status: 'BOOKED',
    warnedAt: new Date(now.getTime() - Math.max(0, targetElapsedMs - warnMs)),
    stages: [
      { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Pending', timestamp: null }
    ]
  });

  await Booking.create({
    _id: new mongoose.Types.ObjectId(),
    farmerId: new mongoose.Types.ObjectId(DEMO_FARMERS[7].id),
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: noShowSlotStartDate,
    arrivalWindowEnd: new Date(noShowSlotStartDate.getTime() + 60 * 60 * 1000),
    tokenNumber: `${DEMO_PREFIX}TK_KPG_NOSHOW_08`,
    status: 'BOOKED',
    channel: 'app'
  });

  console.log(`   ↳ Farmer 8 booking (${noShowToken.tokenNumber}) at ${noShowSlotTimeFormatted} has elapsed ~${Math.round(targetElapsedMs / 1000)}s (~${Math.round(remainingBeforeGraceMs / 1000)}s until grace auto-release).\n`);

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
    slotDate: istNow.dateStr,
    slotTime: '08:00 AM - 11:00 AM',
    status: 'GATE_IN',
    currentStageIndex: 1,
    stages: [
      { stageIndex: 0, id: 'GATE_CHECKIN', title: 'Gate Check-in', status: 'Completed', timestamp: new Date(now.getTime() - 20 * 60 * 1000) },
      { stageIndex: 1, id: 'QUALITY_GRADING', title: 'Quality Grading & Assaying', status: 'In Progress', timestamp: now }
    ]
  });

  await Booking.create({
    _id: new mongoose.Types.ObjectId(),
    farmerId: new mongoose.Types.ObjectId(DEMO_FARMERS[8].id),
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: new Date(now.getTime() - 30 * 60 * 1000),
    arrivalWindowEnd: new Date(now.getTime() + 30 * 60 * 1000),
    tokenNumber: `${DEMO_PREFIX}TK_KPG_ACTIVE_09`,
    status: 'CHECKED_IN',
    channel: 'app'
  });
  console.log(`   ↳ Farmer 9 token (${activeToken.tokenNumber}) is active at QUALITY_GRADING step for grievance tests.\n`);

  // 7. Verify round appears in GET /api/fasttrack/rounds
  console.log('7️⃣ Verifying round visibility in GET /api/fasttrack/rounds...');
  try {
    const res = await fetch(`http://127.0.0.1:5000/api/fasttrack/rounds?centreId=${CENTRE_ID}`);
    if (res.ok) {
      const body = await res.json();
      const rounds = body?.data?.rounds || [];
      const found = rounds.some((r) => r.roundId === fastTrackRound.roundId);
      console.log(`   ↳ Round ${fastTrackRound.roundId} visible in GET /api/fasttrack/rounds: ${found ? 'YES ✅' : 'NO ❌'}\n`);
    } else {
      console.log(`   ↳ GET /api/fasttrack/rounds responded with HTTP ${res.status}\n`);
    }
  } catch (e) {
    console.log(`   ↳ Note: Local HTTP verification: ${e.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // DEMO RECORDS COUNT VERIFICATION (PER COLLECTION)
  // ---------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('📊 DEMO RECORDS COUNT SUMMARY (PER COLLECTION)');
  console.log('================================================================================');
  const demoPhones = DEMO_FARMERS.map((f) => f.phone);

  const farmerCount = await Farmer.countDocuments({ phone: { $in: demoPhones } });
  const tokenCountNextSlot = await Token.countDocuments({
    tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}TK_KPG_2026_`) },
    status: 'BOOKED'
  });
  const tokenNoShow = await Token.countDocuments({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_NOSHOW_08`,
    status: 'BOOKED'
  });
  const tokenActive = await Token.countDocuments({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_ACTIVE_09`,
    status: 'GATE_IN',
    currentStageIndex: 1
  });
  const totalDemoTokens = await Token.countDocuments({
    $or: [{ tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) } }, { farmerPhone: { $in: demoPhones } }]
  });

  const bookingCountNextSlot = await Booking.countDocuments({
    tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}TK_KPG_2026_`) },
    status: 'BOOKED'
  });
  const bookingNoShow = await Booking.countDocuments({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_NOSHOW_08`,
    status: 'BOOKED'
  });
  const bookingActive = await Booking.countDocuments({
    tokenNumber: `${DEMO_PREFIX}TK_KPG_ACTIVE_09`,
    status: 'CHECKED_IN'
  });
  const totalDemoBookings = await Booking.countDocuments({
    tokenNumber: { $regex: new RegExp(`^${DEMO_PREFIX}`) }
  });

  const roundCount = await FastTrackRound.countDocuments({
    roundId: { $regex: new RegExp(`^${DEMO_PREFIX}`) },
    status: 'JOINING'
  });
  const waitlistCount = await Waitlist.countDocuments({
    farmerPhone: DEMO_FARMERS[6].phone,
    status: 'WAITING'
  });
  const slotOfferCount = await SlotOffer.countDocuments({
    $or: [{ id: { $regex: new RegExp(`^${DEMO_PREFIX}`) } }, { farmerPhone: { $in: demoPhones } }]
  });

  console.log(`• Farmers collection:              ${farmerCount} / 9 expected`);
  console.log(`• Bookings (next whole-hour slot): ${bookingCountNextSlot} / 6 expected`);
  console.log(`• Bookings (no-show Farmer 8):     ${bookingNoShow} / 1 expected`);
  console.log(`• Bookings (active Farmer 9):      ${bookingActive} / 1 expected`);
  console.log(`• Total Bookings collection:       ${totalDemoBookings} / 8 expected`);
  console.log(`• Tokens (next whole-hour slot):   ${tokenCountNextSlot} / 6 expected`);
  console.log(`• Tokens (no-show Farmer 8):       ${tokenNoShow} / 1 expected`);
  console.log(`• Tokens (active assaying Farmer 9): ${tokenActive} / 1 expected`);
  console.log(`• Total Tokens collection:         ${totalDemoTokens} / 8 expected`);
  console.log(`• FastTrackRounds (JOINING):       ${roundCount} / 1 expected`);
  console.log(`• Waitlist (Farmer 7):             ${waitlistCount} / 1 expected`);
  console.log(`• SlotOffers (initial):            ${slotOfferCount} / 0 expected before reallocation cycle`);

  // ---------------------------------------------------------------------------
  // JOINING WINDOW METRICS & WARNING
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('⏱️ JOINING WINDOW CONFIGURATION & STATUS');
  console.log('================================================================================');
  console.log(`• JOIN_OPEN_MIN config:       ${JOIN_OPEN_MIN} minutes`);
  console.log(`• Next slot start time:       ${slotAheadDateStr} ${slotAheadTimeStr}`);
  console.log(`• Actual minutes until slot:  ${minutesUntilSlotStart} minutes`);
  if (minutesUntilSlotStart > JOIN_OPEN_MIN) {
    console.warn(`⚠️ WARNING: The joining window is currently CLOSED (${minutesUntilSlotStart}m until slot > ${JOIN_OPEN_MIN}m window). Farmers can only join within ${JOIN_OPEN_MIN} minutes of slot start.`);
  } else {
    console.log(`✅ Joining window is OPEN (${minutesUntilSlotStart}m until slot <= ${JOIN_OPEN_MIN}m window). Fast-track bids/joins allowed.`);
  }

  // ---------------------------------------------------------------------------
  // Demo Login Credentials & Authentication Guide (Demo Data Only - No Secrets)
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('📋 DEMO LOGIN CREDENTIALS & AUTHENTICATION GUIDE (NO SECRETS)');
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
│ 🏛️ SEEDED OFFICIAL STAFF LOGINS (Real Kopargaon APMC Staff Registry)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • 9800000007 (V. Pawar — Mandi Supervisor)   -> Grievances, Exception overrides        │
│ • 9800000006 (P. Kulkarni — Resource Officer)-> Fast-track approvals & capacity mgmt   │
│ • 9800000008 (Collector Nagar — Dist Admin)  -> District read-only oversight           │
└────────────────────────────────────────────────────────────────────────────────────────┘

🔐 HOW FARMERS LOG IN (NO SMS GATEWAY KEY REQUIRED):
  1. Open Farmer Command Center / Login (Farmer Area).
  2. Enter any registered 10-digit farmer mobile (e.g. 9800000101).
  3. When no SMS gateway API key is configured, the server generates a mock OTP which is:
     - Included in the API response: response.data.devOtp
     - Printed directly to backend server console logs: "[Farmer SMS Dispatch] OTP for +91...: XXXXXX"
     - Universal magic dev bypass OTPs: '123456', '999999', or '111111' can also be entered directly.
  4. Authentication yields a signed farmer JWT stored in 'kisanq_farmer_token'.

🔐 HOW STAFF LOG IN & 2FA WORK:
  1. Open Staff Portal (/staff/login).
  2. Step 1 (Credential verification):
     - Enter Mobile Number: 9800000006 (Resource Officer), 9800000007 (Supervisor), or 9800000008 (District Admin)
     - Select Role matching assigned station ('resource_officer', 'supervisor', 'district_admin')
     - Enter Administrative Password: 'Staff@KisanQ2026'
     - Server issues a 2-minute 2FA challenge token.
  3. Step 2 (2FA OTP verification):
     - Enter standard dev/mock OTP: '123456'
     - Server verifies challenge session and issues an 8-hour JWT sealed with officer role & station claims.
     - Token stored in isolated 'kisanq_staff_token' storage key (no fallback to farmer).

💡 Demo Verification Flow:
  1. Fast-Track: Log in as Farmers 1-5 (9800000101-9800000105) and join round ${fastTrackRound.roundId}.
     When 5th farmer joins, round automatically becomes LIVE.
  2. Grievance: Log in as Farmer 9 (9800000109), file grievance on active token ${activeToken.tokenNumber}.
     Log in as Supervisor (9800000007) to view and resolve grievance.
  3. No-Show Auto-Release: Token ${noShowToken.tokenNumber} (Farmer 8) will hit grace expiry in ~2 mins.
     Slot automatically released and offered to Waitlisted Farmer 7 (9800000107).
  4. Cleanup: Run 'node scripts/seedDemoFlow.js --clean' to safely delete all demo records.
`);

  if (require.main === module) {
    await mongoose.disconnect();
  }
  console.log('✅ Demo flow seeded successfully. Idempotent state initialized.\n');
}

if (require.main === module) {
  seedDemoFlow().catch((err) => {
    console.error('❌ Error executing seedDemoFlow:', err);
    process.exit(1);
  });
}

module.exports = { seedDemoFlow };
