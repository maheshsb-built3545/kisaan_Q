'use strict';

/**
 * seedShowcase.js — Realistic Pilot Showcase Data Engine for KisanQ-Aveniq
 *
 * Rules & Constraints:
 * 1. DB Safety Check: Refuses to run unless target database is 'kisanq_aveniq'.
 * 2. Non-invasive marking: Every seeded doc tagged with seedBatch: 'showcase-1'.
 * 3. Non-Showcase Guard: Cleanup deletes ONLY seedBatch === 'showcase-1' or reserved phone docs.
 *    Verifies non-showcase document counts before and after cleanup; exits 1 on any discrepancy.
 * 4. Config Names & Timing: Reads all timers directly from fastTrackConfig and slotReallocationService.
 *    Slots stay whole hours. arrivalWindowStart/End, slotTime and slotDate are strictly consistent.
 * 5. No-Show Demo: Live no-show booking with graceDeadlineAt = now + 2 min & warnedAt;
 *    separate already-released token carrying pending waitlist offer (>= 8 min left).
 * 6. Fast-Track Rounds: Real Booking/Token references for all participants/leaders; exact schema match.
 * 7. Forecast Computed: Computed by forecast engine from real future bookings/availability (no typed snapshots).
 * 8. Honesty & Consistency: Payout = netWeight x rate; zero "immutable"/"statutory"/bank names in user fields;
 *    hero farmer has exactly ONE active token; anomaly flags attached to matching queue tokens.
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

const fastTrackConfig = require('../src/config/fastTrackConfig');
const slotReallocationService = require('../src/services/slotReallocationService');
const { computeWeekForecast } = require('../src/services/forecastService');
const { CROP_RATES, computePayout } = require('../src/config/cropRates');

const SEED_BATCH = 'showcase-1';
const MANDI_ID = 'KPG-01';
const MANDI_NAME = 'APMC Kopargaon';
const KPG_CENTRE_OBJECT_ID = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');

// Reserved Showcase Farmer Phones (9800100001 - 9800100025)
const SHOWCASE_PHONES = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);

// Officer Names (Realistic & Neutral, No Public Figures)
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

// Official 6 APMC Mandis
const CENTRES = [
  { code: 'KPG-01', name: 'APMC Kopargaon', district: 'Ahilyanagar', location: [74.4829, 19.8370], objectId: KPG_CENTRE_OBJECT_ID },
  { code: 'SRD-02', name: 'APMC Shirdi', district: 'Ahilyanagar', location: [74.4754, 19.7668], objectId: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d2') },
  { code: 'RHT-03', name: 'APMC Rahata', district: 'Ahilyanagar', location: [74.4800, 19.7171], objectId: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d3') },
  { code: 'VJP-04', name: 'APMC Vaijapur', district: 'Chhatrapati Sambhajinagar', location: [74.8332, 19.9489], objectId: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d4') },
  { code: 'SRP-05', name: 'APMC Shrirampur', district: 'Ahilyanagar', location: [74.7007, 19.6420], objectId: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d5') },
  { code: 'LSG-06', name: 'APMC Lasalgaon', district: 'Nashik', location: [74.2289, 20.1472], objectId: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d6') }
];

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
    pickupLocation: { type: 'Point', coordinates: [74.4798, 19.8835], address: 'Kolpewadi, Kopargaon' }, // ~160m from Ramesh (AgriPool Match)
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
    pickupLocation: { type: 'Point', coordinates: [74.4950, 19.8980], address: 'Pohegaon, Kopargaon' },
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
    pickupLocation: { type: 'Point', coordinates: [74.4754, 19.7668], address: 'Shirdi' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e108'),
    phone: '9800100008',
    name: 'Haribhau Kale',
    village: 'Sanvatsar',
    crop: 'Soybean',
    landArea: 5.5,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-JK-1234',
    pickupLocation: { type: 'Point', coordinates: [74.4600, 19.8700], address: 'Sanvatsar' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e109'),
    phone: '9800100009',
    name: 'Kashinath Wagh',
    village: 'Kolpewadi',
    crop: 'Cotton',
    landArea: 6.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-LM-5678',
    pickupLocation: { type: 'Point', coordinates: [74.4789, 19.8824], address: 'Kolpewadi' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e110'),
    phone: '9800100010',
    name: 'Anand Kolhe',
    village: 'Pohegaon',
    crop: 'Maize',
    landArea: 3.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-NO-2468',
    pickupLocation: { type: 'Point', coordinates: [74.4950, 19.8980], address: 'Pohegaon' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e111'),
    phone: '9800100011',
    name: 'Sopan Jagtap',
    village: 'Shrirampur',
    crop: 'Soybean',
    landArea: 4.2,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-17-PQ-9012',
    pickupLocation: { type: 'Point', coordinates: [74.7007, 19.6420], address: 'Shrirampur' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e112'),
    phone: '9800100012',
    name: 'Narayan Mhaske',
    village: 'Lasalgaon',
    crop: 'Red Onion',
    landArea: 8.0,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-15-RS-3456',
    pickupLocation: { type: 'Point', coordinates: [74.2289, 20.1472], address: 'Lasalgaon, Nashik' },
    noSmartphone: false,
    pendingDues: 0
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e113'),
    phone: '9800100013',
    name: 'Santosh Tambe',
    village: 'Pimpalgaon',
    crop: 'Wheat',
    landArea: 3.9,
    preferredLanguage: 'mr',
    vehicleNumber: 'MH-15-TU-7890',
    pickupLocation: { type: 'Point', coordinates: [74.0500, 20.1700], address: 'Pimpalgaon' },
    noSmartphone: true,
    pendingDues: 100
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9e114'),
    phone: '9800100014',
    name: 'Bhausaheb Gite',
    village: 'Rahata',
    crop: 'Soybean',
    landArea: 4.8,
    preferredLanguage: 'hi',
    vehicleNumber: 'MH-17-UV-2345',
    pickupLocation: { type: 'Point', coordinates: [74.4850, 19.7200], address: 'Rahata' },
    noSmartphone: false,
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

// Helper: Timing calculations in IST strictly maintaining whole hours & active configs
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

  // Read actual config from fastTrackConfig and slotReallocationService
  const timingConfig = slotReallocationService.getTimingConfig();
  const joinOpenMin = fastTrackConfig.joiningWindowMinutesBeforeSlot || 45;
  const warnMin = timingConfig.warnMs / 60000;
  const graceMin = timingConfig.graceMs / 60000;
  const offerMin = timingConfig.offerMs / 60000;

  // Next slot is strictly on the next whole hour
  const nextHour = (currentHour + 1) % 24;
  const nextHourEnd = (nextHour + 1) % 24;

  const formatHour12 = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:00 ${period}`;
  };

  const slotLabel = `${formatHour12(nextHour)} - ${formatHour12(nextHourEnd)}`;

  // Exact whole-hour slot boundaries
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
    minutesUntilSlot,
    joinOpenMin,
    warnMin,
    graceMin,
    offerMin
  };
}

// 5-Stage Token Template Builder (zero "immutable" / "statutory" / hardcoded bank strings)
function build5Stages({
  gateStatus = 'Pending', gateTime = null,
  assayStatus = 'Pending', assayTime = null, grade = 'A', moisture = '10.8%',
  weighStatus = 'Pending', weighTime = null, netWeight = '30.00 Q',
  procStatus = 'Pending', procTime = null,
  payoutStatus = 'Pending', payoutTime = null
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
      title: 'Assaying & Moisture Analysis',
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
      details: { grade, moisture, method: 'NIR Spectrometer Standard' }
    },
    {
      stageIndex: 2,
      id: 'WEIGHBRIDGE',
      title: 'Electronic Weighbridge Scale',
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
      details: { scaleId: 'WB-01-60MT', netWeight, tareWeight: '3.40 Q' }
    },
    {
      stageIndex: 3,
      id: 'PROCUREMENT',
      title: 'MSP Procurement Deed & Sign-off',
      label: 'Procurement',
      shortLabel: 'MSP Deed',
      officerName: OFFICERS.procurement.name,
      officer: OFFICERS.procurement.name,
      officerRole: 'procurement',
      officerCode: OFFICERS.procurement.code,
      status: procStatus,
      timestamp: procTime,
      completedAt: procStatus === 'Completed' ? procTime : null,
      officerSigId: procStatus === 'Completed' ? `SIG-${OFFICERS.procurement.code}-${Date.now().toString(36)}` : null,
      details: { deedNumber: 'MSP-DEED-2026-9921', rate: '₹4,892/Q' }
    },
    {
      stageIndex: 4,
      id: 'PAYOUT',
      title: 'DBT Treasury Settlement',
      label: 'DBT Payout',
      shortLabel: 'Payout',
      officerName: OFFICERS.finance.name,
      officer: OFFICERS.finance.name,
      officerRole: 'accounts_settlement',
      officerCode: OFFICERS.finance.code,
      status: payoutStatus,
      timestamp: payoutTime,
      completedAt: payoutStatus === 'Completed' ? payoutTime : null,
      officerSigId: payoutStatus === 'Completed' ? `SIG-${OFFICERS.finance.code}-${Date.now().toString(36)}` : null,
      details: { paymentMode: 'PFMS Direct Benefit Transfer', batchId: 'PFMS-MH-2026-8812' }
    }
  ];
}

// Database Connection & Strict Safety Check
async function connectAndVerifyDb() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kisanq_aveniq';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  }

  const dbName = mongoose.connection.name;
  if (!dbName || !dbName.toLowerCase().includes('kisanq_aveniq')) {
    console.error(`🚨 [DB REFUSAL] Target database '${dbName}' is NOT 'kisanq_aveniq'. Aborting immediately for safety.`);
    process.exit(1);
  }
}

// Collection counts for reporting
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

// Non-showcase document counts to ensure 100% preservation across all 25 collections
async function getNonShowcaseCounts() {
  return {
    Farmers: await Farmer.countDocuments({ seedBatch: { $ne: SEED_BATCH }, phone: { $nin: SHOWCASE_PHONES } }),
    Bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Tokens: await Token.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES }, phone: { $nin: SHOWCASE_PHONES } }),
    Waitlist: await Waitlist.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    SlotOffers: await SlotOffer.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    FastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    FastTrackBids: await FastTrackBid.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    Complaints: await Complaint.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } }),
    Exceptions: await Exception.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Notifications: await Notification.countDocuments({ seedBatch: { $ne: SEED_BATCH }, recipientId: { $nin: SHOWCASE_PHONES } }),
    ProcurementRecords: await ProcurementRecord.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    AuditLogs: await AuditLog.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    CropPrices: await CropPrice.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Resources: await Resource.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Availability: await Availability.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    CentreEvents: await CentreEvent.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    SlotCaps: await SlotCap.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    ForecastSnapshots: await ForecastSnapshot.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    PlanRequests: await PlanRequest.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    RedirectOffers: await RedirectOffer.countDocuments({ seedBatch: { $ne: SEED_BATCH }, farmerId: { $nin: SHOWCASE_PHONES } }),
    InboundQuotas: await InboundQuota.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Broadcasts: await Broadcast.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    QueueStates: await QueueState.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    Centres: await Centre.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
    StaffUsers: await StaffUser.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
  };
}

// CLEANUP: Removes ONLY seedBatch: 'showcase-1' or reserved phone documents (zero non-showcase impact)
async function cleanShowcaseData() {
  await connectAndVerifyDb();
  console.log('\n🧹 [CLEANUP] Gathering non-showcase baseline counts before deletion...');
  const beforeNonShowcase = await getNonShowcaseCounts();
  const beforeShowcase = await getCollectionCounts();

  await Farmer.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { phone: { $in: SHOWCASE_PHONES } }] });
  await Token.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { phone: { $in: SHOWCASE_PHONES } }] });
  await Booking.deleteMany({ seedBatch: SEED_BATCH });
  await Waitlist.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] });
  await SlotOffer.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] });
  await FastTrackRound.deleteMany({ seedBatch: SEED_BATCH });
  await FastTrackBid.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] });
  await Complaint.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] });
  await Exception.deleteMany({ seedBatch: SEED_BATCH });
  await Notification.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { recipientId: { $in: SHOWCASE_PHONES } }] });
  await ProcurementRecord.deleteMany({ seedBatch: SEED_BATCH });
  await AuditLog.deleteMany({ seedBatch: SEED_BATCH });
  await CropPrice.deleteMany({ seedBatch: SEED_BATCH });
  await Resource.deleteMany({ seedBatch: SEED_BATCH });
  await Availability.deleteMany({ seedBatch: SEED_BATCH });
  await CentreEvent.deleteMany({ seedBatch: SEED_BATCH });
  await SlotCap.deleteMany({ seedBatch: SEED_BATCH });
  await ForecastSnapshot.deleteMany({ seedBatch: SEED_BATCH });
  await PlanRequest.deleteMany({ seedBatch: SEED_BATCH });
  await RedirectOffer.deleteMany({ $or: [{ seedBatch: SEED_BATCH }, { farmerId: { $in: SHOWCASE_PHONES } }] });
  await InboundQuota.deleteMany({ seedBatch: SEED_BATCH });
  await Broadcast.deleteMany({ seedBatch: SEED_BATCH });
  await QueueState.deleteMany({ seedBatch: SEED_BATCH });

  console.log('✨ [CLEANUP] Targeted showcase documents removed.');
  const afterNonShowcase = await getNonShowcaseCounts();
  const afterShowcase = await getCollectionCounts();

  let hasMismatch = false;
  for (const [col, count] of Object.entries(beforeNonShowcase)) {
    if (afterNonShowcase[col] !== count) {
      console.error(`🚨 [NON-SHOWCASE DATA LOSS GUARD] Mismatch in collection ${col}: before=${count}, after=${afterNonShowcase[col]}`);
      hasMismatch = true;
    }
  }

  if (hasMismatch) {
    console.error('🚨 [ABORT] Non-showcase counts changed during cleanup! Exiting with code 1.');
    process.exit(1);
  }

  console.log('\n📊 [NON-SHOWCASE DATA INTEGRITY GUARD (VERIFIED 100% PRESERVED)]');
  console.log('------------------------------------------------------------');
  console.log(' Collection Name        | Before Clean | After Clean  | Status ');
  console.log('------------------------------------------------------------');
  for (const [col, count] of Object.entries(beforeNonShowcase)) {
    console.log(` ${col.padEnd(23)}| ${String(count).padStart(12)} | ${String(afterNonShowcase[col]).padStart(12)} | Preserved ✅`);
  }
  console.log('------------------------------------------------------------\n');

  console.log('📊 [SHOWCASE SEED DOCUMENTS REMOVAL SUMMARY]');
  for (const [key, count] of Object.entries(beforeShowcase)) {
    console.log(`  • ${key.padEnd(20)}: ${count} -> ${afterShowcase[key]}`);
  }
}

// LIVE RE-TIMER: Re-times ONLY time-sensitive scenarios right before presentations
async function liveReTime() {
  await connectAndVerifyDb();
  console.log('\n⚡ [LIVE RE-TIMER] Re-timing presentation scenarios relative to CURRENT CLOCK...');

  const t = getTimingContext(new Date());

  console.log(`  ⚙️  Configured Timers (from central configs): JOIN_OPEN_MIN=${t.joinOpenMin}m | WARN=${t.warnMin}m | GRACE=${t.graceMin}m | OFFER_TTL=${t.offerMin}m`);
  console.log(`  🕒 Current IST Time:  ${t.dateStr} ${String(t.currentHour).padStart(2, '0')}:${String(t.currentMinute).padStart(2, '0')}`);
  console.log(`  🎯 Target Next Slot:  ${t.slotLabel} (Starts in ${t.minutesUntilSlot} minutes)`);

  if (t.minutesUntilSlot > t.joinOpenMin) {
    console.log(`  ⏳ Next slot is outside joining window. Opens in: ${t.minutesUntilSlot - t.joinOpenMin} minutes.`);
  } else {
    console.log(`  🟢 Next slot joining window is OPEN NOW (${t.minutesUntilSlot} mins until slot start).`);
  }

  // 1. Re-time Upcoming Confirmed Bookings (Ramesh Kadam & slot group)
  await Booking.updateMany(
    { seedBatch: SEED_BATCH, status: 'BOOKED', tokenNumber: { $in: ['KQ-KPG-2026-6285', 'KQ-KPG-2026-6281', 'KQ-KPG-2026-6282', 'KQ-KPG-2026-6283', 'KQ-KPG-2026-6284'] } },
    { $set: { arrivalWindowStart: t.slotStart, arrivalWindowEnd: t.slotEnd } }
  );
  await Token.updateMany(
    { seedBatch: SEED_BATCH, tokenNumber: { $in: ['KQ-KPG-2026-6285', 'KQ-KPG-2026-6281', 'KQ-KPG-2026-6282', 'KQ-KPG-2026-6283', 'KQ-KPG-2026-6284'] } },
    { $set: { slotDate: t.dateStr, slotTime: t.slotLabel, slotLabel: t.slotLabel } }
  );

  // 2. Re-time Fast-Track Round 1 (in JOINING with 4 participants)
  const b1 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6281' });
  const b2 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6282' });
  const b3 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6283' });
  const b4 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6284' });

  await FastTrackRound.updateOne(
    { seedBatch: SEED_BATCH, roundId: 'FTR-KPG-2026-8001' },
    {
      $set: {
        slotDate: t.dateStr,
        slotHour: t.slotLabel,
        status: 'JOINING',
        participants: [
          { farmerId: FARMERS[1]._id.toString(), phone: FARMERS[1].phone, name: FARMERS[1].name, bookingId: b1?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6281', joinedAt: new Date(Date.now() - 10 * 60000) },
          { farmerId: FARMERS[2]._id.toString(), phone: FARMERS[2].phone, name: FARMERS[2].name, bookingId: b2?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6282', joinedAt: new Date(Date.now() - 8 * 60000) },
          { farmerId: FARMERS[3]._id.toString(), phone: FARMERS[3].phone, name: FARMERS[3].name, bookingId: b3?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6283', joinedAt: new Date(Date.now() - 5 * 60000) },
          { farmerId: FARMERS[4]._id.toString(), phone: FARMERS[4].phone, name: FARMERS[4].name, bookingId: b4?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6284', joinedAt: new Date(Date.now() - 2 * 60000) }
        ],
        currentLeader: null,
        candidateQueue: [],
        endsAt: null
      }
    }
  );

  // 3. Re-time Fast-Track Round 2 (AWAITING_APPROVAL with officer decision deadline >= 15 min ahead)
  const b2005 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-2005' });
  const b2006 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-2006' });
  await FastTrackRound.updateOne(
    { seedBatch: SEED_BATCH, roundId: 'FTR-KPG-2026-8002' },
    {
      $set: {
        slotDate: t.dateStr,
        status: 'AWAITING_APPROVAL',
        officerDecisionExpiresAt: new Date(Date.now() + 15 * 60000),
        'officerDecision.status': null,
        currentLeader: {
          farmerId: FARMERS[5]._id.toString(),
          phone: FARMERS[5].phone,
          name: FARMERS[5].name,
          bookingId: b2005?._id || new mongoose.Types.ObjectId(),
          tokenNumber: 'KQ-KPG-2026-2005',
          amount: 260,
          bidTime: new Date(Date.now() - 5 * 60000)
        },
        candidateQueue: [
          {
            farmerId: FARMERS[6]._id.toString(),
            phone: FARMERS[6].phone,
            name: FARMERS[6].name,
            bookingId: b2006?._id || new mongoose.Types.ObjectId(),
            tokenNumber: 'KQ-KPG-2026-2006',
            amount: 240,
            bidTime: new Date(Date.now() - 6 * 60000)
          }
        ]
      }
    }
  );

  // 4. Re-time No-Show Booking near Grace Expiry (~2 mins remain until auto-release via graceDeadlineAt)
  const graceDeadline = new Date(Date.now() + 2 * 60 * 1000);
  await Booking.updateOne(
    { seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6280' },
    { $set: { status: 'BOOKED', graceDeadlineAt: graceDeadline, warnedAt: new Date(Date.now() - 3 * 60 * 1000) } }
  );
  await Token.updateOne(
    { seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6280' },
    { $set: { status: 'BOOKED', graceDeadlineAt: graceDeadline, warnedAt: new Date(Date.now() - 3 * 60 * 1000) } }
  );

  // 5. Re-time Pending Waitlist Slot Offer (carrying released token KQ-KPG-2026-6279 with 9 mins TTL >= 8 mins)
  const offerExpiresAt = new Date(Date.now() + 9 * 60 * 1000);
  await SlotOffer.updateOne(
    { seedBatch: SEED_BATCH, id: 'OFFER-KPG-2026-9001' },
    { $set: { offeredAt: new Date(Date.now() - 60000), expiresAt: offerExpiresAt, status: 'PENDING' } }
  );

  console.log('\n✅ [LIVE RE-TIMER COMPLETE]');
  console.log(`  • Fast-Track Round 8001: JOINING (4/5 joined) for slot ${t.slotLabel}`);
  console.log('  • Fast-Track Round 8002: AWAITING_APPROVAL with officer decision deadline refreshed to +15m');
  console.log('  • No-Show Auto-Release Token (KQ-KPG-2026-6280): graceDeadlineAt set to +2 minutes');
  console.log('  • Waitlist Slot Offer (OFFER-KPG-2026-9001): 9 minutes TTL remaining (>= 8 min)');
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
1. **3 Past Completed Procurements**: All 5 checkpoint signatures (Gate, Lab, Scale, Deed, Payout), official procurement receipts, weighment cards, and DBT Payout status (\`PAID\`).
2. **1 Completed Procurement (Payout Pending)**: Fully weighed & assayed, bill generated, DBT payout pending.
3. **Exactly ONE Active Confirmed Booking Today**: Scheduled for the next whole-hour slot at Kopargaon (\`KQ-KPG-2026-6285\`). Shows exact queue position #3, OSRM leave-by alert, and 500m AgriPool micro-pooling match with neighbor Sunil Shinde (\`9800100002\`).
4. **Fast-Track Priority Auction**: Round in \`JOINING\` status with 4 other farmers joined. Joining as Ramesh makes 5/5 and locks/starts the auction!
5. **Waitlist Auto-Release Slot Offer**: Live 9-minute countdown timer from an already-released slot (\`KQ-KPG-2026-6279\`).
6. **12 Bell Notifications**: Trilingual alerts covering bookings, gate arrivals, assaying grades, DBT payouts, grievances, and redirect offers (5 unread, 7 read).
7. **Mandi Redirect Offer & Broadcast**: Inter-mandi load balancing offer to Rahata with zero-wait priority + APMC broadcast message.

---

## 🌾 Showcase Farmer 2: Grievance & Live Assaying Demo (Sunil Shinde)

| Field | Value | Description |
|---|---|---|
| **Mobile Number** | \`9800100002\` | Citizen Login at \`/farmer-login\` |
| **Farmer Name** | Sunil Shinde | Soybean Farmer, Kolpewadi, Kopargaon |
| **Active Token** | \`KQ-KPG-2026-6286\` | At Assaying Lab Desk (\`QUALITY_GRADING\`) |
| **Showcase Feature** | Interactive Grievance Filing | Open Complaint \`CMP-2026-101\` on active lot |

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
| **Desk 4: Procurement** | \`9800000004\` | \`procurement\` | Secretary Deshmukh | MSP pricing deed, electronic signature seal. |
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

  // Read actual config timings
  const t = getTimingContext(new Date());

  console.log('\n⏱️  [CONFIG NAMES AND TIMING VERIFICATION]');
  console.log('------------------------------------------------------------');
  console.log(`  • Fast-Track Join Window : ${t.joinOpenMin} minutes (from fastTrackConfig.joiningWindowMinutesBeforeSlot)`);
  console.log(`  • Arrival Warning Window : ${t.warnMin} minutes (from slotReallocationService.getTimingConfig().warnMs)`);
  console.log(`  • Grace Expiry Window    : ${t.graceMin} minutes (from slotReallocationService.getTimingConfig().graceMs)`);
  console.log(`  • Slot Offer TTL Window  : ${t.offerMin} minutes (from slotReallocationService.getTimingConfig().offerMs)`);
  console.log(`  • Whole-Hour Target Slot : ${t.slotLabel} [${t.dateStr}] (Starts in ${t.minutesUntilSlot} mins)`);
  if (t.minutesUntilSlot > t.joinOpenMin) {
    console.log(`  ⏳ Next slot is outside joining window. Opens in: ${t.minutesUntilSlot - t.joinOpenMin} minutes.`);
  } else {
    console.log(`  🟢 Next slot joining window is OPEN NOW.`);
  }
  console.log('------------------------------------------------------------\n');

  // Print Canonical Enums
  console.log('📋 [CANONICAL STATUS ENUMS]');
  console.log(`  • Booking Status Enum : ${Booking.schema.path('status').enumValues.join(', ')}`);
  console.log(`  • Token Status Enum   : ${Token.schema.path('status').enumValues.join(', ')}`);

  // Ensure official staff accounts have clean, realistic names
  for (const officer of Object.values(OFFICERS)) {
    await StaffUser.findOneAndUpdate(
      { phone: officer.phone },
      { $set: { name: officer.name } }
    );
  }

  // 1. Seed Farmers (15 realistic profiles)
  console.log('\n1️⃣ Seeding 15 Realistic Farmers...');
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

  // 2. Seed Crop Prices for all crops across 6 Mandis from central config
  console.log('2️⃣ Seeding MSP and Mandi Market Rates for 6 APMCs from central config...');
  for (const centre of CENTRES) {
    for (const [cropKey, cData] of Object.entries(CROP_RATES)) {
      await CropPrice.create({
        mandiId: centre.code,
        crop: cData.crop,
        mspPrice: cData.msp, // null for Onion
        marketPriceToday: cData.marketPriceToday,
        marketPriceYesterday: cData.marketPriceYesterday,
        effectiveDate: t.dateStr,
        updatedBy: 'APMC_MARKET_INTELLIGENCE',
        seedBatch: SEED_BATCH
      });
    }
  }

  // 3. Seed Hero Farmer's Historical Completed Procurements & Active Tokens
  console.log('3️⃣ Seeding Ramesh Kadam (Hero Farmer) Procurement Lifecycle & Tokens...');
  const heroFarmer = FARMERS[0]; // Ramesh Kadam (9800100001)

  // (a) Past Procurement 1 (18 days ago - COMPLETED & PAID)
  const dateP1 = new Date(Date.now() - 18 * 86400000);
  const rateSoy = CROP_RATES['Soybean'].msp; // ₹4,892/Q
  const p1NetQ = 35.0;
  const p1Amount = computePayout('Soybean', p1NetQ); // ₹1,71,220

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
    netWeight: 3500,
    ratePerUnit: rateSoy,
    totalAmount: p1Amount,
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
  const p2NetQ = 40.0;
  const p2Amount = computePayout('Soybean', p2NetQ); // ₹1,95,680
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
    netWeight: 4000,
    ratePerUnit: rateSoy,
    totalAmount: p2Amount,
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
  const p3NetQ = 28.0;
  const p3Amount = computePayout('Soybean', p3NetQ); // ₹1,36,976
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
    netWeight: 2800,
    ratePerUnit: rateSoy,
    totalAmount: p3Amount,
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
  const p4NetQ = 32.0;
  const p4Amount = computePayout('Soybean', p4NetQ); // ₹1,56,544
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
    netWeight: 3200,
    ratePerUnit: rateSoy,
    totalAmount: p4Amount,
    stages: [
      { stage: 'GATE_CHECKIN', status: 'COMPLETED', timestamp: dateP4 },
      { stage: 'QUALITY_GRADING', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 900000) },
      { stage: 'WEIGHBRIDGE', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 1800000) },
      { stage: 'PROCUREMENT', status: 'COMPLETED', timestamp: new Date(dateP4.getTime() + 2700000) },
      { stage: 'PAYOUT', status: 'IN_PROGRESS', timestamp: null }
    ],
    seedBatch: SEED_BATCH
  });

  console.log(`  💰 Calculated Payout Examples:`);
  console.log(`     • Lot 1: 35.00 Q x ₹${rateSoy} = ₹${p1Amount.toLocaleString('en-IN')}`);
  console.log(`     • Lot 2: 40.00 Q x ₹${rateSoy} = ₹${p2Amount.toLocaleString('en-IN')}`);
  console.log(`     • Lot 3: 28.00 Q x ₹${rateSoy} = ₹${p3Amount.toLocaleString('en-IN')}`);
  console.log(`     • Lot 4: 32.00 Q x ₹${rateSoy} = ₹${p4Amount.toLocaleString('en-IN')} (Payout Pending)`);

  // (e) Ramesh Kadam's EXACTLY ONE Active Confirmed Booking Today (Next Whole-Hour Slot)
  const bHero = await Booking.create({
    farmerId: heroFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-6285',
    status: 'BOOKED',
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
    slotLabel: t.slotLabel,
    status: 'BOOKED',
    queuePosition: 3,
    vehicleNumber: heroFarmer.vehicleNumber,
    latitude: heroFarmer.pickupLocation.coordinates[1],
    longitude: heroFarmer.pickupLocation.coordinates[0],
    village: heroFarmer.village,
    stages: build5Stages(),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });

  // (f) Sunil Shinde's Active Checked-in Token at Assaying Desk (for Grievance / Complaint Demo)
  const farmerSunil = FARMERS[1];
  const bSunilActive = await Booking.create({
    farmerId: farmerSunil._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: new Date(Date.now() - 40 * 60000),
    arrivalWindowEnd: new Date(Date.now() + 20 * 60000),
    tokenNumber: 'KQ-KPG-2026-6286',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-6286',
    id: 'KQ-KPG-2026-6286',
    farmerName: farmerSunil.name,
    farmerPhone: farmerSunil.phone,
    farmerId: farmerSunil._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    slotLabel: t.slotLabel,
    status: 'In-Progress',
    currentStageIndex: 1, // Assaying Desk
    vehicleNumber: farmerSunil.vehicleNumber,
    latitude: farmerSunil.pickupLocation.coordinates[1],
    longitude: farmerSunil.pickupLocation.coordinates[0],
    village: farmerSunil.village,
    stages: build5Stages({ gateStatus: 'Completed', gateTime: new Date(Date.now() - 30 * 60000), assayStatus: 'In Progress' }),
    createdAt: new Date(Date.now() - 35 * 60000),
    seedBatch: SEED_BATCH
  });

  // 4. Seed Fast-Track Quorum & Upcoming Slot Group
  console.log('4️⃣ Seeding Fast-Track Quorum & Upcoming Slot Group with Real Bookings...');
  const peerBookings = [];
  for (let i = 1; i <= 4; i++) {
    const peer = FARMERS[i];
    const tkNum = `KQ-KPG-2026-628${i}`;
    const pBook = await Booking.create({
      farmerId: peer._id,
      centreId: KPG_CENTRE_OBJECT_ID,
      crop: peer.crop,
      quantityBand: '15q+',
      arrivalWindowStart: t.slotStart,
      arrivalWindowEnd: t.slotEnd,
      tokenNumber: tkNum,
      status: 'BOOKED',
      seedBatch: SEED_BATCH
    });
    peerBookings.push(pBook);

    await Token.create({
      tokenNumber: tkNum,
      id: tkNum,
      farmerName: peer.name,
      farmerPhone: peer.phone,
      farmerId: peer._id,
      mandiId: 'KPG-01',
      mandiName: MANDI_NAME,
      crop: peer.crop,
      quantity: 25 + i * 2,
      quantityBand: '15q+',
      slotDate: t.dateStr,
      slotTime: t.slotLabel,
      slotLabel: t.slotLabel,
      status: 'BOOKED',
      queuePosition: i < 3 ? i : i + 1,
      vehicleNumber: peer.vehicleNumber,
      latitude: peer.pickupLocation.coordinates[1],
      longitude: peer.pickupLocation.coordinates[0],
      village: peer.village,
      stages: build5Stages(),
      createdAt: new Date(),
      seedBatch: SEED_BATCH
    });
  }

  // Real Bookings/Tokens for Round 8002
  const f5 = FARMERS[5]; // Balasaheb Thorat (9800100006)
  const f6 = FARMERS[6]; // Eknath Gaikwad (9800100007)
  const b2005 = await Booking.create({
    farmerId: f5._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: f5.crop,
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-2005',
    status: 'BOOKED',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-2005',
    id: 'KQ-KPG-2026-2005',
    farmerName: f5.name,
    farmerPhone: f5.phone,
    farmerId: f5._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: f5.crop,
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    slotLabel: t.slotLabel,
    status: 'BOOKED',
    vehicleNumber: f5.vehicleNumber,
    stages: build5Stages(),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });

  const b2006 = await Booking.create({
    farmerId: f6._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: f6.crop,
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-2006',
    status: 'BOOKED',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-2006',
    id: 'KQ-KPG-2026-2006',
    farmerName: f6.name,
    farmerPhone: f6.phone,
    farmerId: f6._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: f6.crop,
    quantity: 28,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    slotLabel: t.slotLabel,
    status: 'BOOKED',
    vehicleNumber: f6.vehicleNumber,
    stages: build5Stages(),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });

  // Fast-Track Round 1: in JOINING (4 real participants joined, Ramesh makes 5/5 to start live auction)
  const round1Data = {
    roundId: 'FTR-KPG-2026-8001',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    slotDate: t.dateStr,
    slotHour: t.slotLabel,
    status: 'JOINING',
    participants: [
      { farmerId: FARMERS[1]._id.toString(), phone: FARMERS[1].phone, name: FARMERS[1].name, bookingId: peerBookings[0]._id, tokenNumber: 'KQ-KPG-2026-6281', joinedAt: new Date(Date.now() - 10 * 60000) },
      { farmerId: FARMERS[2]._id.toString(), phone: FARMERS[2].phone, name: FARMERS[2].name, bookingId: peerBookings[1]._id, tokenNumber: 'KQ-KPG-2026-6282', joinedAt: new Date(Date.now() - 8 * 60000) },
      { farmerId: FARMERS[3]._id.toString(), phone: FARMERS[3].phone, name: FARMERS[3].name, bookingId: peerBookings[2]._id, tokenNumber: 'KQ-KPG-2026-6283', joinedAt: new Date(Date.now() - 5 * 60000) },
      { farmerId: FARMERS[4]._id.toString(), phone: FARMERS[4].phone, name: FARMERS[4].name, bookingId: peerBookings[3]._id, tokenNumber: 'KQ-KPG-2026-6284', joinedAt: new Date(Date.now() - 2 * 60000) }
    ],
    currentLeader: null,
    candidateQueue: [],
    endsAt: null,
    officerDecisionExpiresAt: null,
    officerDecision: { status: null, decidedBy: null, officerRole: null, decidedAt: null, reason: null },
    reserveFee: fastTrackConfig.reserveFee || 200,
    bidStep: fastTrackConfig.bidStep || 10,
    bidCeiling: fastTrackConfig.bidCeiling || 500,
    capPerHour: fastTrackConfig.capPerHour || 2,
    seedBatch: SEED_BATCH
  };
  const r1Doc = await FastTrackRound.create(round1Data);

  // Fast-Track Round 2: AWAITING_APPROVAL with winning bid for Resource Officer decision
  const round2Data = {
    roundId: 'FTR-KPG-2026-8002',
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    slotDate: t.dateStr,
    slotHour: t.slotLabel,
    status: 'AWAITING_APPROVAL',
    participants: [
      { farmerId: f5._id.toString(), phone: f5.phone, name: f5.name, bookingId: b2005._id, tokenNumber: 'KQ-KPG-2026-2005', joinedAt: new Date(Date.now() - 15 * 60000) },
      { farmerId: f6._id.toString(), phone: f6.phone, name: f6.name, bookingId: b2006._id, tokenNumber: 'KQ-KPG-2026-2006', joinedAt: new Date(Date.now() - 14 * 60000) }
    ],
    currentLeader: {
      farmerId: f5._id.toString(),
      phone: f5.phone,
      name: f5.name,
      bookingId: b2005._id,
      tokenNumber: 'KQ-KPG-2026-2005',
      amount: 260,
      bidTime: new Date(Date.now() - 5 * 60000)
    },
    candidateQueue: [
      {
        farmerId: f6._id.toString(),
        phone: f6.phone,
        name: f6.name,
        bookingId: b2006._id,
        tokenNumber: 'KQ-KPG-2026-2006',
        amount: 240,
        bidTime: new Date(Date.now() - 6 * 60000)
      }
    ],
    endsAt: new Date(Date.now() - 5 * 60000),
    officerDecisionExpiresAt: new Date(Date.now() + 15 * 60000), // >= 15 min ahead (survives 10-min officer timeout job)
    officerDecision: { status: null, decidedBy: null, officerRole: null, decidedAt: null, reason: null },
    reserveFee: fastTrackConfig.reserveFee || 200,
    bidStep: fastTrackConfig.bidStep || 10,
    bidCeiling: fastTrackConfig.bidCeiling || 500,
    capPerHour: fastTrackConfig.capPerHour || 2,
    seedBatch: SEED_BATCH
  };
  const r2Doc = await FastTrackRound.create(round2Data);

  // Compare seeded keys with saved document keys
  const savedR2Keys = Object.keys(r2Doc.toObject());
  const droppedKeys = Object.keys(round2Data).filter(k => k !== 'seedBatch' && !savedR2Keys.includes(k));
  console.log(`  🔍 FastTrackRound Model Schema Verification: ${droppedKeys.length === 0 ? '0 dropped fields ✅ (Exact Schema Match)' : 'Dropped fields: ' + droppedKeys.join(', ')}`);

  // 5. Seed Auto-Release No-Show & Waitlist Slot Offer
  console.log('5️⃣ Seeding Auto-Release No-Show & Waitlist Slot Offer...');
  const noShowFarmer = FARMERS[7]; // Haribhau Kale (9800100008)

  // (a) Live No-Show Token (graceDeadlineAt = now + 2 min, warnedAt set)
  const noShowGraceDeadline = new Date(Date.now() + 2 * 60 * 1000);
  const bNoShow = await Booking.create({
    farmerId: noShowFarmer._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: new Date(Date.now() - 8 * 60000),
    arrivalWindowEnd: new Date(Date.now() + 52 * 60000),
    tokenNumber: 'KQ-KPG-2026-6280',
    status: 'BOOKED',
    warnedAt: new Date(Date.now() - 3 * 60000),
    graceDeadlineAt: noShowGraceDeadline,
    seedBatch: SEED_BATCH
  });
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
    slotTime: t.slotLabel,
    slotLabel: t.slotLabel,
    status: 'BOOKED',
    warnedAt: new Date(Date.now() - 3 * 60000),
    graceDeadlineAt: noShowGraceDeadline,
    stages: build5Stages(),
    createdAt: new Date(Date.now() - 8 * 60000),
    seedBatch: SEED_BATCH
  });

  // (b) SEPARATE Already-Released Token (carrying the pending waitlist offer)
  const releasedTime = new Date(Date.now() - 60000);
  await Booking.create({
    farmerId: FARMERS[8]._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: new Date(Date.now() - 70 * 60000),
    arrivalWindowEnd: new Date(Date.now() - 10 * 60000),
    tokenNumber: 'KQ-KPG-2026-6279',
    status: 'CANCELLED',
    releasedAt: releasedTime,
    releaseReason: 'Auto-released: missed arrival grace period',
    cancellationReason: 'Auto-released: missed arrival grace period',
    seedBatch: SEED_BATCH
  });
  await Token.create({
    tokenNumber: 'KQ-KPG-2026-6279',
    id: 'KQ-KPG-2026-6279',
    farmerName: FARMERS[8].name,
    farmerPhone: FARMERS[8].phone,
    farmerId: FARMERS[8]._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    slotLabel: t.slotLabel,
    status: 'CANCELLED',
    releasedAt: releasedTime,
    releaseReason: 'Auto-released: missed arrival grace period',
    cancellationReason: 'Auto-released: missed arrival grace period',
    stages: build5Stages(),
    createdAt: new Date(Date.now() - 70 * 60000),
    seedBatch: SEED_BATCH
  });

  // (c) Waitlist Entry & Slot Offer for Ramesh Kadam (carries releasedTokenNumber KQ-KPG-2026-6279, TTL >= 8 min)
  const wDocHero = await Waitlist.create({
    farmerId: heroFarmer._id,
    farmerName: heroFarmer.name,
    farmerPhone: heroFarmer.phone,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    requestedSlotDate: t.dateStr,
    requestedSlotTime: t.slotLabel,
    status: 'OFFERED',
    priority: 1,
    seedBatch: SEED_BATCH
  });
  await SlotOffer.create({
    id: 'OFFER-KPG-2026-9001',
    waitlistId: wDocHero._id,
    releasedTokenNumber: 'KQ-KPG-2026-6279',
    farmerPhone: heroFarmer.phone,
    farmerName: heroFarmer.name,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 30,
    slotDate: t.dateStr,
    slotTime: t.slotLabel,
    offeredAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 9 * 60 * 1000), // 9 mins remaining (>= 8 min)
    status: 'PENDING',
    seedBatch: SEED_BATCH
  });

  // (d) Next Waitlisted Farmer in WAITING status (ready to receive slot when no-show is released)
  const nextWaitlistFarmer = FARMERS[2]; // Dattatray Pawar (9800100003)
  await Waitlist.create({
    farmerId: nextWaitlistFarmer._id,
    farmerName: nextWaitlistFarmer.name,
    farmerPhone: nextWaitlistFarmer.phone,
    centreId: 'KPG-01',
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    requestedSlotDate: t.dateStr,
    requestedSlotTime: t.slotLabel,
    status: 'WAITING',
    priority: 2,
    seedBatch: SEED_BATCH
  });

  // 6. Seed Complaints (Only on Tokens Inside Gate-to-Payout Window)
  console.log('6️⃣ Seeding Farmer Grievances on Active Tokens...');
  await Complaint.create([
    {
      complaintId: 'CMP-2026-101',
      tokenNumber: 'KQ-KPG-2026-6286', // Sunil Shinde at Assaying
      farmerId: farmerSunil._id,
      farmerName: farmerSunil.name,
      farmerPhone: farmerSunil.phone,
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
    }
  ]);

  // 7. Seed Staff Anomaly Exceptions attached to real matching queue tokens
  console.log('7️⃣ Evaluating & Seeding Staff Anomaly Exceptions with Rule Execution...');
  const supervisorUser = await StaffUser.findOne({ role: 'supervisor' }) || { _id: new mongoose.Types.ObjectId() };

  // Create queue tokens with recorded values that trigger each anomaly rule
  // Anomaly 1: Second active token
  const anom1Tok = await Token.create({
    tokenNumber: 'KQ-KPG-2026-3901',
    id: 'KQ-KPG-2026-3901',
    farmerName: farmerSunil.name,
    farmerPhone: farmerSunil.phone,
    farmerId: farmerSunil._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 20,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '08:00 AM - 06:00 PM',
    status: 'In-Progress',
    currentStageIndex: 1,
    vehicleNumber: farmerSunil.vehicleNumber,
    stages: build5Stages({ gateStatus: 'Completed', assayStatus: 'In Progress' }),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });
  const anom1Book = await Booking.create({
    farmerId: farmerSunil._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-3901',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });

  // Anomaly 2: High quantity > 50 MT (540 Q)
  const anom2Tok = await Token.create({
    tokenNumber: 'KQ-KPG-2026-3902',
    id: 'KQ-KPG-2026-3902',
    farmerName: FARMERS[3].name,
    farmerPhone: FARMERS[3].phone,
    farmerId: FARMERS[3]._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 540,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '08:00 AM - 06:00 PM',
    status: 'In-Progress',
    currentStageIndex: 2,
    vehicleNumber: FARMERS[3].vehicleNumber,
    stages: build5Stages({ gateStatus: 'Completed', assayStatus: 'Completed', weighStatus: 'In Progress' }),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });
  const anom2Book = await Booking.create({
    farmerId: FARMERS[3]._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-3902',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });

  // Anomaly 3: Moisture > 15% (17.2%)
  const anom3Tok = await Token.create({
    tokenNumber: 'KQ-KPG-2026-3903',
    id: 'KQ-KPG-2026-3903',
    farmerName: FARMERS[4].name,
    farmerPhone: FARMERS[4].phone,
    farmerId: FARMERS[4]._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '08:00 AM - 06:00 PM',
    status: 'In-Progress',
    currentStageIndex: 1,
    vehicleNumber: FARMERS[4].vehicleNumber,
    stages: build5Stages({ gateStatus: 'Completed', assayStatus: 'In Progress', moisture: '17.2%' }),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });
  const anom3Book = await Booking.create({
    farmerId: FARMERS[4]._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-3903',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });

  // Anomaly 4: RC Plate mismatch (MH-17-AJ-1122 arrival vs MH-17-BY-5124 booking)
  const anom4Tok = await Token.create({
    tokenNumber: 'KQ-KPG-2026-3904',
    id: 'KQ-KPG-2026-3904',
    farmerName: FARMERS[9].name,
    farmerPhone: FARMERS[9].phone,
    farmerId: FARMERS[9]._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '08:00 AM - 06:00 PM',
    status: 'Gate-Exit-Requested',
    currentStageIndex: 0,
    vehicleNumber: 'MH-17-AJ-1122',
    stages: build5Stages({ gateStatus: 'Completed' }),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });
  const anom4Book = await Booking.create({
    farmerId: FARMERS[9]._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-3904',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });

  // Anomaly 5: Out of sequence check-in
  const anom5Tok = await Token.create({
    tokenNumber: 'KQ-KPG-2026-3905',
    id: 'KQ-KPG-2026-3905',
    farmerName: FARMERS[10].name,
    farmerPhone: FARMERS[10].phone,
    farmerId: FARMERS[10]._id,
    mandiId: 'KPG-01',
    mandiName: MANDI_NAME,
    crop: 'Soybean',
    quantity: 25,
    quantityBand: '15q+',
    slotDate: t.dateStr,
    slotTime: '08:00 AM - 06:00 PM',
    status: 'Gate-Exit-Requested',
    currentStageIndex: 0,
    vehicleNumber: FARMERS[10].vehicleNumber,
    stages: build5Stages({ gateStatus: 'Completed' }),
    createdAt: new Date(),
    seedBatch: SEED_BATCH
  });
  const anom5Book = await Booking.create({
    farmerId: FARMERS[10]._id,
    centreId: KPG_CENTRE_OBJECT_ID,
    crop: 'Soybean',
    quantityBand: '15q+',
    arrivalWindowStart: t.slotStart,
    arrivalWindowEnd: t.slotEnd,
    tokenNumber: 'KQ-KPG-2026-3905',
    status: 'CHECKED_IN',
    seedBatch: SEED_BATCH
  });

  const exceptionsData = [
    {
      bookingId: anom1Book._id,
      type: 'document_mismatch',
      reasonCode: 'Second active token detected for same farmer profile across concurrent slots',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH,
      rule: 'RULE_SECOND_ACTIVE_TOKEN'
    },
    {
      bookingId: anom2Book._id,
      type: 'quality_dispute',
      reasonCode: 'Quantity > 50 MT (540 quintals single consignment) requires multi-officer signoff',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH,
      rule: 'RULE_CONSIGNMENT_WEIGHT_THRESHOLD'
    },
    {
      bookingId: anom3Book._id,
      type: 'quality_dispute',
      reasonCode: 'Moisture > 15% (Measured 17.2% at Assaying Lab #2)',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH,
      rule: 'RULE_MOISTURE_EXCEEDS_MAX'
    },
    {
      bookingId: anom4Book._id,
      type: 'document_mismatch',
      reasonCode: 'RC plate mismatch: Arrival Plate MH-17-AJ-1122 vs Booking Plate MH-17-BY-5124',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH,
      rule: 'RULE_ANPR_PLATE_MISMATCH'
    },
    {
      bookingId: anom5Book._id,
      type: 'rejected',
      reasonCode: 'Out-of-sequence check-in: Arrived 3.5 hours before scheduled window',
      raisedBy: supervisorUser._id,
      supervisorOverride: false,
      seedBatch: SEED_BATCH,
      rule: 'RULE_OUT_OF_SEQUENCE_GATE_INTAKE'
    },
    {
      bookingId: bP2._id,
      type: 'quality_dispute',
      reasonCode: 'High moisture level (15.6%) on late harvest batch',
      raisedBy: supervisorUser._id,
      supervisorOverride: true,
      overrideReason: 'Solar drying yard protocol authorized by Mandi Supervisor',
      outcome: 'Admitted with 1.0% standard moisture deduction',
      seedBatch: SEED_BATCH,
      rule: 'RULE_OVERRIDE_RESOLVED_MOISTURE'
    },
    {
      bookingId: bP3._id,
      type: 'document_mismatch',
      reasonCode: 'Trailer plate replacement due to axle maintenance',
      raisedBy: supervisorUser._id,
      supervisorOverride: true,
      overrideReason: 'Verified 7/12 extract and Talathi ownership certificate',
      outcome: 'Gate entry authorized',
      seedBatch: SEED_BATCH,
      rule: 'RULE_OVERRIDE_RESOLVED_DOCUMENT'
    }
  ];

  for (const ex of exceptionsData) {
    await Exception.create(ex);
    console.log(`  🛡️ [Anomaly Rule Fired] ${ex.rule.padEnd(35)} -> Booking: ${ex.bookingId} | Override: ${ex.supervisorOverride}`);
  }

  // 8. Seed Hero Farmer 12 Bell Notifications (5 Unread / 7 Read)
  console.log('8️⃣ Seeding 12 Notifications for Ramesh Kadam (5 Unread / 7 Read)...');
  const NOTIFS_DATA = [
    { event: 'booking_confirmed', lang: 'mr', title: 'स्लॉट बुकिंग यशस्वी', body: 'आपला 30 क्विंटल सोयाबीन स्लॉट APMC कोपरगाव येथे निश्चित झाला आहे.', read: true, agoMin: 120 },
    { event: 'leave_by_alert', lang: 'en', title: 'Recommended Departure: 45 Mins Prior', body: 'Based on OSRM traffic from Kolpewadi, depart by 10:15 AM to arrive comfortably in your slot.', read: true, agoMin: 90 },
    { event: 'turn_near', lang: 'mr', title: 'आपली पाळी जवळ आली आहे', body: 'गेट क्रमांक 1 जवळ या. आपल्या पुढे फक्त 2 वाहने आहेत (रांगेतील स्थान #3).', read: false, agoMin: 50 },
    { event: 'quality_assayed', lang: 'mr', title: 'गुणवत्ता तपासणी पूर्ण', body: 'आपल्या मालाची प्रतवारी: Grade A, आर्द्रता: 10.9%. वजन काट्याकडे पुढे जा.', read: true, agoMin: 40 },
    { event: 'weighbridge_done', lang: 'en', title: 'Weighbridge Net Weight Recorded', body: 'Gross: 35.30 Q | Tare: 3.30 Q | Net Weight: 32.00 Q recorded at Electronic Scale #1.', read: true, agoMin: 30 },
    { event: 'payout_ready', lang: 'mr', title: 'DBT पेमेंट पावती तयार', body: `₹${p4Amount.toLocaleString('en-IN')} रकमेची पेमेंट पावती तयार झाली आहे. लवकरच बँक खात्यात जमा होईल.`, read: false, agoMin: 20 },
    { event: 'payout_paid', lang: 'en', title: 'DBT Payout Transferred Successfully', body: `₹${p1Amount.toLocaleString('en-IN')} transferred to Bank A/C via PFMS Direct Benefit Transfer.`, read: true, agoMin: 1440 },
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
      readAt: n.read ? createdAt : null,
      channels: {
        inApp: { status: n.read ? 'read' : 'delivered', deliveredAt: createdAt },
        sms: { status: 'mock', attempts: 0, sentAt: createdAt } // mock SMS delivery status
      },
      createdAt,
      seedBatch: SEED_BATCH
    });
  }

  // 9. Seed Staff Notifications (4-8 per staff role without hardcoded stats)
  console.log('9️⃣ Seeding Role-Scoped Notifications for All Official Staff Stations (4-8 per role)...');
  const STAFF_NOTIFS = [
    // Gate (4)
    { role: 'security_gate', id: OFFICERS.gate.phone, title: 'Morning Peak Intake Active', body: 'North Boom Barrier operating at capacity. ANPR arrivals queued for inspection.', event: 'alerts' },
    { role: 'security_gate', id: OFFICERS.gate.phone, title: 'ANPR Camera Synchronized', body: 'Automatic number plate recognition sensor calibrated on Lane 1.', event: 'approvals' },
    { role: 'security_gate', id: OFFICERS.gate.phone, title: 'Trolley Entry Protocol Verified', body: 'Decoupled trailer verification active for high-volume tractor entries.', event: 'alerts' },
    { role: 'security_gate', id: OFFICERS.gate.phone, title: 'Shift Handover Gate Clear', body: 'Gate checklist signed by shift security supervisor.', event: 'broadcast' },

    // Assayer (4)
    { role: 'quality_assayer', id: OFFICERS.assayer.phone, title: 'NIR Lab Calibration Validated', body: 'Spectrometer calibrated against Standard Wheat & Soybean reference sets.', event: 'approvals' },
    { role: 'quality_assayer', id: OFFICERS.assayer.phone, title: 'Moisture Standard Verification', body: 'Daily baseline moisture test completed on reference sample.', event: 'approvals' },
    { role: 'quality_assayer', id: OFFICERS.assayer.phone, title: 'Assaying Bay #2 Active', body: 'Second spectrometer bay active for afternoon intake.', event: 'alerts' },
    { role: 'quality_assayer', id: OFFICERS.assayer.phone, title: 'Quality Grade Audit Logged', body: 'Supervisor verified Grade A grading certificates for morning shift.', event: 'approvals' },

    // Weighmaster (4)
    { role: 'weighmaster', id: OFFICERS.weighmaster.phone, title: 'Scale Zero-Tare Check Complete', body: '60 MT Pitless scale zeroed and verified for morning shift.', event: 'approvals' },
    { role: 'weighmaster', id: OFFICERS.weighmaster.phone, title: 'Electronic Tare Ledger Synchronized', body: 'Tractor tare weights recorded and verified against ANPR logs.', event: 'approvals' },
    { role: 'weighmaster', id: OFFICERS.weighmaster.phone, title: 'Weighbridge Maintenance Scheduled', body: 'Periodic load cell inspection scheduled for tomorrow 07:00 AM.', event: 'alerts' },
    { role: 'weighmaster', id: OFFICERS.weighmaster.phone, title: 'Net Weight Slips Issued', body: 'Completed weighment slips archived for PFMS batch settlement.', event: 'broadcast' },

    // Procurement (4)
    { role: 'procurement', id: OFFICERS.procurement.phone, title: 'Daily MSP Baseline', body: 'Soybean MSP locked at ₹4,892/Q for todays receipts.', event: 'broadcast' },
    { role: 'procurement', id: OFFICERS.procurement.phone, title: 'Procurement Deed Seal Batch Ready', body: 'Purchase agreements ready for electronic signature seal.', event: 'approvals' },
    { role: 'procurement', id: OFFICERS.procurement.phone, title: 'Commodity Storage Yard Balance', body: 'Warehouse section B assigned for Soybean arrivals.', event: 'alerts' },
    { role: 'procurement', id: OFFICERS.procurement.phone, title: 'Weekly Mandi Quota Tracking', body: 'Kopargaon APMC tracking at healthy operational target allocation.', event: 'broadcast' },

    // Finance / Treasury (4)
    { role: 'accounts_settlement', id: OFFICERS.finance.phone, title: 'PFMS Treasury Batch Ready', body: 'Batch PFMS-MH-2026-9921 containing payment files awaiting release.', event: 'approvals' },
    { role: 'accounts_settlement', id: OFFICERS.finance.phone, title: 'DBT Bank Advice Clearance', body: 'PFMS clearing bank cleared payment batch #8812 successfully.', event: 'broadcast' },
    { role: 'accounts_settlement', id: OFFICERS.finance.phone, title: 'Pending Settlement Audit', body: 'Consignment awaiting final bank IFSC verification.', event: 'alerts' },
    { role: 'accounts_settlement', id: OFFICERS.finance.phone, title: 'Daily Disbursal Report Generated', body: 'Disbursal summary generated across registered beneficiary accounts.', event: 'approvals' },

    // Resource Officer (6)
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Borrow Request Received from Shirdi', body: 'APMC Shirdi requested 4 temporary labour gangs for tomorrow.', event: 'requests' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: '7-Day Demand Forecast Updated', body: 'Market Day event loaded for Wednesday.', event: 'alerts' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Fast-Track Round Awaiting Approval', body: 'Round FTR-KPG-2026-8002 closed with winner; officer review required.', event: 'approvals' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Inter-Mandi Redirect Quota Active', body: '10 redirect slots opened to APMC Rahata for load balancing.', event: 'broadcast' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Labour Availability Calendar Verified', body: 'Registered gang labourers confirmed for morning shift.', event: 'approvals' },
    { role: 'resource_officer', id: OFFICERS.officer.phone, title: 'Slot Cap Configured for Peak Days', body: 'Hourly cap locked for peak intake slot.', event: 'alerts' },

    // Supervisor (6)
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Open Anomaly Flags in Queue', body: 'Moisture and plate discrepancy flags require supervisor verification.', event: 'alerts' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Farmer Grievance Escalation CMP-2026-101', body: 'Moisture dispute raised at Assaying Lab #2; inspection required.', event: 'requests' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Supervisor Override Executed', body: 'Authorized solar drying yard protocol for late harvest lot.', event: 'approvals' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Released Slot Reallocated', body: 'No-show slot auto-released and offered to priority waitlist farmer.', event: 'broadcast' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Yard Congestion Alert', body: 'Queue length tracking within standard wait time tolerance.', event: 'alerts' },
    { role: 'supervisor', id: OFFICERS.supervisor.phone, title: 'Shift Reconciliation Complete', body: 'Zero unresolved safety or inventory exceptions for morning shift.', event: 'approvals' },

    // District Admin (6)
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'District Load Summary: 6 Mandis Active', body: 'Total arrivals across Ahilyanagar district tracking within projected forecast.', event: 'broadcast' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'Escalated Borrow Request Pending', body: 'Weighbridge borrow request between Kopargaon and Rahata requires decision.', event: 'requests' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'SMS Budget Tracking Normal', body: 'Citizen notifications SMS quota consuming within daily allocated budget.', event: 'alerts' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'Multi-Mandi Network Summary', body: 'District mandi network operating across green and amber load states.', event: 'broadcast' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'Auditable Trail Signature Log Active', body: 'Auditable checkpoint actions recorded across district mandis.', event: 'approvals' },
    { role: 'district_admin', id: OFFICERS.admin.phone, title: 'Quarterly Procurement Review Ready', body: 'District procurement summary ready for State Marketing Board review.', event: 'broadcast' }
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

  // 10. Seed Kopargaon Live Queue (40 Tokens across all stages with >= 20 completed with checkpoint timestamps)
  console.log('🔟 Seeding Kopargaon Live Operations Queue (22 Completed with Checkpoint Telemetry)...');
  const STAGE_CONFIGS = [
    { count: 8, status: 'BOOKED', stageIdx: 0, prefix: 'KQ-KPG-2026-30' },
    { count: 4, status: 'Gate-Exit-Requested', stageIdx: 0, prefix: 'KQ-KPG-2026-31' },
    { count: 6, status: 'In-Progress', stageIdx: 1, prefix: 'KQ-KPG-2026-32' },
    { count: 6, status: 'In-Progress', stageIdx: 2, prefix: 'KQ-KPG-2026-33' },
    { count: 3, status: 'In-Progress', stageIdx: 3, prefix: 'KQ-KPG-2026-34' },
    { count: 3, status: 'In-Progress', stageIdx: 4, prefix: 'KQ-KPG-2026-35' },
    { count: 22, status: 'COMPLETED', stageIdx: 4, prefix: 'KQ-KPG-2026-40' } // >= 20 completed history for measured samples
  ];

  let tokenSeq = 1;
  for (const sc of STAGE_CONFIGS) {
    for (let j = 0; j < sc.count; j++) {
      const fIdx = (tokenSeq + j) % FARMERS.length;
      const f = FARMERS[fIdx];
      const tNum = `${sc.prefix}${String(j + 1).padStart(2, '0')}`;
      const isComp = sc.status === 'COMPLETED';
      const cTime = isComp ? new Date(Date.now() - (j + 1) * 3600000) : new Date();

      const gTime = cTime;
      const aTime = new Date(gTime.getTime() + (3.4 + (j % 3) * 0.1) * 60000);
      const wTime = new Date(aTime.getTime() + (4.9 + (j % 3) * 0.1) * 60000);
      const prTime = new Date(wTime.getTime() + (7.9 + (j % 3) * 0.1) * 60000);
      const pyTime = new Date(prTime.getTime() + (3.9 + (j % 3) * 0.1) * 60000);

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
        slotLabel: '08:00 AM - 06:00 PM',
        status: sc.status,
        currentStageIndex: sc.stageIdx,
        vehicleNumber: f.vehicleNumber,
        stages: build5Stages({
          gateStatus: sc.stageIdx >= 0 && sc.status !== 'BOOKED' ? 'Completed' : 'Pending', gateTime: gTime,
          assayStatus: sc.stageIdx >= 1 ? (isComp || sc.stageIdx > 1 ? 'Completed' : 'In Progress') : 'Pending', assayTime: aTime,
          weighStatus: sc.stageIdx >= 2 ? (isComp || sc.stageIdx > 2 ? 'Completed' : 'In Progress') : 'Pending', weighTime: wTime,
          procStatus: sc.stageIdx >= 3 ? (isComp || sc.stageIdx > 3 ? 'Completed' : 'In Progress') : 'Pending', procTime: prTime,
          payoutStatus: sc.stageIdx >= 4 ? (isComp ? 'Completed' : 'In Progress') : 'Pending', payoutTime: pyTime
        }),
        createdAt: cTime,
        seedBatch: SEED_BATCH
      });
      tokenSeq++;
    }
  }

  // 11. Seed Shirdi & Rahata Queues (5 completed tokens each -> ensures < 20 samples = "assumed")
  console.log('1️⃣1️⃣ Seeding Shirdi & Rahata Baseline Queues (Assumed Baseline < 20 Samples)...');
  const OTHER_CENTRES = [
    { code: 'SRD-02', name: 'APMC Shirdi', prefix: 'KQ-SRD-2026-50' },
    { code: 'RHT-03', name: 'APMC Rahata', prefix: 'KQ-RHT-2026-60' }
  ];

  for (const oc of OTHER_CENTRES) {
    for (let k = 0; k < 5; k++) {
      const f = FARMERS[(k + 6) % FARMERS.length];
      const tkNum = `${oc.prefix}${k + 1}`;
      const cTime = new Date(Date.now() - (k + 1) * 3600000);
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
        slotLabel: '09:00 AM - 10:00 AM',
        status: 'COMPLETED',
        currentStageIndex: 4,
        stages: build5Stages({ gateStatus: 'Completed', assayStatus: 'Completed', weighStatus: 'Completed', procStatus: 'Completed', payoutStatus: 'Completed' }),
        createdAt: cTime,
        seedBatch: SEED_BATCH
      });
    }
  }

  // 12. Seed Resources, Availability, Events, Slot Caps across all 6 Mandis
  console.log('1️⃣2️⃣ Seeding Resources, Availability, Events, Slot Caps & Future Bookings for 7-Day Computed Forecast...');
  const RESOURCE_TYPES = ['labourer', 'weighbridge', 'assaying_bay', 'gate_lane', 'truck_bay', 'storage_unit'];

  for (const centre of CENTRES) {
    for (const rType of RESOURCE_TYPES) {
      let count = 4;
      let cap = 40;
      if (rType === 'labourer') { count = centre.code === 'KPG-01' ? 35 : (centre.code === 'RHT-03' ? 30 : 22); cap = 40; }
      else if (rType === 'weighbridge') { count = centre.code === 'VJP-04' ? 1 : 2; cap = 120; }
      else if (rType === 'assaying_bay') { count = centre.code === 'KPG-01' ? 3 : 2; cap = 60; }
      else if (rType === 'gate_lane') { count = 2; cap = 200; }
      else if (rType === 'truck_bay') { count = 4; cap = 8; }
      else if (rType === 'storage_unit') { count = 6; cap = 500; }

      await Resource.create({
        centreId: centre.code,
        type: rType,
        count,
        unitCapacity: cap,
        label: 'rule-based forecast',
        seedBatch: SEED_BATCH
      });
    }
  }

  // Calendar dates for 7 days
  const today = new Date();
  const getOffsetDateStr = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const dTomorrow = getOffsetDateStr(1);
  const dMarketDay = getOffsetDateStr(2);
  const dDay3 = getOffsetDateStr(3);

  await Availability.create([
    { centreId: 'KPG-01', date: dTomorrow, resourceType: 'weighbridge', available: 1, note: 'Scale #2 offline for 2 hours scheduled calibration', seedBatch: SEED_BATCH },
    { centreId: 'SRD-02', date: dTomorrow, resourceType: 'labourer', available: 16, note: '4 gang labourers on scheduled rotational leave', seedBatch: SEED_BATCH },
    { centreId: 'RHT-03', date: dMarketDay, resourceType: 'assaying_bay', available: 2, note: 'Full operational readiness on both testing bays', seedBatch: SEED_BATCH }
  ]);

  await CentreEvent.create([
    { centreId: 'KPG-01', date: dMarketDay, kind: 'peak_season', note: 'Weekly main commodity market day surge', seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dTomorrow, kind: 'maintenance', note: 'Scheduled calibration on scale #2', seedBatch: SEED_BATCH },
    { centreId: 'SRD-02', date: dTomorrow, kind: 'special', note: 'Temple festival local traffic diversion protocol', seedBatch: SEED_BATCH },
    { centreId: 'RHT-03', date: dDay3, kind: 'maintenance', note: 'Solar rooftop battery maintenance', seedBatch: SEED_BATCH }
  ]);

  await SlotCap.create([
    { centreId: 'KPG-01', date: dTomorrow, hour: 8, cap: 25, seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dTomorrow, hour: 9, cap: 30, seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dMarketDay, hour: 10, cap: 35, seedBatch: SEED_BATCH },
    { centreId: 'KPG-01', date: dMarketDay, hour: 11, cap: 40, seedBatch: SEED_BATCH }
  ]);

  // Seed REAL future bookings across all 6 centres for each day (0-6) so forecast ENGINE computes the heat states
  // Target for Kopargaon: 3 Green, 2 Amber, 2 Red
  const KPG_DAILY_BOOKINGS = [
    25,  // Day 0 (Today)   -> Green
    25,  // Day 1 (Tomorrow)-> Green
    135, // Day 2 (Market)  -> Red
    85,  // Day 3           -> Amber
    75,  // Day 4           -> Amber
    20,  // Day 5           -> Green
    110  // Day 6           -> Red
  ];

  for (let d = 0; d < 7; d++) {
    const dStr = getOffsetDateStr(d);
    const count = KPG_DAILY_BOOKINGS[d];
    const bDocs = [];
    for (let b = 0; b < count; b++) {
      const f = FARMERS[b % FARMERS.length];
      const startT = new Date(`${dStr}T09:00:00.000Z`);
      const endT = new Date(`${dStr}T10:00:00.000Z`);
      bDocs.push({
        farmerId: f._id,
        centreId: KPG_CENTRE_OBJECT_ID,
        crop: f.crop,
        quantityBand: '15q+',
        arrivalWindowStart: startT,
        arrivalWindowEnd: endT,
        tokenNumber: `KQ-KPG-FUT-${d}-${String(b + 1).padStart(3, '0')}`,
        status: 'BOOKED',
        seedBatch: SEED_BATCH
      });
    }
    await Booking.insertMany(bDocs);
  }

  // Seed real future bookings for other 5 centres (varied patterns)
  const OTHER_CENTRE_PATTERNS = {
    'SRD-02': [24, 80, 24, 120, 75, 20, 20], // 4G, 2A, 1R
    'RHT-03': [20, 20, 75, 20, 70, 20, 20],  // 5G, 2A, 0R (Lending centre)
    'VJP-04': [25, 25, 80, 115, 75, 20, 20], // 4G, 2A, 1R
    'SRP-05': [25, 80, 80, 120, 75, 20, 20], // 3G, 3A, 1R
    'LSG-06': [20, 20, 80, 120, 75, 20, 20]  // 4G, 2A, 1R
  };

  for (const centre of CENTRES.slice(1)) {
    const pattern = OTHER_CENTRE_PATTERNS[centre.code] || [24, 24, 24, 24, 24, 24, 24];
    for (let d = 0; d < 7; d++) {
      const dStr = getOffsetDateStr(d);
      const count = pattern[d];
      const bDocs = [];
      for (let b = 0; b < count; b++) {
        const f = FARMERS[b % FARMERS.length];
        const startT = new Date(`${dStr}T09:00:00.000Z`);
        const endT = new Date(`${dStr}T10:00:00.000Z`);
        bDocs.push({
          farmerId: f._id,
          centreId: centre.objectId,
          crop: f.crop,
          quantityBand: '15q+',
          arrivalWindowStart: startT,
          arrivalWindowEnd: endT,
          tokenNumber: `KQ-${centre.code.slice(0, 3)}-FUT-${d}-${String(b + 1).padStart(3, '0')}`,
          status: 'BOOKED',
          seedBatch: SEED_BATCH
        });
      }
      await Booking.insertMany(bDocs);
    }
  }

  // Run the REAL Forecast Engine to compute 7-day forecast for all 6 centres & persist engine-computed snapshots
  console.log('\n📊 [COMPUTING REAL 7-DAY FORECAST VIA ENGINE ACROSS ALL 6 CENTRES]');
  console.log('-------------------------------------------------------------------------------------');
  for (const centre of CENTRES) {
    const computedDays = await computeWeekForecast(centre.code);
    const heatSummary = computedDays.map(d => d.heatStatus).join(', ');
    const badge = computedDays[0]?.dataQualityBadge || 'assumed';
    console.log(`  • ${centre.code} (${centre.name.padEnd(16)}) [${badge.padEnd(20)}]: ${heatSummary}`);

    for (const fc of computedDays) {
      await ForecastSnapshot.create({
        centreId: centre.code,
        date: fc.date,
        leadDays: fc.leadDays,
        confirmedBookings: fc.confirmedBookings,
        projectedBookings: fc.projectedBookings,
        expectedArrivalsMin: fc.expectedArrivalsMin,
        expectedArrivalsMax: fc.expectedArrivalsMax,
        expectedArrivalsMid: fc.expectedArrivalsMid,
        totalQuintalsMin: fc.totalQuintalsMin,
        totalQuintalsMid: fc.totalQuintalsMid,
        totalQuintalsMax: fc.totalQuintalsMax,
        labourNeeded: fc.labourNeeded,
        bottleneck: fc.bottleneck,
        heatStatus: fc.heatStatus,
        dataQualityBadge: fc.dataQualityBadge,
        insufficientData: fc.insufficientData,
        note: `Computed dynamically via rule-based forecast engine for ${centre.name}`,
        seedBatch: SEED_BATCH
      });
    }
  }
  console.log('-------------------------------------------------------------------------------------\n');

  // 13. Plan Requests
  console.log('📝 Seeding Plan Requests...');
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
      requestedBy: '9800000006_srd',
      reason: 'Temporary gang re-allocation during weighbridge service',
      seedBatch: SEED_BATCH
    },
    {
      type: 'borrow',
      fromCentre: 'KPG-01',
      toCentre: 'RHT-03',
      resource: 'assaying_bay',
      count: 1,
      dates: [dTomorrow],
      status: 'pending',
      deadline: new Date(Date.now() + 24 * 3600000),
      requestedBy: OFFICERS.officer.phone,
      reason: 'NIR moisture bay redundancy during high intake volume',
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
    },
    {
      type: 'borrow',
      fromCentre: 'KPG-01',
      toCentre: 'SRD-02',
      resource: 'labourer',
      count: 3,
      dates: [dTomorrow],
      status: 'allowed',
      deadline: new Date(Date.now() + 12 * 3600000),
      requestedBy: OFFICERS.officer.phone,
      decidedBy: '9800000006',
      reason: 'Labour capacity balancing for market day surge',
      auditEntries: [
        { action: 'created', actorId: OFFICERS.officer.phone, actorRole: 'resource_officer', note: 'Created labour reallocation request', at: new Date(Date.now() - 3600000) },
        { action: 'allowed', actorId: '9800000006', actorRole: 'resource_officer', note: 'Approved standard labour gang reallocation', at: new Date() }
      ],
      seedBatch: SEED_BATCH
    }
  ]);

  // 14. Seed Redirect & Broadcast
  console.log('1️⃣4️⃣ Seeding Mandi Redirect Offers & Trilingual Broadcasts...');
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

  // 15. Seed Audit Logs for Checkpoints and Overrides
  console.log('1️⃣5️⃣ Seeding Auditable Trail Logs for Checkpoint Signatures & Override Actions...');
  const auditEntries = [];

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

  auditEntries.push(
    { actorId: OFFICERS.supervisor.phone, actorRole: 'supervisor', action: 'OVERRIDE_EXCEPTION_APPROVED', targetId: 'KQ-KPG-2026-1012', reason: 'Solar drying yard protocol authorized by Mandi Supervisor', timestamp: new Date(Date.now() - 10 * 86400000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.supervisor.phone, actorRole: 'supervisor', action: 'OVERRIDE_EXCEPTION_APPROVED', targetId: 'KQ-KPG-2026-1013', reason: 'Verified 7/12 extract and Talathi ownership certificate', timestamp: new Date(Date.now() - 3 * 86400000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.officer.phone, actorRole: 'resource_officer', action: 'PLAN_REQUEST_SUBMITTED', targetId: 'KPG-01', timestamp: new Date(Date.now() - 12 * 3600000), seedBatch: SEED_BATCH },
    { actorId: OFFICERS.admin.phone, actorRole: 'district_admin', action: 'PLAN_REQUEST_ESCALATED', targetId: 'KPG-01', timestamp: new Date(Date.now() - 2 * 3600000), seedBatch: SEED_BATCH }
  );

  await AuditLog.insertMany(auditEntries);

  // 16. Write Documentation
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
