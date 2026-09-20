'use strict';

/**
 * seedShowcase.js — Realistic Pilot Showcase Data Engine for KisanQ-Aveniq
 *
 * Requirements:
 * 1. DB Safety Check: Refuses to run unless target database is 'kisanq_aveniq'.
 * 2. Non-invasive marking: Every seeded doc tagged with seedBatch: 'showcase-1'.
 * 3. Reserved Farmer Phones: 9800100000 - 9800199999.
 * 4. Realistic Marathi/Hindi Names, Real Vehicle Plates (MH-17-...), Real Villages, Real Tokens (KQ-KPG-2026-XXXX).
 * 5. Zero "demo"/"test" wording in any user-visible fields.
 * 6. Supports: --clean, --live (re-times time-sensitive scenarios), default (idempotent seed).
 * 7. Writes SHOWCASE_LOGINS.md (git-ignored, no secrets).
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const {
  Farmer, Centre, Booking, QueueState, ProcurementRecord, StaffUser,
  AuditLog, Notification, Exception, Token, CropPrice, Waitlist,
  SlotOffer, Complaint, FastTrackRound, FastTrackBid, Resource,
  Availability, CentreEvent, SlotCap, ForecastSnapshot, PlanRequest,
  RedirectOffer, InboundQuota, Broadcast
} = require('../src/models');

const SEED_BATCH = 'showcase-1';
const MANDI_ID = 'KPG-01';
const MANDI_NAME = 'APMC Kopargaon';
const KPG_CENTRE_OBJECT_ID = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');

// Reserved Showcase Farmer Phones
const SHOWCASE_PHONES = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);

// Officer Names (Realistic & Neutral)
const OFFICERS = {
  gate: { name: 'Ramesh Shinde', role: 'security_gate', code: 'SEC-D1-KPG', phone: '9800000001' },
  assayer: { name: 'S. Patil', role: 'quality_assayer', code: 'QA-SP-KPG', phone: '9800000002' },
  weighmaster: { name: 'Suresh Jadhav', role: 'weighmaster', code: 'WM-02-KPG', phone: '9800000003' },
  procurement: { name: 'Secretary Deshmukh', role: 'procurement', code: 'SEC-APMC-KPG', phone: '9800000004' },
  finance: { name: 'Treasury Officer Kale', role: 'accounts_settlement', code: 'ACC-TR-KPG', phone: '9800000005' },
  officer: { name: 'P. Kulkarni', role: 'resource_officer', code: 'RPO-PK-KPG', phone: '9800000006' },
  supervisor: { name: 'V. Pawar', role: 'supervisor', code: 'SUP-VP-KPG', phone: '9800000007' },
  admin: { name: 'District Collector Ahilyanagar', role: 'district_admin', code: 'DIST-ADMIN-AH', phone: '9800000008' }
};

// 15 Realistic Farmer Profiles
const FARMERS = [
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e101'),
    phone: '9800100001',
    name: 'Ramesh Kadam',
    village: 'Kolpewadi',
    crop: 'Soybean',
    landArea: 4.5,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-BY-5124',
    pickupLocation: { type: 'Point', coordinates: [74.4789, 19.8824], address: 'Kolpewadi, Kopargaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e102'),
    phone: '9800100002',
    name: 'Sunil Shinde',
    village: 'Kolpewadi',
    crop: 'Soybean',
    landArea: 3.8,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-CK-8890',
    pickupLocation: { type: 'Point', coordinates: [74.4798, 19.8835], address: 'Kolpewadi, Kopargaon' }, // ~160m from Ramesh
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e103'),
    phone: '9800100003',
    name: 'Dattatray Pawar',
    village: 'Pohegaon',
    crop: 'Soybean',
    landArea: 5.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-AJ-1122',
    pickupLocation: { type: 'Point', coordinates: [74.4950, 19.8980], address: 'Pohegaon, Kopargaon' }, // > 2km from Ramesh
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e104'),
    phone: '9800100004',
    name: 'Vikas Deshmukh',
    village: 'Sanvatsar',
    crop: 'Soybean',
    landArea: 6.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-BX-3344',
    pickupLocation: { type: 'Point', coordinates: [74.4600, 19.8700], address: 'Sanvatsar, Kopargaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e105'),
    phone: '9800100005',
    name: 'Suresh Patil',
    village: 'Dodi',
    crop: 'Soybean',
    landArea: 3.5,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-DH-5566',
    pickupLocation: { type: 'Point', coordinates: [74.4400, 19.8500], address: 'Dodi, Kopargaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e106'),
    phone: '9800100006',
    name: 'Balasaheb Thorat',
    village: 'Yesgaon',
    crop: 'Wheat',
    landArea: 7.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-EF-7788',
    pickupLocation: { type: 'Point', coordinates: [74.5200, 19.8200], address: 'Yesgaon, Kopargaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e107'),
    phone: '9800100007',
    name: 'Eknath Gaikwad',
    village: 'Shirdi',
    crop: 'Soybean',
    landArea: 4.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-GH-9900',
    pickupLocation: { type: 'Point', coordinates: [74.4754, 19.7668], address: 'Shirdi, Ahilyanagar' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e108'),
    phone: '9800100008',
    name: 'Haribhau Kale',
    village: 'Sakuri',
    crop: 'Soybean',
    landArea: 3.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-JK-1234',
    pickupLocation: { type: 'Point', coordinates: [74.4600, 19.7500], address: 'Sakuri, Rahata' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e109'),
    phone: '9800100009',
    name: 'Ishwar More',
    village: 'Loni',
    crop: 'Onion',
    landArea: 5.5,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-LM-5678',
    pickupLocation: { type: 'Point', coordinates: [74.4900, 19.5900], address: 'Loni, Rahata' },
    noSmartphone: false,
    pendingDues: 250
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e110'),
    phone: '9800100010',
    name: 'Gajanan Jadhav',
    village: 'Vaijapur',
    crop: 'Cotton',
    landArea: 6.8,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-20-AB-5678',
    pickupLocation: { type: 'Point', coordinates: [74.8332, 19.9489], address: 'Vaijapur, Sambhajinagar' },
    noSmartphone: true,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e111'),
    phone: '9800100011',
    name: 'Anand Jagtap',
    village: 'Shrirampur',
    crop: 'Soybean',
    landArea: 4.8,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-QR-7890',
    pickupLocation: { type: 'Point', coordinates: [74.7007, 19.6420], address: 'Shrirampur' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e112'),
    phone: '9800100012',
    name: 'Prakash Sonawane',
    village: 'Lasalgaon',
    crop: 'Red Onion',
    landArea: 8.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-15-NP-3456',
    pickupLocation: { type: 'Point', coordinates: [74.2378, 20.1427], address: 'Lasalgaon, Niphad' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e113'),
    phone: '9800100013',
    name: 'Kishor Ghadge',
    village: 'Kopargaon',
    crop: 'Soybean',
    landArea: 3.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-ST-2345',
    pickupLocation: { type: 'Point', coordinates: [74.4829, 19.8370], address: 'Kopargaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e114'),
    phone: '9800100014',
    name: 'Santosh Navale',
    village: 'Shirdi',
    crop: 'Wheat',
    landArea: 4.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-UV-6789',
    pickupLocation: { type: 'Point', coordinates: [74.4754, 19.7668], address: 'Shirdi' },
    noSmartphone: true,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e115'),
    phone: '9800100015',
    name: 'Pandurang Bhalerao',
    village: 'Rahata',
    crop: 'Soybean',
    landArea: 5.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-WX-0123',
    pickupLocation: { type: 'Point', coordinates: [74.4800, 19.7171], address: 'Rahata' },
    noSmartphone: false,
    pendingDues: 0
  }
];

// Helper: Timing calculations in IST
function getTimingContext(baseDate = new Date()) {
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = istFormatter.formatToParts(baseDate);
  const m = {};
  for (const p of parts) m[p.type] = p.value;

  const currentHour = parseInt(m.hour, 10);
  const currentMinute = parseInt(m.minute, 10);
  const dateStr = `${m.year}-${m.month}-${m.day}`;

  // Next whole-hour slot
  const nextHour = (currentHour + 1) % 24;
  const nextHourEnd = (nextHour + 1) % 24;

  const formatHour12 = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:00 ${period}`;
  };

  const slotLabel = `${formatHour12(nextHour)} - ${formatHour12(nextHourEnd)}`;

  // Exact Date boundaries for slot
  const slotStart = new Date(baseDate);
  slotStart.setMinutes(0, 0, 0);
  slotStart.setHours(slotStart.getHours() + 1);

  const slotEnd = new Date(slotStart);
  slotEnd.setHours(slotEnd.getHours() + 1);

  const minutesUntilSlot = Math.max(0, Math.round((slotStart.getTime() - baseDate.getTime()) / 60000));

  return {
    now: baseDate,
    dateStr,
    currentHour,
    currentMinute,
    nextHour,
    slotLabel,
    slotStart,
    slotEnd,
    minutesUntilSlot
  };
}

// 5-Stage Token Template Builder
function build5Stages({
  gateStatus = 'Pending',
  gateTime = null,
  assayStatus = 'Pending',
  assayTime = null,
  grade = 'A',
  moisture = '10.8%',
  weighStatus = 'Pending',
  weighTime = null,
  netWeight = '30.00 Q',
  procStatus = 'Pending',
  procTime = null,
  payoutStatus = 'Pending',
  payoutTime = null
} = {}) {
  return [
    {
      stageIndex: 0,
      id: 'GATE_CHECKIN',
      title: 'Gate Check-In & ANPR Intake',
      label: 'Gate In',
      shortLabel: 'Gate',
      officerName: OFFICERS.gate.name,
      officer: OFFICERS.gate.name,
      officerRole: 'security_gate',
      officerCode: OFFICERS.gate.code,
      status: gateStatus,
      timestamp: gateTime,
      completedAt: gateStatus === 'Completed' ? gateTime : null,
      officerSigId: gateStatus === 'Completed' ? `SIG-${OFFICERS.gate.code}-${Date.now().toString(36)}` : null,
      details: { lane: 'Gate 01 - North Boom Barrier', barrierAction: gateStatus === 'Completed' ? 'OPEN' : 'CLOSED' }
    },
    {
      stageIndex: 1,
      id: 'QUALITY_GRADING',
      title: 'Assaying Lab #2 (NIR Moisture)',
      label: 'Assaying',
      shortLabel: 'Lab',
      officerName: OFFICERS.assayer.name,
      officer: OFFICERS.assayer.name,
      officerRole: 'quality_assayer',
      officerCode: OFFICERS.assayer.code,
      status: assayStatus,
      timestamp: assayTime,
      completedAt: assayStatus === 'Completed' ? assayTime : null,
      officerSigId: assayStatus === 'Completed' ? `SIG-${OFFICERS.assayer.code}-${Date.now().toString(36)}` : null,
      grade: assayStatus === 'Completed' ? grade : null,
      details: { moisturePercentage: moisture, gradeResult: grade, method: 'NIR Optical Spectrometry' }
    },
    {
      stageIndex: 2,
      id: 'WEIGHBRIDGE',
      title: 'Pitless Electronic Weighbridge #1',
      label: 'Weighbridge',
      shortLabel: 'Scale',
      officerName: OFFICERS.weighmaster.name,
      officer: OFFICERS.weighmaster.name,
      officerRole: 'weighmaster',
      officerCode: OFFICERS.weighmaster.code,
      status: weighStatus,
      timestamp: weighTime,
      completedAt: weighStatus === 'Completed' ? weighTime : null,
      officerSigId: weighStatus === 'Completed' ? `SIG-${OFFICERS.weighmaster.code}-${Date.now().toString(36)}` : null,
      weight: weighStatus === 'Completed' ? netWeight : null,
      details: { scaleId: 'WB-01-60MT', gross: '34.20 Q', tare: '4.20 Q', net: netWeight }
    },
    {
      stageIndex: 3,
      id: 'PROCUREMENT',
      title: 'APMC Secretary Procurement Terminal',
      label: 'Procurement',
      shortLabel: 'Deed',
      officerName: OFFICERS.procurement.name,
      officer: OFFICERS.procurement.name,
      officerRole: 'procurement',
      officerCode: OFFICERS.procurement.code,
      status: procStatus,
      timestamp: procTime,
      completedAt: procStatus === 'Completed' ? procTime : null,
      officerSigId: procStatus === 'Completed' ? `SIG-${OFFICERS.procurement.code}-${Date.now().toString(36)}` : null,
      details: { statutoryPricePerQ: '₹4,892', totalBillAmount: '₹1,46,760' }
    },
    {
      stageIndex: 4,
      id: 'PAYOUT',
      title: 'Direct Benefit Transfer (DBT) Treasury Desk',
      label: 'DBT Payout',
      shortLabel: 'Treasury',
      officerName: OFFICERS.finance.name,
      officer: OFFICERS.finance.name,
      officerRole: 'accounts_settlement',
      officerCode: OFFICERS.finance.code,
      status: payoutStatus,
      timestamp: payoutTime,
      completedAt: payoutStatus === 'Completed' ? payoutTime : null,
      officerSigId: payoutStatus === 'Completed' ? `SIG-${OFFICERS.finance.code}-${Date.now().toString(36)}` : null,
      details: { pfmsBatchId: 'PFMS-MH-2026-9921', bankRefNumber: 'SBI-DBT-2026-8812' }
    }
  ];
}

// Ensure Database connection & Verify DB Name
async function connectAndVerifyDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  }
  const dbName = mongoose.connection.name || mongoose.connection.db?.databaseName;
  if (!dbName || !dbName.includes('kisanq_aveniq')) {
    throw new Error(`[SAFETY REFUSAL] seedShowcase refuses to run on database '${dbName}'. Target MUST be 'kisanq_aveniq'.`);
  }
  console.log(`🟢 Connected to MongoDB safely: Database '${dbName}' verified.`);
  return dbName;
}

// Get collection counts for reporting
async function getCollectionCounts() {
  return {
    Farmers: await Farmer.countDocuments({ seedBatch: SEED_BATCH }),
    Bookings: await Booking.countDocuments({ seedBatch: SEED_BATCH }),
    Tokens: await Token.countDocuments({ seedBatch: SEED_BATCH }),
    Waitlist: await Waitlist.countDocuments({ seedBatch: SEED_BATCH }),
    SlotOffers: await SlotOffer.countDocuments({ seedBatch: SEED_BATCH }),
    FastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: SEED_BATCH }),
    FastTrackBids: await FastTrackBid.countDocuments({ seedBatch: SEED_BATCH }),
    Complaints: await Complaint.countDocuments({ seedBatch: SEED_BATCH }),
    Exceptions: await Exception.countDocuments({ seedBatch: SEED_BATCH }),
    Notifications: await Notification.countDocuments({ seedBatch: SEED_BATCH }),
    ProcurementRecords: await ProcurementRecord.countDocuments({ seedBatch: SEED_BATCH }),
    AuditLogs: await AuditLog.countDocuments({ seedBatch: SEED_BATCH }),
    CropPrices: await CropPrice.countDocuments({ seedBatch: SEED_BATCH }),
    Resources: await Resource.countDocuments({ seedBatch: SEED_BATCH }),
    Availability: await Availability.countDocuments({ seedBatch: SEED_BATCH }),
    CentreEvents: await CentreEvent.countDocuments({ seedBatch: SEED_BATCH }),
    SlotCaps: await SlotCap.countDocuments({ seedBatch: SEED_BATCH }),
    ForecastSnapshots: await ForecastSnapshot.countDocuments({ seedBatch: SEED_BATCH }),
    PlanRequests: await PlanRequest.countDocuments({ seedBatch: SEED_BATCH }),
    RedirectOffers: await RedirectOffer.countDocuments({ seedBatch: SEED_BATCH }),
    InboundQuotas: await InboundQuota.countDocuments({ seedBatch: SEED_BATCH }),
    Broadcasts: await Broadcast.countDocuments({ seedBatch: SEED_BATCH })
  };
}

// CLEANUP: Removes ONLY seedBatch: 'showcase-1' or reserved phone documents + legacy DEMO_ records
async function cleanShowcaseData() {
  await connectAndVerifyDb();
  console.log('\n🧹 [CLEANUP] Gathering collection counts before deletion...');
  const before = await getCollectionCounts();

  const farmerFilter = {
    $or: [{ seedBatch: SEED_BATCH }, { phone: { $in: SHOWCASE_PHONES } }]
  };
  const tokenFilter = {
    $or: [
      { seedBatch: SEED_BATCH },
      { farmerPhone: { $in: SHOWCASE_PHONES } },
      { tokenNumber: { $regex: /^DEMO_/ } },
      { tokenNumber: { $regex: /^KQ-(KPG|SRD|RHT)-2026-(10|62|30|31|32|33|34|35|40|50|60|20)/ } }
    ]
  };
  const bookingFilter = {
    $or: [
      { seedBatch: SEED_BATCH },
      { tokenNumber: { $regex: /^DEMO_/ } },
      { tokenNumber: { $regex: /^KQ-(KPG|SRD|RHT)-2026-(10|62|30|31|32|33|34|35|40|50|60|20)/ } }
    ]
  };
  const genericBatchFilter = {
    $or: [{ seedBatch: SEED_BATCH }, { updatedBy: 'DEMO_SEED' }, { createdBy: 'DEMO_SEED' }, { setBy: 'DEMO_SEED' }]
  };

  await Farmer.deleteMany(farmerFilter);
  await Token.deleteMany(tokenFilter);
  await Booking.deleteMany(bookingFilter);
  await Waitlist.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { farmerPhone: { $regex: /^98000001/ } }] });
  await SlotOffer.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { farmerPhone: { $regex: /^98000001/ } }] });
  await FastTrackRound.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { roundId: { $regex: /^DEMO_/ } }] });
  await FastTrackBid.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { tokenNumber: { $regex: /^DEMO_/ } }] });
  await Complaint.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { complaintId: { $regex: /^DEMO_/ } }] });
  await Exception.deleteMany({ seedBatch: SEED_BATCH });
  await Notification.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { recipientId: { $in: SHOWCASE_PHONES } }] });
  await ProcurementRecord.deleteMany({ seedBatch: SEED_BATCH });
  await AuditLog.deleteMany({ seedBatch: SEED_BATCH });
  await CropPrice.deleteMany({ seedBatch: SEED_BATCH });
  await Resource.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await Availability.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await CentreEvent.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await SlotCap.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await ForecastSnapshot.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await PlanRequest.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { fromCentre: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await RedirectOffer.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerId: { $in: SHOWCASE_PHONES } }] });
  await InboundQuota.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });
  await Broadcast.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { centreId: { $in: ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'] } }] });

  // Sanitize legacy DEMO markers from existing Centre & Staff records
  const allCentres = await Centre.find({});
  for (const c of allCentres) {
    if (c.name && /\[KISANQ_DEMO_SEED\]/i.test(c.name)) {
      c.name = c.name.replace(/\s*\[KISANQ_DEMO_SEED\]/gi, '').trim();
      await c.save();
    }
  }

  const allStaff = await StaffUser.find({});
  for (const s of allStaff) {
    if (s.name && /\[KISANQ_DEMO_SEED\]/i.test(s.name)) {
      s.name = s.name.replace(/\s*\[KISANQ_DEMO_SEED\]/gi, '').trim();
      await s.save();
    }
  }

  console.log('✨ [CLEANUP] Targeted showcase documents removed cleanly.');
  const after = await getCollectionCounts();

  console.log('\n📊 [BEFORE / AFTER CLEANUP COUNTS]');
  for (const [key, count] of Object.entries(before)) {
    console.log(`  • ${key.padEnd(20)}: ${count} -> ${after[key]}`);
  }
}

// LIVE RE-TIMER: Re-times ONLY time-sensitive scenarios right before presentations
async function liveReTime() {
  await connectAndVerifyDb();
  console.log('\n⚡ [LIVE RE-TIMER] Re-timing presentation scenarios relative to CURRENT CLOCK...');

  const t = getTimingContext(new Date());
  const joinOpenMin = parseInt(process.env.FAST_TRACK_JOIN_OPEN_MIN || '45', 10);
  const warnSeconds = parseInt(process.env.SLOT_WARN_TIMER_SECONDS || '300', 10);
  const graceSeconds = parseInt(process.env.SLOT_GRACE_TIMER_SECONDS || '600', 10);
  const offerTtlSeconds = parseInt(process.env.SLOT_OFFER_TTL_SECONDS || '600', 10);

  console.log(`  ⚙️  Configured Timers: JOIN_OPEN_MIN=${joinOpenMin}m | WARN=${warnSeconds}s | GRACE=${graceSeconds}s | OFFER_TTL=${offerTtlSeconds}s`);
  console.log(`  🕒 Current IST Time:  ${t.dateStr} ${String(t.currentHour).padStart(2, '0')}:${String(t.currentMinute).padStart(2, '0')}`);
  console.log(`  🎯 Target Next Slot:  ${t.slotLabel} (Starts in ${t.minutesUntilSlot} minutes)`);

  // 1. Re-time Upcoming Confirmed Bookings (Ramesh Kadam & slot group)
  await Booking.updateMany(
    { seedBatch: SEED_BATCH, status: 'BOOKED', tokenNumber: { $in: ['KQ-KPG-2026-6285', 'KQ-KPG-2026-6281', 'KQ-KPG-2026-6282', 'KQ-KPG-2026-6283', 'KQ-KPG-2026-6284'] } },
    { $set: { arrivalWindowStart: t.slotStart, arrivalWindowEnd: t.slotEnd } }
  );
  await Token.updateMany(
    { seedBatch: SEED_BATCH, tokenNumber: { $in: ['KQ-KPG-2026-6285', 'KQ-KPG-2026-6281', 'KQ-KPG-2026-6282', 'KQ-KPG-2026-6283', 'KQ-KPG-2026-6284'] } },
    { $set: { slotDate: t.dateStr, slotTime: t.slotLabel } }
  );

  // 2. Re-time Fast-Track Round in JOINING
  await FastTrackRound.updateOne(
    { seedBatch: SEED_BATCH, roundId: 'FTR-KPG-2026-8001' },
    { $set: { slotDate: t.dateStr, slotHour: t.slotLabel, status: 'JOINING' } }
  );

  // 3. Re-time No-Show Booking near Grace Expiry (~2 mins remain until auto-release)
  const noShowElapsed = graceSeconds - 120; // 8 minutes into 10-minute grace
  const noShowCreated = new Date(Date.now() - noShowElapsed * 1000);
  const noShowWarned = new Date(Date.now() - (noShowElapsed - warnSeconds) * 1000);
  await Token.updateOne(
    { seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6280' },
    { $set: { createdAt: noShowCreated, warnedAt: noShowWarned, status: 'Booked' } }
  );

  // 4. Re-time Waitlist Offer Expiration (~8 mins remain)
  const offerExpiresAt = new Date(Date.now() + 8 * 60 * 1000);
  await SlotOffer.updateOne(
    { seedBatch: SEED_BATCH, id: 'OFFER-KPG-2026-9001' },
    { $set: { offeredAt: new Date(), expiresAt: offerExpiresAt, status: 'PENDING' } }
  );

  console.log('\n✅ [LIVE RE-TIMER COMPLETE]');
  console.log(`  • Fast-Track Joining Window: ${t.minutesUntilSlot}m until slot (${t.minutesUntilSlot <= joinOpenMin ? 'OPEN' : 'CLOSES IN ' + (t.minutesUntilSlot - joinOpenMin) + 'm'})`);
  console.log('  • No-Show Auto-Release Token (KQ-KPG-2026-6280): ~2 minutes until grace expiration');
  console.log('  • Waitlist Slot Offer (OFFER-KPG-2026-9001): 8 minutes remaining before expiry');
}

// Write SHOWCASE_LOGINS.md (git-ignored, zero secrets)
function writeShowcaseLoginsDoc() {
  const docPath = path.join(__dirname, '../../SHOWCASE_LOGINS.md');
  const content = `# KisanQ Operational Showcase Logins & Verification Guide

This document outlines the demonstration accounts seeded by \`npm run showcase:seed\`.
All test and citizen authentication utilizes standard mock OTPs / dev bypasses (no secrets).

---

## 🌾 Farmer Hero Login (Ramesh Kadam)

| Field | Value | Description |
|---|---|---|
| **Mobile Number** | \`9800100001\` | Citizen Login at \`/farmer-login\` |
| **Farmer Name** | Ramesh Kadam | Soybean Farmer, Kolpewadi, Kopargaon |
| **Language** | Marathi (\`mr\`) / English | Bilingual notifications & interface |
| **Mock OTP** | \`123456\` (or dev OTP returned) | Universal development bypass |

### What Ramesh Kadam's Account Showcases:
1. **3 Past Completed Procurements**: All 5 checkpoint signatures (Gate, Lab, Scale, Deed, Payout), statutory receipts, weighment cards, and DBT Payout status (\`PAID\`).
2. **1 Completed Procurement (Payout Pending)**: Fully weighed & assayed, bill generated, DBT payout pending.
3. **1 Upcoming Confirmed Booking Today**: Scheduled for the next whole-hour slot at Kopargaon (\`KQ-KPG-2026-6285\`). Shows exact queue position #3, OSRM leave-by alert, and 500m AgriPool micro-pooling match with neighbor Sunil Shinde (\`9800100002\`).
4. **1 Active Checked-in Token**: Assaying stage (\`QUALITY_GRADING\`) ready for interactive grievance / dispute filing.
5. **Fast-Track Priority Auction**: Round in \`JOINING\` status with 4 other farmers joined. Joining as Ramesh makes 5/5 and locks/starts the auction!
6. **Waitlist Auto-Release Slot Offer**: Live 8-minute countdown timer from a released no-show slot.
7. **12 Bell Notifications**: Trilingual alerts covering bookings, gate arrivals, assaying grades, DBT payouts, grievances, and redirect offers.
8. **Mandi Redirect Offer & Broadcast**: Inter-mandi load balancing offer to Rahata with zero-wait priority + APMC broadcast message.

---

## 🏛️ Staff Operations Logins (5 Desks + Planning + Supervisor + District Admin)

All official staff accounts authenticate via 2-Step 2FA at \`/staff-login\`:
- **Step 1 (Credentials)**: Enter Mobile Number, Role, and Administrative Password \`Staff@KisanQ2026\`.
- **Step 2 (2FA Verification)**: Enter standard OTP \`123456\`.

| Station / Desk | Mobile | Role | Officer Name | What It Showcases |
|---|---|---|---|---|
| **Desk 1: Security Gate** | \`9800000001\` | \`security_gate\` | Ramesh Shinde | ANPR intake, boom barrier controls, gate check-in queue. |
| **Desk 2: Assaying Lab** | \`9800000002\` | \`quality_assayer\` | S. Patil | NIR moisture spectrometer results, grade assignment, lab signing. |
| **Desk 3: Weighbridge** | \`9800000003\` | \`weighmaster\` | Suresh Jadhav | Electronic scale tare/gross capture, net weight slips. |
| **Desk 4: Procurement** | \`9800000004\` | \`procurement\` | Secretary Deshmukh | Statutory MSP pricing deed, electronic signature seal. |
| **Desk 5: DBT Treasury** | \`9800000005\` | \`accounts_settlement\`| Treasury Officer Kale | PFMS payment batch release, bank advice generation. |
| **Resource Planning Officer**| \`9800000006\` | \`resource_officer\` | P. Kulkarni | 7-day demand forecast, what-if simulator, borrow requests, trilingual broadcasts, inbound quotas. |
| **Mandi Supervisor** | \`9800000007\` | \`supervisor\` | V. Pawar | 5 Open Anomaly Flags (moisture, plate mismatch, second token), farmer grievances, override console. |
| **District Administrator** | \`9800000008\` | \`district_admin\` | District Collector | Multi-centre district dashboard across all 6 APMC mandis, escalated approvals. |

---

## ⚡ Useful CLI Commands

- \`npm run showcase:seed\`: Cleanly resets and seeds all showcase data.
- \`npm run showcase:live\`: Re-times upcoming bookings, auctions, and offers relative to the current live clock (run right before presenting).
- \`npm run showcase:clean\`: Safely wipes all showcase records.
`;

  try {
    fs.writeFileSync(docPath, content, 'utf8');
    console.log(`📄 Written showcase logins documentation to: SHOWCASE_LOGINS.md`);
  } catch (_) {}
}

// MAIN SEED FUNCTION
async function seedShowcase() {
  await connectAndVerifyDb();
  await cleanShowcaseData();

  console.log('\n🚀 [SEED SHOWCASE] Seeding realistic pilot data across all modules...');

  const t = getTimingContext(new Date());

  // Ensure official staff accounts have clean, realistic names (no legacy demo strings)
  for (const officer of Object.values(OFFICERS)) {
    await StaffUser.findOneAndUpdate(
      { phone: officer.phone },
      { $set: { name: officer.name } }
    );
  }

  // 1. Seed Farmers (15 realistic profiles)
  console.log('1️⃣ Seeding 15 Realistic Farmers...');
  const salt = await bcrypt.genSalt(10);
  const passcodeHash = await bcrypt.hash('123456', salt);

  for (const f of FARMERS) {
    await Farmer.create({
      _id: f._id,
      phone: f.phone,
      name: f.name,
      village: f.village,
      crop: f.crop,
      landArea: f.landArea,
      preferredLanguage: f.preferredLanguage,
      registeredVia: 'app',
      passcodeHash,
      pendingDues: f.pendingDues,
      noSmartphone: f.noSmartphone,
      pickupLocation: f.pickupLocation,
      seedBatch: SEED_BATCH
    });
  }

  // 2. Seed Crop Prices for all crops across 6 Mandis
  console.log('2️⃣ Seeding Statutory MSP and Mandi Market Rates for 6 APMCs...');
  const CENTRES = [
    { code: 'KPG-01', name: 'APMC Kopargaon' },
    { code: 'SRD-02', name: 'APMC Shirdi' },
    { code: 'RHT-03', name: 'APMC Rahata' },
    { code: 'VJP-04', name: 'APMC Vaijapur' },
    { code: 'SRP-05', name: 'APMC Shrirampur' },
    { code: 'LSG-06', name: 'APMC Lasalgaon' }
  ];

  const CROPS_DATA = [
    { crop: 'Soybean', msp: 4892, market: 4950, yest: 4910 },
    { crop: 'Wheat', msp: 2275, market: 2320, yest: 2310 },
    { crop: 'Onion', msp: 1800, market: 2150, yest: 2100 },
    { crop: 'Cotton', msp: 7122, market: 7280, yest: 7240 },
    { crop: 'Red Onion', msp: 1950, market: 2280, yest: 2220 },
    { crop: 'Maize', msp: 2090, market: 2140, yest: 2110 }
  ];

  for (const centre of CENTRES) {
    for (const c of CROPS_DATA) {
      await CropPrice.create({
        mandiId: centre.code,
        crop: c.crop,
        mspPrice: c.msp,
        marketPriceToday: c.market,
        marketPriceYesterday: c.yest,
        effectiveDate: t.dateStr,
        updatedBy: 'APMC_MARKET_INTELLIGENCE',
        seedBatch: SEED_BATCH
      });
    }
  }

  // 3. Seed Hero Farmer's Historical Completed Procurements & Active Tokens
  console.log('3️⃣ Seeding Ramesh Kadam (Hero Farmer) Procurement Lifecycle & Tokens...');
  const heroFarmer = FARMERS[0];

  // (a) Past Procurement 1 (18 days ago - COMPLETED & PAID)
  const dateP1 = new Date(Date.now() - 18 * 86400000);
  const bP1 = await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: dateP1,
    arrivalWindowEnd: new Date(dateP1.getTime() + 3600000),
    tokenNumber: 'KQ-KPG-2026-1011',
    status: 'COMPLETED',
    grade: 'A',
    moisturePercentage: 10.8,
    grossWeight: 3820,
    tareWeight: 320,
    netWeight: 3500,
    weighbridgeId: 'WB-01-60MT',
    paymentStatus: 'payment_confirmed',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-1011',
    id: 'KQ-KPG-2026-1011',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 35,
    quantityBand: '15q+',
    slotDate: dateP1.toISOString().slice(0, 10),
    slotTime: '09:00 AM - 10:00 AM',
    status: 'COMPLETED',
    vehicleNumber: heroFarmer.vehicleNumber,
    stages: build5Stages({
      gateStatus: 'Completed', gateTime: dateP1,
      assayStatus: 'Completed', assayTime: new Date(dateP1.getTime() + 900000), grade: 'A', moisture: '10.8%',
      weighStatus: 'Completed', weighTime: new Date(dateP1.getTime() + 1800000), netWeight: '35.00 Q',
      procStatus: 'Completed', procTime: new Date(dateP1.getTime() + 2700000),
      payoutStatus: 'Completed', payoutTime: new Date(dateP1.getTime() + 3600000)
    }),
    createdAt: dateP1,
    seedBatch: SEED_BATCH
  });
  await ProcurementRecord.create({
    bookingId: bP1._id,
    paymentStatus: 'payment_confirmed',
    paymentStatusSource: 'PFMS_DBT_DIRECT',
    paymentStatusTimestamp: new Date(dateP1.getTime() + 3600000),
    stages: [
      { stage: 'GATE_CHECKIN', status: 'COMPLETED', timestamp: dateP1 },
      { stage: 'QUALITY_GRADING', status: 'COMPLETED', timestamp: new Date(dateP1.getTime() + 900000) },
      { stage: 'WEIGHBRIDGE', status: 'COMPLETED', timestamp: new Date(dateP1.getTime() + 1800000) },
      { stage: 'PROCUREMENT', status: 'COMPLETED', timestamp: new Date(dateP1.getTime() + 2700000) },
      { stage: 'PAYOUT', status: 'COMPLETED', timestamp: new Date(dateP1.getTime() + 3600000) }
    ],
    seedBatch: SEED_BATCH
  });

  // (b) Past Procurement 2 (11 days ago - COMPLETED & PAID)
  const dateP2 = new Date(Date.now() - 11 * 86400000);
  const bP2 = await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: dateP2,
    arrivalWindowEnd: new Date(dateP2.getTime() + 3600000),
    tokenNumber: 'KQ-KPG-2026-1012',
    status: 'COMPLETED',
    grade: 'A',
    moisturePercentage: 11.2,
    grossWeight: 4340,
    tareWeight: 340,
    netWeight: 4000,
    weighbridgeId: 'WB-01-60MT',
    paymentStatus: 'payment_confirmed',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-1012',
    id: 'KQ-KPG-2026-1012',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 40,
    quantityBand: '15q+',
    slotDate: dateP2.toISOString().slice(0, 10),
    slotTime: '10:00 AM - 11:00 AM',
    status: 'COMPLETED',
    vehicleNumber: heroFarmer.vehicleNumber,
    stages: build5Stages({
      gateStatus: 'Completed', gateTime: dateP2,
      assayStatus: 'Completed', assayTime: new Date(dateP2.getTime() + 900000), grade: 'A', moisture: '11.2%',
      weighStatus: 'Completed', weighTime: new Date(dateP2.getTime() + 1800000), netWeight: '40.00 Q',
      procStatus: 'Completed', procTime: new Date(dateP2.getTime() + 2700000),
      payoutStatus: 'Completed', payoutTime: new Date(dateP2.getTime() + 3600000)
    }),
    createdAt: dateP2,
    seedBatch: SEED_BATCH
  });
  await ProcurementRecord.create({
    bookingId: bP2._id,
    paymentStatus: 'payment_confirmed',
    paymentStatusSource: 'PFMS_DBT_DIRECT',
    paymentStatusTimestamp: new Date(dateP2.getTime() + 3600000),
    stages: [
      { stage: 'GATE_CHECKIN', status: 'COMPLETED', timestamp: dateP2 },
      { stage: 'QUALITY_GRADING', status: 'COMPLETED', timestamp: new Date(dateP2.getTime() + 900000) },
      { stage: 'WEIGHBRIDGE', status: 'COMPLETED', timestamp: new Date(dateP2.getTime() + 1800000) },
      { stage: 'PROCUREMENT', status: 'COMPLETED', timestamp: new Date(dateP2.getTime() + 2700000) },
      { stage: 'PAYOUT', status: 'COMPLETED', timestamp: new Date(dateP2.getTime() + 3600000) }
    ],
    seedBatch: SEED_BATCH
  });

  // (c) Past Procurement 3 (4 days ago - COMPLETED & PAID)
  const dateP3 = new Date(Date.now() - 4 * 86400000);
  const bP3 = await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: dateP3,
    arrivalWindowEnd: new Date(dateP3.getTime() + 3600000),
    tokenNumber: 'KQ-KPG-2026-1013',
    status: 'COMPLETED',
    grade: 'B',
    moisturePercentage: 11.8,
    grossWeight: 3110,
    tareWeight: 310,
    netWeight: 2800,
    weighbridgeId: 'WB-01-60MT',
    paymentStatus: 'payment_confirmed',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-1013',
    id: 'KQ-KPG-2026-1013',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 28,
    quantityBand: '15q+',
    slotDate: dateP3.toISOString().slice(0, 10),
    slotTime: '11:00 AM - 12:00 PM',
    status: 'COMPLETED',
    vehicleNumber: heroFarmer.vehicleNumber,
    stages: build5Stages({
      gateStatus: 'Completed', gateTime: dateP3,
      assayStatus: 'Completed', assayTime: new Date(dateP3.getTime() + 900000), grade: 'B', moisture: '11.8%',
      weighStatus: 'Completed', weighTime: new Date(dateP3.getTime() + 1800000), netWeight: '28.00 Q',
      procStatus: 'Completed', procTime: new Date(dateP3.getTime() + 2700000),
      payoutStatus: 'Completed', payoutTime: new Date(dateP3.getTime() + 3600000)
    }),
    createdAt: dateP3,
    seedBatch: SEED_BATCH
  });
  await ProcurementRecord.create({
    bookingId: bP3._id,
    paymentStatus: 'payment_confirmed',
    paymentStatusSource: 'PFMS_DBT_DIRECT',
    paymentStatusTimestamp: new Date(dateP3.getTime() + 3600000),
    stages: [
      { stage: 'GATE_CHECKIN', status: 'COMPLETED', timestamp: dateP3 },
      { stage: 'QUALITY_GRADING', status: 'COMPLETED', timestamp: new Date(dateP3.getTime() + 900000) },
      { stage: 'WEIGHBRIDGE', status: 'COMPLETED', timestamp: new Date(dateP3.getTime() + 1800000) },
      { stage: 'PROCUREMENT', status: 'COMPLETED', timestamp: new Date(dateP3.getTime() + 2700000) },
      { stage: 'PAYOUT', status: 'COMPLETED', timestamp: new Date(dateP3.getTime() + 3600000) }
    ],
    seedBatch: SEED_BATCH
  });

  // (d) Procurement 4 (1 day ago - COMPLETED with Payout PENDING)
  const dateP4 = new Date(Date.now() - 1 * 86400000);
  const bP4 = await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: dateP4,
    arrivalWindowEnd: new Date(dateP4.getTime() + 3600000),
    tokenNumber: 'KQ-KPG-2026-1014',
    status: 'COMPLETED',
    grade: 'A',
    moisturePercentage: 10.9,
    grossWeight: 3530,
    tareWeight: 330,
    netWeight: 3200,
    weighbridgeId: 'WB-01-60MT',
    paymentStatus: 'bill_generated',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-1014',
    id: 'KQ-KPG-2026-1014',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 32,
    quantityBand: '15q+',
    slotDate: dateP4.toISOString().slice(0, 10),
    slotTime: '02:00 PM - 03:00 PM',
    status: 'COMPLETED',
    vehicleNumber: heroFarmer.vehicleNumber,
    stages: build5Stages({
      gateStatus: 'Completed', gateTime: dateP4,
      assayStatus: 'Completed', assayTime: new Date(dateP4.getTime() + 900000), grade: 'A', moisture: '10.9%',
      weighStatus: 'Completed', weighTime: new Date(dateP4.getTime() + 1800000), netWeight: '32.00 Q',
      procStatus: 'Completed', procTime: new Date(dateP4.getTime() + 2700000),
      payoutStatus: 'In Progress', payoutTime: null
    }),
    createdAt: dateP4,
    seedBatch: SEED_BATCH
  });
  await ProcurementRecord.create({
    bookingId: bP4._id,
    paymentStatus: 'bill_generated',
    paymentStatusSource: 'TREASURY_SUBMITTED',
    paymentStatusTimestamp: new Date(dateP4.getTime() + 2700000),
    stages: [
      { stage: 'GATE_CHECKIN', status: 'COMPLETED', timestamp: dateP4 },
      { stage: 'QUALITY_GRADING', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 900000) },
      { stage: 'WEIGHBRIDGE', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 1800000) },
      { stage: 'PROCUREMENT', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 2700000) },
      { stage: 'PAYOUT', status: 'IN_PROGRESS', timestamp: null }
    ],
    seedBatch: SEED_BATCH
  });

  // (e) Upcoming Confirmed Booking Today (Next Whole-Hour Slot)
  await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-6285',
    status: 'BOOKED',
    channel: 'app',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-6285',
    id: 'KQ-KPG-2026-6285',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    status: 'Booked',
    queuePosition: 3,
    vehicleNumber: heroFarmer.vehicleNumber,
    latitude: heroFarmer.pickupLocation.coordinates[1],
    longitude: heroFarmer.pickupLocation.coordinates[0],
    stages: build5Stages(),
    seedBatch: SEED_BATCH
  });

  // (f) Active Checked-in Token at Assaying Desk (For Grievance Flow)
  const activeTokenDate = new Date(Date.now() - 40 * 60 * 1000);
  await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: activeTokenDate,
    arrivalWindowEnd: new Date(activeTokenDate.getTime() + 3600000),
    tokenNumber: 'KQ-KPG-2026-6286',
    status: 'CHECKED_IN',
    channel: 'app',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-6286',
    id: 'KQ-KPG-2026-6286',
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    farmerId: heroFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '11:00 AM - 12:00 PM',
    status: 'In-Progress',
    currentStageIndex: 1,
    vehicleNumber: heroFarmer.vehicleNumber,
    stages: build5Stages({
      gateStatus: 'Completed', gateTime: activeTokenDate,
      assayStatus: 'In Progress', assayTime: new Date(Date.now() - 10 * 60 * 1000)
    }),
    seedBatch: SEED_BATCH
  });

  // 4. Seed Slot Group & Fast-Track Round in JOINING (4 Joined + Ramesh Joins to make 5)
  console.log('4️⃣ Seeding Fast-Track Quorum & Upcoming Slot Group...');
  const slotFarmers = FARMERS.slice(1, 5); // Farmers 2, 3, 4, 5
  const slotTokenNumbers = ['KQ-KPG-2026-6281', 'KQ-KPG-2026-6282', 'KQ-KPG-2026-6283', 'KQ-KPG-2026-6284'];
  const participantList = [];

  for (let i = 0; i < slotFarmers.length; i++) {
    const sf = slotFarmers[i];
    const tkNum = slotTokenNumbers[i];
    const bDoc = await Booking.create({
      farmerId: sf._id,
      centreId: KPG_CENTRE_OBJECT_ID,
      crop: sf.crop,
      quantityBand: '15q+',
      arrivalWindowStart: t.slotStart,
      arrivalWindowEnd: t.slotEnd,
      tokenNumber: tkNum,
      status: 'BOOKED',
      channel: 'app',
      seedBatch: SEED_BATCH
    });
    await Token.create({
      tokenNumber: tkNum,
      id: tkNum,
      farmerName: sf.name,
      farmerPhone: sf.phone,
      farmerId: sf._id,
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      crop: sf.crop,
      quantity: 25 + i * 5,
      quantityBand: '15q+',
      slotDate: t.dateStr,
      slotTime: t.slotLabel,
      status: 'Booked',
      queuePosition: i + 4,
      vehicleNumber: sf.vehicleNumber,
      latitude: sf.pickupLocation.coordinates[1],
      longitude: sf.pickupLocation.coordinates[0],
      stages: build5Stages(),
      seedBatch: SEED_BATCH
    });

    participantList.push({
      farmerId: sf._id.toString(),
      phone: sf.phone,
      name: sf.name,
      bookingId: bDoc._id,
      tokenNumber: tkNum,
      joinedAt: new Date(Date.now() - (15 - i * 3) * 60000)
    });
  }

  // Fast-Track Round in JOINING
  await FastTrackRound.create({
    roundId: 'FTR-KPG-2026-8001',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    slotDate: t.dateStr,
    slotHour: t.slotLabel,
    status: 'JOINING',
    participants: participantList,
    reserveFee: 200,
    bidStep: 10,
    bidCeiling: 500,
    capPerHour: 2,
    seedBatch: SEED_BATCH
  });

  // Fast-Track Round in AWAITING_APPROVAL (Officer Approval Queue)
  const ftWinner = FARMERS[5]; // Balasaheb Thorat
  await FastTrackRound.create({
    roundId: 'FTR-KPG-2026-8002',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    slotDate: t.dateStr,
    slotHour: '09:00 AM - 10:00 AM',
    status: 'AWAITING_APPROVAL',
    currentLeader: {
      farmerId: ftWinner._id.toString(),
      phone: ftWinner.phone,
      name: ftWinner.name,
      bookingId: new mongoose.Types.ObjectId(),
      tokenNumber: 'KQ-KPG-2026-2005',
      amount: 240,
      bidTime: new Date(Date.now() - 5 * 60000)
    },
    officerDecisionExpiresAt: new Date(Date.now() + 10 * 60000),
    seedBatch: SEED_BATCH
  });

  // 5. Seed No-Show Near Grace Expiry & Waitlist Offer
  console.log('5️⃣ Seeding Auto-Release No-Show & Waitlist Slot Offer...');
  const noShowFarmer = FARMERS[7]; // Haribhau Kale
  const waitlistFarmer = heroFarmer; // Ramesh Kadam

  // No-Show Token (elapsed 480s into 600s grace window -> 120s remaining)
  const noShowCreated = new Date(Date.now() - 480 * 1000);
  const noShowWarned = new Date(Date.now() - 180 * 1000);
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-6280',
    id: 'KQ-KPG-2026-6280',
    farmerName: noShowFarmer.name,
    farmerPhone: noShowFarmer.phone,
    farmerId: noShowFarmer._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '11:00 AM - 12:00 PM',
    status: 'Booked',
    createdAt: noShowCreated,
    warnedAt: noShowWarned,
    stages: build5Stages(),
    seedBatch: SEED_BATCH
  });

  // Waitlist Entry & Slot Offer for Ramesh Kadam (Expires in 8 mins)
  const wDoc = await Waitlist.create({
    farmerId: waitlistFarmer._id,
    farmerName: waitlistFarmer.name,
    farmerPhone: waitlistFarmer.phone,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    requestedSlotDate: t.dateStr,
    requestedSlotTime: '11:00 AM - 01:00 PM',
    status: 'OFFERED',
    priority: 1,
    seedBatch: SEED_BATCH
  });
  await SlotOffer.create({
    id: 'OFFER-KPG-2026-9001',
    waitlistId: wDoc._id,
    releasedTokenNumber: 'KQ-KPG-2026-6280',
    farmerPhone: waitlistFarmer.phone,
    farmerName: waitlistFarmer.name,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    slotDate: t.dateStr,
    slotTime: '11:00 AM - 12:00 PM',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + 8 * 60 * 1000),
    status: 'PENDING',
    seedBatch: SEED_BATCH
  });

  // 6. Seed Complaints (Farmer Grievances)
  console.log('6️⃣ Seeding Farmer Complaints & Grievances...');
  await Complaint.create([
    {
      complaintId: 'CMP-2026-101',
      tokenNumber: 'KQ-KPG-2026-6286',
      farmerId: heroFarmer._id,
      farmerName: heroFarmer.name,
      farmerPhone: heroFarmer.phone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      checkpoint: 'QUALITY_GRADING',
      category: 'ASSAYING_DISPUTE',
      description: 'NIR moisture analyzer reading variation on second sample. Requesting supervisor recalibration verification.',
      status: 'PENDING',
      assignedTo: OFFICERS.supervisor.name,
      seedBatch: SEED_BATCH
    },
    {
      complaintId: 'CMP-2026-102',
      tokenNumber: 'KQ-KPG-2026-1013',
      farmerId: heroFarmer._id,
      farmerName: heroFarmer.name,
      farmerPhone: heroFarmer.phone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      checkpoint: 'WEIGHBRIDGE',
      category: 'WEIGHMENT_VARIANCE',
      description: 'Trolley tare measurement discrepancy before intake.',
      status: 'RESOLVED',
      assignedTo: OFFICERS.supervisor.name,
      resolvedBy: OFFICERS.supervisor.name,
      resolutionNotes: 'Tare weight re-measured with decoupled trolley. Net weight recorded at 28.00 Q.',
      resolvedAt: new Date(Date.now() - 3 * 86400000),
      seedBatch: SEED_BATCH
    },
    {
      complaintId: 'CMP-2026-103',
      tokenNumber: 'KQ-KPG-2026-6281',
      farmerId: FARMERS[1]._id,
      farmerName: FARMERS[1].name,
      farmerPhone: FARMERS[1].phone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      checkpoint: 'GATE_CHECKIN',
      category: 'FACILITY_ISSUE',
      description: 'North boom barrier sensor sluggish response on entry.',
      status: 'PENDING',
      assignedTo: OFFICERS.supervisor.name,
      seedBatch: SEED_BATCH
    },
    {
      complaintId: 'CMP-2026-104',
      tokenNumber: 'KQ-KPG-2026-6282',
      farmerId: FARMERS[2]._id,
      farmerName: FARMERS[2].name,
      farmerPhone: FARMERS[2].phone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      checkpoint: 'QUALITY_GRADING',
      category: 'ASSAYING_DISPUTE',
      description: 'Dispute over Grade B classification of Soybean lot.',
      status: 'IN_INVESTIGATION',
      assignedTo: OFFICERS.supervisor.name,
      seedBatch: SEED_BATCH
    },
    {
      complaintId: 'CMP-2026-105',
      tokenNumber: 'KQ-KPG-2026-6283',
      farmerId: FARMERS[3]._id,
      farmerName: FARMERS[3].name,
      farmerPhone: FARMERS[3].phone,
      centreId: 'KPG-01',
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      checkpoint: 'PAYOUT',
      category: 'PAYOUT_DELAY',
      description: 'Bank IFSC routing delay on DBT advice transmission.',
      status: 'RESOLVED',
      assignedTo: OFFICERS.supervisor.name,
      resolvedBy: OFFICERS.supervisor.name,
      resolutionNotes: 'Updated bank account IFSC code in treasury ledger; payment cleared.',
      resolvedAt: new Date(Date.now() - 2 * 86400000),
      seedBatch: SEED_BATCH
    }
  ]);

  // 7. Seed Staff Anomaly Exceptions (5 Open Rules + 2 Resolved)
  console.log('7️⃣ Seeding Staff Anomaly Flags & Exceptions...');
  const supervisorUser = await StaffUser.findOne({ role: 'supervisor' }) || { _id: new mongoose.Types.ObjectId() };

  await Exception.create([
    {
      bookingId: bP1._id,
      type: 'document_mismatch',
      reasonCode: 'Second active token detected for same farmer profile across concurrent slots',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP2._id,
      type: 'quality_dispute',
      reasonCode: 'Quantity > 50 MT (540 quintals single consignment) requires multi-officer signoff',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP3._id,
      type: 'quality_dispute',
      reasonCode: 'Moisture > 15% (Measured 17.2% at Assaying Lab #2)',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP4._id,
      type: 'document_mismatch',
      reasonCode: 'RC plate mismatch: Arrival Plate MH-17-AJ-1122 vs Booking Plate MH-17-BY-5124',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP1._id,
      type: 'rejected',
      reasonCode: 'Out-of-sequence check-in: Arrived 3.5 hours before scheduled window',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP2._id,
      type: 'quality_dispute',
      reasonCode: 'High moisture level (15.6%) on late harvest batch',
      raisedBy: supervisorUser._id,
      supervisorOverride: true,
      overrideReason: 'Solar drying yard protocol authorized by Mandi Supervisor',
      outcome: 'Admitted with 1.0% standard moisture deduction',
      seedBatch: SEED_BATCH
    },
    {
      bookingId: bP3._id,
      type: 'document_mismatch',
      reasonCode: 'Trailer plate replacement due to axle maintenance',
      raisedBy: supervisorUser._id,
      supervisorOverride: true,
      overrideReason: 'Verified 7/12 extract and Talathi ownership certificate',
      outcome: 'Gate entry authorized',
      seedBatch: SEED_BATCH
    }
  ]);

  // 8. Seed Hero Farmer 12 Bell Notifications
  console.log('8️⃣ Seeding 12 Trilingual Notifications for Ramesh Kadam...');
  const NOTIFS_DATA = [
    { event: 'booking_confirmed', lang: 'mr', title: 'स्लॉट बुकिंग यशस्वी', body: 'आपला 30 क्विंटल सोयाबीन स्लॉट APMC कोपरगाव येथे निश्चित झाला आहे.', read: true, agoMin: 120 },
    { event: 'leave_by_alert', lang: 'en', title: 'Recommended Departure: 45 Mins Prior', body: 'Based on OSRM traffic from Kolpewadi, depart by 10:15 AM to arrive comfortably in your slot.', read: true, agoMin: 90 },
    { event: 'turn_near', lang: 'mr', title: 'आपली पाळी जवळ आली आहे', body: 'गेट क्रमांक 1 जवळ या. आपल्या पुढे फक्त 2 वाहने आहेत (रांगेतील स्थान #3).', read: false, agoMin: 50 },
    { event: 'quality_assayed', lang: 'mr', title: 'गुणवत्ता तपासणी पूर्ण', body: 'आपल्या मालाची प्रतवारी: Grade A, आर्द्रता: 10.9%. वजन काट्याकडे पुढे जा.', read: true, agoMin: 40 },
    { event: 'weighbridge_done', lang: 'en', title: 'Weighbridge Net Weight Recorded', body: 'Gross: 35.30 Q | Tare: 3.30 Q | Net Weight: 32.00 Q recorded at Electronic Scale #1.', read: true, agoMin: 30 },
    { event: 'payout_ready', lang: 'mr', title: 'DBT पेमेंट पावती तयार', body: '₹1,56,800 रकमेची पेमेंट पावती तयार झाली आहे. लवकरच बँक खात्यात जमा होईल.', read: false, agoMin: 20 },
    { event: 'payout_paid', lang: 'en', title: 'DBT Payout Transferred Successfully', body: '₹1,71,500 transferred to SBI Bank A/C via PFMS Direct Benefit Transfer.', read: true, agoMin: 1440 },
    { event: 'slot_warning', lang: 'mr', title: 'स्लॉट वेळ इशारा', body: 'आपल्या स्लॉटचा वेळ 15 मिनिटांत सुरू होत आहे. कृपया वेळेत हजर राहा.', read: false, agoMin: 15 },
    { event: 'waitlist_offer', lang: 'en', title: 'Waitlist Slot Offer Available', body: 'A released slot opened at APMC Kopargaon. Accept within 10 minutes to confirm.', read: false, agoMin: 8 },
    { event: 'fast_track_won', lang: 'en', title: 'Fast-Track Priority Round Active', body: 'Fast-track priority auction is currently live for your upcoming slot window.', read: false, agoMin: 5 },
    { event: 'complaint_resolved', lang: 'mr', title: 'तक्रार निवारण पूर्ण', body: 'आपली वजन काटा फेरतपासणी तक्रार मोंढा अधीक्षकांनी सोडवली आहे.', read: true, agoMin: 2880 },
    { event: 'redirect_offer', lang: 'en', title: 'Recommended Mandi Redirect Available', body: 'High arrivals at Kopargaon. Fast-track redirect to APMC Rahata (14 km) available.', read: false, agoMin: 2 }
  ];

  for (const n of NOTIFS_DATA) {
    const createdAt = new Date(Date.now() - n.agoMin * 60000);
    await Notification.create({
      recipientType: 'farmer',
      recipientId: heroFarmer.phone,
      centreId: 'KPG-01',
      event: n.event,
      lang: n.lang,
      title: n.title,
      body: n.body,
      read: n.read,
      channels: {
        inApp: { status: n.read ? 'read' : 'delivered', deliveredAt: createdAt },
        sms: { status: 'sent', attempts: 1, sentAt: createdAt }
      },
      createdAt,
      seedBatch: SEED_BATCH
    });
  }

  // 9. Seed Staff Notifications (4-8 per staff role)
  console.log('9️⃣ Seeding Role-Scoped Notifications for All Official Staff Stations...');
  const STAFF_NOTIFS = [
    { role: 'security_gate', id: OFFICERS.gate.phone, title: 'Morning Peak Intake Active', body: 'North Boom Barrier operating at capacity. 14 arrivals queued for inspection.', event: 'alerts' },
    { role: 'quality_assayer', id: OFFICERS.assayer.phone, title: 'NIR Lab Calibration Validated', body: 'Spectrometer calibrated against Standard Wheat & Soybean reference sets.', event: 'approvals' },
    { role: 'weighmaster', id: OFFICERS.weighmaster.phone, title: 'Scale Zero-Tare Check Complete', body: '60 MT Pitless scale zeroed and verified for morning shift.', event: 'approvals' },
    { role: 'procurement', id: OFFICERS.procurement.phone, title: 'Daily Statutory MSP Baseline', body: 'Soybean statutory rate locked at ₹4,892/Q for todays receipts.', event: 'broadcast' },
    { role: 'accounts_settlement', id: OFFICERS.finance.phone, title: 'PFMS Treasury Batch Ready', body: 'Batch PFMS-MH-2026-9921 containing 18 payment files awaiting release.', event: 'approvals' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Borrow Request Received from Shirdi', body: 'APMC Shirdi requested 5 temporary labour gangs for tomorrow peak.', event: 'requests' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: '5 Open Anomaly Flags in Queue', body: 'High moisture and plate discrepancy flags require supervisor verification.', event: 'alerts' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'District Load Summary: 6 Mandis Green/Amber', body: 'Total arrivals across Ahmednagar district tracking at 92% of projected forecast.', event: 'broadcast' }
  ];

  for (const sn of STAFF_NOTIFS) {
    await Notification.create({
      recipientType: 'staff',
      recipientId: sn.id,
      centreId: 'KPG-01',
      event: sn.event,
      lang: 'en',
      title: sn.title,
      body: sn.body,
      read: false,
      channels: { inApp: { status: 'delivered', deliveredAt: new Date() } },
      seedBatch: SEED_BATCH
    });
  }

  // 10. Seed Kopargaon Live Queue (40 Tokens across all stages with >= 20 completed for measured samples)
  console.log('🔟 Seeding Kopargaon Live Operations Queue (~40 Tokens)...');
  const STAGE_CONFIGS = [
    { count: 8, status: 'Booked', stageIdx: 0, prefix: 'KQ-KPG-2026-30' },
    { count: 4, status: 'Gate-Exit-Requested', stageIdx: 0, prefix: 'KQ-KPG-2026-31' },
    { count: 6, status: 'In-Progress', stageIdx: 1, prefix: 'KQ-KPG-2026-32' },
    { count: 6, status: 'In-Progress', stageIdx: 2, prefix: 'KQ-KPG-2026-33' },
    { count: 3, status: 'In-Progress', stageIdx: 3, prefix: 'KQ-KPG-2026-34' },
    { count: 3, status: 'In-Progress', stageIdx: 4, prefix: 'KQ-KPG-2026-35' },
    { count: 22, status: 'Completed', stageIdx: 4, prefix: 'KQ-KPG-2026-40' } // >= 20 completed history for measured N samples
  ];

  let tokenSeq = 1;
  for (const sc of STAGE_CONFIGS) {
    for (let j = 0; j < sc.count; j++) {
      const fIdx = (tokenSeq + j) % FARMERS.length;
      const f = FARMERS[fIdx];
      const tNum = `${sc.prefix}${String(j + 1).padStart(2, '0')}`;
      const isComp = sc.status === 'Completed';
      const cTime = isComp ? new Date(Date.now() - (tokenSeq * 3600000)) : new Date();

      await Token.create({
        tokenNumber: tNum,
        id: tNum,
        farmerName: f.name,
        farmerPhone: f.phone,
        farmerId: f._id,
        mandiId: 'KPG-01',
        mandiName: MANDI_NAME,
        crop: f.crop,
        quantity: 20 + ((j * 7) % 30),
        quantityBand: '15q+',
        slotDate: t.dateStr,
        slotTime: '08:00 AM - 06:00 PM',
        status: sc.status,
        currentStageIndex: sc.stageIdx,
        vehicleNumber: f.vehicleNumber,
        stages: build5Stages({
          gateStatus: sc.stageIdx >= 0 && sc.status !== 'Booked' ? 'Completed' : 'Pending',
          assayStatus: sc.stageIdx >= 1 ? (isComp || sc.stageIdx > 1 ? 'Completed' : 'In Progress') : 'Pending',
          weighStatus: sc.stageIdx >= 2 ? (isComp || sc.stageIdx > 2 ? 'Completed' : 'In Progress') : 'Pending',
          procStatus: sc.stageIdx >= 3 ? (isComp || sc.stageIdx > 3 ? 'Completed' : 'In Progress') : 'Pending',
          payoutStatus: sc.stageIdx >= 4 ? (isComp ? 'Completed' : 'In Progress') : 'Pending'
        }),
        createdAt: cTime,
        seedBatch: SEED_BATCH
      });
      tokenSeq++;
    }
  }

  // 11. Seed Shirdi & Rahata Queues (5 tokens each -> ensures they show "assumed" under 20 samples)
  console.log('1️⃣1️⃣ Seeding Shirdi & Rahata Baseline Queues (Assumed Baseline)...');
  const OTHER_CENTRES = [
    { code: 'SRD-02', name: 'APMC Shirdi', prefix: 'KQ-SRD-2026-50' },
    { code: 'RHT-03', name: 'APMC Rahata', prefix: 'KQ-RHT-2026-60' }
  ];

  for (const oc of OTHER_CENTRES) {
    for (let k = 0; k < 5; k++) {
      const f = FARMERS[(k + 6) % FARMERS.length];
      const tkNum = `${oc.prefix}${k + 1}`;
      await Token.create({
        tokenNumber: tkNum,
        id: tkNum,
        farmerName: f.name,
        farmerPhone: f.phone,
        farmerId: f._id,
        mandiId: oc.code,
        mandiName: oc.name,
        crop: f.crop,
        quantity: 25,
        quantityBand: '15q+',
        slotDate: t.dateStr,
        slotTime: '09:00 AM - 10:00 AM',
        status: 'Completed',
        currentStageIndex: 4,
        stages: build5Stages({ gateStatus: 'Completed', assayStatus: 'Completed', weighStatus: 'Completed', procStatus: 'Completed', payoutStatus: 'Completed' }),
        seedBatch: SEED_BATCH
      });
    }
  }

  // 12. Seed Resource Planning (B7) & Forecast for 6 Mandis
  console.log('1️⃣2️⃣ Seeding B7 Planning Portal Models & 7-Day Forecasts...');
  // Resources
  await Resource.create([
    { centreId: 'KPG-01', type: 'labourer', count: 35, unitCapacity: 40, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', type: 'weighbridge', count: 2, unitCapacity: 120, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', type: 'assaying_bay', count: 3, unitCapacity: 60, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', type: 'gate_lane', count: 2, unitCapacity: 200, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', type: 'truck_bay', count: 4, unitCapacity: 8, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'SRD-02', type: 'labourer', count: 20, unitCapacity: 40, label: 'rule-based forecast', seedBatch: SEED_BATCH },
    { centreId: 'RHT-03', type: 'labourer', count: 25, unitCapacity: 40, label: 'rule-based forecast', seedBatch: SEED_BATCH }
  ]);

  // Events & Availability Overrides
  const dTomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dMarketDay = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  await CentreEvent.create([
    { centreId: 'KPG-01', date: dMarketDay, kind: 'peak_season', note: 'Weekly main commodity market day surge', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dTomorrow, kind: 'maintenance', note: 'Scheduled calibration on scale #2', seedBatch: SEED_BATCH }
  ]);

  await Availability.create([
    { centreId: 'KPG-01', date: dTomorrow, resourceType: 'weighbridge', available: 1, note: 'Scale #2 offline for 2 hours', seedBatch: SEED_BATCH }
  ]);

  await SlotCap.create([
    { centreId: 'KPG-01', date: dTomorrow, hour: 8, cap: 25, seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dTomorrow, hour: 9, cap: 30, seedBatch: SEED_BATCH }
  ]);

  // 7-Day Forecast Snapshots for Kopargaon (2 Green, 2 Amber, 1 Red Market Day)
  const FORECAST_DAYS = [
    { dayName: 'Today', leadDays: 0, heat: 'Green', projected: 28, arrivals: 24, labour: 6 },
    { dayName: 'D+1', leadDays: 1, heat: 'Amber', projected: 45, arrivals: 38, labour: 10 },
    { dayName: 'D+2', leadDays: 2, heat: 'Red', projected: 85, arrivals: 72, labour: 18, note: 'Market Day Surge Event' },
    { dayName: 'D+3', leadDays: 3, heat: 'Amber', projected: 50, arrivals: 42, labour: 11 },
    { dayName: 'D+4', leadDays: 4, heat: 'Green', projected: 25, arrivals: 21, labour: 5 },
    { dayName: 'D+5', leadDays: 5, heat: 'Green', projected: 22, arrivals: 18, labour: 5 },
    { dayName: 'D+6', leadDays: 6, heat: 'Green', projected: 20, arrivals: 17, labour: 4 }
  ];

  for (let d = 0; d < FORECAST_DAYS.length; d++) {
    const fd = FORECAST_DAYS[d];
    const dStr = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    await ForecastSnapshot.create({
      centreId: 'KPG-01',
      date: dStr,
      snapshot: {
        date: dStr,
        dayName: fd.dayName,
        leadDays: fd.leadDays,
        heatStatus: fd.heat,
        projectedBookings: fd.projected,
        expectedArrivalsMid: fd.arrivals,
        labourNeeded: fd.labour,
        note: fd.note || 'Calculated via rule-based forecast engine.',
        label: 'rule-based forecast'
      },
      generatedAt: new Date(),
      seedBatch: SEED_BATCH
    });
  }

  // Plan Requests
  await PlanRequest.create([
    {
      type: 'own',
      fromCentre: 'KPG-01',
      toCentre: 'KPG-01',
      resource: 'labourer',
      count: 6,
      dates: [dMarketDay],
      status: 'pending',
      deadline: new Date(Date.now() + 24 * 3600000),
      requestedBy: OFFICERS.officer.phone,
      reason: 'Extra labour gang for weekly market day surge',
      seedBatch: SEED_BATCH
    },
    {
      type: 'borrow',
      fromCentre: 'SRD-02',
      toCentre: 'KPG-01',
      resource: 'labourer',
      count: 4,
      dates: [dTomorrow],
      status: 'pending',
      deadline: new Date(Date.now() + 24 * 3600000),
      requestedBy: '9800000006',
      reason: 'Temporary gang re-allocation during weighbridge service',
      seedBatch: SEED_BATCH
    },
    {
      type: 'borrow',
      fromCentre: 'KPG-01',
      toCentre: 'RHT-03',
      resource: 'weighbridge',
      count: 1,
      dates: [dTomorrow],
      status: 'escalated',
      deadline: new Date(Date.now() - 3600000),
      requestedBy: OFFICERS.officer.phone,
      reason: 'Escalated to District Collector for inter-mandi resource sharing',
      seedBatch: SEED_BATCH
    }
  ]);

  // 13. Seed Redirect & Broadcast (B9)
  console.log('1️⃣3️⃣ Seeding Mandi Redirect Offers & Trilingual Broadcasts...');
  await InboundQuota.create({
    centreId: 'RHT-03',
    date: t.dateStr,
    hour: t.nextHour,
    count: 10,
    used: 1,
    setBy: OFFICERS.officer.phone,
    seedBatch: SEED_BATCH
  });

  await RedirectOffer.create({
    farmerId: heroFarmer.phone,
    fromCentre: 'KPG-01',
    toCentre: 'RHT-03',
    date: t.dateStr,
    hour: t.nextHour,
    status: 'pending',
    distanceKm: 14,
    toCentreHeatStatus: 'Green',
    expiresAt: new Date(Date.now() + 4 * 3600000),
    proposedBy: OFFICERS.officer.phone,
    seedBatch: SEED_BATCH
  });

  await Broadcast.create({
    centreId: 'KPG-01',
    text: {
      en: 'Soybean procurement gates will operate 2 extra weighing lanes tomorrow from 07:30 AM.',
      hi: 'कल सुबह 07:30 बजे से सोयाबीन खरीद के लिए 2 अतिरिक्त वेइंग लेन खुलेंगी।',
      mr: 'उद्या सकाळी 07:30 पासून सोयाबीन खरेदीसाठी 2 अतिरिक्त वजन काटे सुरू राहतील.'
    },
    sentBy: OFFICERS.officer.phone,
    at: new Date(),
    seedBatch: SEED_BATCH
  });

  // 14. Seed Audit Logs for Checkpoints, Overrides, and Approvals
  console.log('1️⃣4️⃣ Seeding Audit Logs for Checkpoint Signatures & Override Actions...');
  const auditEntries = [];

  // Hero farmer completed procurements checkpoints
  const heroProcurements = [
    { token: 'KQ-KPG-2026-1011', time: dateP1 },
    { token: 'KQ-KPG-2026-1012', time: dateP2 },
    { token: 'KQ-KPG-2026-1013', time: dateP3 },
    { token: 'KQ-KPG-2026-1014', time: dateP4, skipPayout: true }
  ];

  for (const hp of heroProcurements) {
    auditEntries.push(
      { actorId: OFFICERS.gate.phone, actorRole: 'gate_officer', action: 'GATE_CHECKIN_VERIFIED', targetId: hp.token, timestamp: hp.time, seedBatch: SEED_BATCH },
      { actorId: OFFICERS.assayer.phone, actorRole: 'quality_assayer', action: 'ASSAYING_GRADE_ISSUED', targetId: hp.token, timestamp: new Date(hp.time.getTime() + 900000), seedBatch: SEED_BATCH },
      { actorId: OFFICERS.weighmaster.phone, actorRole: 'weighbridge_operator', action: 'WEIGHMENT_RECORDED', targetId: hp.token, timestamp: new Date(hp.time.getTime() + 1800000), seedBatch: SEED_BATCH },
      { actorId: OFFICERS.procurement.phone, actorRole: 'procurement_officer', action: 'PROCUREMENT_CONFIRMED', targetId: hp.token, timestamp: new Date(hp.time.getTime() + 2700000), seedBatch: SEED_BATCH }
    );
    if (!hp.skipPayout) {
      auditEntries.push(
        { actorId: OFFICERS.finance.phone, actorRole: 'finance_officer', action: 'PAYOUT_BATCH_DISPATCHED', targetId: hp.token, timestamp: new Date(hp.time.getTime() + 3600000), seedBatch: SEED_BATCH }
      );
    }
  }

  // 22 Completed queue tokens checkpoints
  for (let j = 0; j < 22; j++) {
    const tNum = `KQ-KPG-2026-40${String(j + 1).padStart(2, '0')}`;
    const baseT = new Date(Date.now() - (j + 1) * 3600000);
    auditEntries.push(
      { actorId: OFFICERS.gate.phone, actorRole: 'gate_officer', action: 'GATE_CHECKIN_VERIFIED', targetId: tNum, timestamp: baseT, seedBatch: SEED_BATCH },
      { actorId: OFFICERS.assayer.phone, actorRole: 'quality_assayer', action: 'ASSAYING_GRADE_ISSUED', targetId: tNum, timestamp: new Date(baseT.getTime() + 900000), seedBatch: SEED_BATCH },
      { actorId: OFFICERS.weighmaster.phone, actorRole: 'weighbridge_operator', action: 'WEIGHMENT_RECORDED', targetId: tNum, timestamp: new Date(baseT.getTime() + 1800000), seedBatch: SEED_BATCH },
      { actorId: OFFICERS.procurement.phone, actorRole: 'procurement_officer', action: 'PROCUREMENT_CONFIRMED', targetId: tNum, timestamp: new Date(baseT.getTime() + 2700000), seedBatch: SEED_BATCH },
      { actorId: OFFICERS.finance.phone, actorRole: 'finance_officer', action: 'PAYOUT_BATCH_DISPATCHED', targetId: tNum, timestamp: new Date(baseT.getTime() + 3600000), seedBatch: SEED_BATCH }
    );
  }

  // Supervisor Overrides & Approvals
  auditEntries.push(
    { actorId: OFFICERS.supervisor.phone, actorRole: 'supervisor', action: 'OVERRIDE_EXCEPTION_APPROVED', targetId: 'KQ-KPG-2026-1012', reason: 'Solar drying yard protocol authorized by Mandi Supervisor', timestamp: new Date(Date.now() - 10 * 86400000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.supervisor.phone, actorRole: 'supervisor', action: 'OVERRIDE_EXCEPTION_APPROVED', targetId: 'KQ-KPG-2026-1013', reason: 'Verified 7/12 extract and Talathi ownership certificate', timestamp: new Date(Date.now() - 3 * 86400000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.officer.phone, actorRole: 'resource_officer', action: 'PLAN_REQUEST_SUBMITTED', targetId: 'KPG-01', timestamp: new Date(Date.now() - 12 * 3600000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.admin.phone, actorRole: 'district_admin', action: 'PLAN_REQUEST_ESCALATED', targetId: 'KPG-01', timestamp: new Date(Date.now() - 2 * 3600000), seedBatch: SEED_BATCH }
  );

  await AuditLog.insertMany(auditEntries);

  // 15. Write Documentation
  writeShowcaseLoginsDoc();

  const finalCounts = await getCollectionCounts();
  console.log('\n================================================================');
  console.log('🎉 SHOWCASE SEED COMPLETED SUCCESSFULLY (seedBatch: showcase-1)');
  console.log('================================================================');
  for (const [col, cnt] of Object.entries(finalCounts)) {
    console.log(`  ✓ ${col.padEnd(22)}: ${cnt} documents`);
  }
  console.log('================================================================\n');
}

// Execution Entrypoint
if (require.main === module) {
  const isClean = process.argv.includes('--clean');
  const isLive = process.argv.includes('--live');

  const runner = isClean ? cleanShowcaseData : (isLive ? liveReTime : seedShowcase);
  runner()
    .then(() => {
      mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Showcase Script Error:', err.message);
      process.exit(1);
    });
}

module.exports = { seedShowcase, cleanShowcaseData, liveReTime };
