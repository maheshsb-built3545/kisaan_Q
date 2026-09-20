'use strict';

/**
 * seedPlanningDemo.js — Demo data for B7 (Planning) and B9 (Redirect & Broadcast)
 * All data labelled "demo data". Run after seedDemoFlow.js.
 *
 * Usage: node scripts/seedPlanningDemo.js
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const {
  Resource, Availability, CentreEvent, SlotCap, ForecastSnapshot,
  PlanRequest, InboundQuota, RedirectOffer, Broadcast
} = require('../src/models');

const DEMO = 'DEMO_';

// ─── Demo centre config ─────────────────────────────────────────────────────
const CENTRES = ['KPG-01', 'SRD-02', 'RHT-03', 'VJP-04', 'SRP-05', 'LSG-06'];
const PRIMARY = 'KPG-01';
const SECONDARY = 'SRD-02';

// ─── Fixed officer IDs (from seedStaffRegistry) ─────────────────────────────
const OFFICER_KPG = 'resource_officer_KPG01'; // demo id
const OFFICER_SRD = 'resource_officer_SRD02';

// ─── Dates ──────────────────────────────────────────────────────────────────
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().slice(0, 10);
const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
const dayAfterStr = dayAfter.toISOString().slice(0, 10);

async function seedPlanningDemo() {
  // ── Connect ──────────────────────────────────────────────────────────────
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('🟢 Connected to MongoDB');
  }

  // ── 1. Resources (demo data) ──────────────────────────────────────────────
  console.log('[B7] Seeding demo resource inventory...');
  const RESOURCE_DEFAULTS = {
    'KPG-01': [
      { type: 'labourer', count: 30, unitCapacity: 40, label: 'demo data' },
      { type: 'weighbridge', count: 2, unitCapacity: 120, label: 'demo data' },
      { type: 'assaying_bay', count: 3, unitCapacity: 60, label: 'demo data' },
      { type: 'gate_lane', count: 2, unitCapacity: 200, label: 'demo data' },
      { type: 'truck_bay', count: 4, unitCapacity: 8, label: 'demo data' }
    ],
    'SRD-02': [
      { type: 'labourer', count: 20, unitCapacity: 40, label: 'demo data' },
      { type: 'weighbridge', count: 1, unitCapacity: 100, label: 'demo data' },
      { type: 'assaying_bay', count: 2, unitCapacity: 50, label: 'demo data' }
    ],
    'RHT-03': [
      { type: 'labourer', count: 25, unitCapacity: 40, label: 'demo data' },
      { type: 'weighbridge', count: 2, unitCapacity: 120, label: 'demo data' }
    ]
  };

  for (const [centreId, resources] of Object.entries(RESOURCE_DEFAULTS)) {
    for (const res of resources) {
      await Resource.findOneAndUpdate(
        { centreId, type: res.type },
        { ...res, centreId, updatedBy: 'DEMO_SEED' },
        { upsert: true, new: true }
      );
    }
  }

  // ── 2. Availability overrides (demo data — simulates maintenance days) ────
  console.log('[B7] Seeding demo availability overrides...');
  await Availability.findOneAndUpdate(
    { centreId: PRIMARY, date: dayAfterStr, resourceType: 'weighbridge' },
    { centreId: PRIMARY, date: dayAfterStr, resourceType: 'weighbridge', available: 1, note: 'Demo: WB-1 under maintenance', updatedBy: 'DEMO_SEED' },
    { upsert: true }
  );
  await Availability.findOneAndUpdate(
    { centreId: PRIMARY, date: dayAfterStr, resourceType: 'labourer' },
    { centreId: PRIMARY, date: dayAfterStr, resourceType: 'labourer', available: 20, note: 'Demo: Labour day shift reduced', updatedBy: 'DEMO_SEED' },
    { upsert: true }
  );

  // ── 3. Centre events (demo data) ──────────────────────────────────────────
  console.log('[B7] Seeding demo centre events...');
  const eventExisting = await CentreEvent.findOne({ centreId: PRIMARY, date: dayAfterStr, kind: 'maintenance' });
  if (!eventExisting) {
    await CentreEvent.create({
      centreId: PRIMARY, date: dayAfterStr, kind: 'maintenance',
      note: 'Demo: Weighbridge WB-1 scheduled maintenance (09:00–11:00)',
      createdBy: 'DEMO_SEED'
    });
  }

  // ── 4. Slot caps (demo data) ──────────────────────────────────────────────
  console.log('[B7] Seeding demo slot caps...');
  await SlotCap.findOneAndUpdate(
    { centreId: PRIMARY, date: tomorrowStr, hour: 8 },
    { centreId: PRIMARY, date: tomorrowStr, hour: 8, cap: 25, confirmedAtSet: 0, warnCapBelowConfirmed: false, setBy: 'DEMO_SEED' },
    { upsert: true }
  );
  await SlotCap.findOneAndUpdate(
    { centreId: PRIMARY, date: tomorrowStr, hour: 9 },
    { centreId: PRIMARY, date: tomorrowStr, hour: 9, cap: 30, confirmedAtSet: 0, warnCapBelowConfirmed: false, setBy: 'DEMO_SEED' },
    { upsert: true }
  );

  // ── 5. Forecast snapshots (demo data — rule-based label) ─────────────────
  console.log('[B7] Seeding demo forecast snapshots...');
  for (const centreId of CENTRES) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().slice(0, 10);

      // Demo forecast values (rule-based)
      const confirmed = Math.floor(Math.random() * 40) + 20;
      const projected = Math.round(confirmed / 0.7);
      const mid = Math.round(projected * 0.85);

      await ForecastSnapshot.findOneAndUpdate(
        { centreId, date },
        {
          centreId, date, confirmedBookings: confirmed, leadDays: i,
          projectedBookings: projected,
          expectedArrivalsMin: Math.round(projected * 0.75),
          expectedArrivalsMid: mid,
          expectedArrivalsMax: Math.round(projected * 0.95),
          totalQuintalsMin: mid * 7, totalQuintalsMax: mid * 15,
          labourNeeded: Math.ceil((mid * 10) / 40),
          bottleneck: i === 0 ? 'labour' : 'none',
          heatStatus: i < 2 ? 'Amber' : 'Green',
          dataQualityBadge: 'assumed',
          insufficientData: false,
          note: 'demo data — rule-based forecast',
          generatedAt: new Date()
        },
        { upsert: true }
      );
    }
  }

  // ── 6. Plan requests (demo data) ─────────────────────────────────────────
  console.log('[B7] Seeding demo plan requests...');
  const existingReq = await PlanRequest.findOne({ fromCentre: PRIMARY, type: 'own', status: 'pending' });
  if (!existingReq) {
    const deadline = new Date(Date.now() + 24 * 3600 * 1000);
    await PlanRequest.create({
      type: 'own', fromCentre: PRIMARY, toCentre: PRIMARY,
      resource: 'labourer', count: 5, dates: [tomorrowStr, dayAfterStr],
      status: 'pending', deadline, requestedBy: OFFICER_KPG,
      auditEntries: [{ action: 'created', actorId: OFFICER_KPG, actorRole: 'resource_officer', at: new Date() }]
    });
  }

  const existingBorrowReq = await PlanRequest.findOne({ fromCentre: PRIMARY, type: 'borrow', toCentre: SECONDARY });
  if (!existingBorrowReq) {
    const deadline = new Date(Date.now() + 48 * 3600 * 1000);
    await PlanRequest.create({
      type: 'borrow', fromCentre: PRIMARY, toCentre: SECONDARY,
      resource: 'weighbridge', count: 1, dates: [dayAfterStr],
      status: 'pending', deadline, requestedBy: OFFICER_KPG,
      auditEntries: [{ action: 'created', actorId: OFFICER_KPG, actorRole: 'resource_officer', at: new Date() }]
    });
  }

  // ── 7. Inbound quota (demo data — B9) ────────────────────────────────────
  console.log('[B9] Seeding demo inbound quota...');
  await InboundQuota.findOneAndUpdate(
    { centreId: SECONDARY, date: tomorrowStr, hour: 10 },
    { centreId: SECONDARY, date: tomorrowStr, hour: 10, count: 10, used: 0, setBy: 'DEMO_SEED' },
    { upsert: true }
  );

  // ── 8. Broadcast (demo data — B9) ────────────────────────────────────────
  console.log('[B9] Seeding demo broadcast...');
  const broadcastExists = await Broadcast.findOne({ centreId: PRIMARY, 'text.en': { $regex: /demo/i } });
  if (!broadcastExists) {
    await Broadcast.create({
      centreId: PRIMARY,
      text: {
        en: '[DEMO] Market operations will start at 8:00 AM tomorrow. All farmers please arrive 15 minutes early.',
        hi: '[डेमो] कल सुबह 8:00 बजे से बाजार शुरू होगा। सभी किसान 15 मिनट पहले आएं।',
        mr: '[डेमो] उद्या सकाळी 8:00 वाजता बाजार सुरू होईल. सर्व शेतकऱ्यांनी 15 मिनिटे आधी यावे.'
      },
      sentBy: OFFICER_KPG,
      sentAt: new Date(),
      recipientCount: 0 // No live notifications for seed
    });
  }

  console.log(`
✅ B7/B9 DEMO DATA SEEDED SUCCESSFULLY (demo data, rule-based forecasts)

Demo data includes (labelled "demo data"):
  - Resource inventory: KPG-01 (5 types), SRD-02 (3), RHT-03 (2)
  - Availability overrides: WB maintenance on ${dayAfterStr}
  - Centre events: maintenance event on ${dayAfterStr}
  - Slot caps: 25 @ 08h, 30 @ 09h on ${tomorrowStr}
  - Forecast snapshots: 7-day rule-based for ${CENTRES.length} centres
  - Plan requests: 1 own-plan (pending), 1 borrow KPG→SRD (pending)
  - Inbound quota: SRD-02 @ 10h on ${tomorrowStr} (cap=10)
  - Broadcast: demo announcement at KPG-01

Dashboard URLs (after frontend build):
  - Resource Planning: /officer/planning/dashboard
  - Day-Load Picker: farmer sees colour on /booking date picker
  - Offers: /farmer/redirects

💡 Cleanup: node scripts/seedPlanningDemo.js --clean
`);
}

async function cleanPlanningDemo() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('🟢 Connected to MongoDB');
  }
  await Resource.deleteMany({ updatedBy: 'DEMO_SEED' });
  await Availability.deleteMany({ updatedBy: 'DEMO_SEED' });
  await CentreEvent.deleteMany({ createdBy: 'DEMO_SEED' });
  await SlotCap.deleteMany({ setBy: 'DEMO_SEED' });
  await ForecastSnapshot.deleteMany({ note: { $regex: /demo data/ } });
  await PlanRequest.deleteMany({ requestedBy: OFFICER_KPG });
  await InboundQuota.deleteMany({ setBy: 'DEMO_SEED' });
  await Broadcast.deleteMany({ sentBy: OFFICER_KPG, 'text.en': { $regex: /\[DEMO\]/ } });
  console.log('✅ B7/B9 demo data cleaned.');
}

if (require.main === module) {
  const clean = process.argv.includes('--clean');
  (clean ? cleanPlanningDemo() : seedPlanningDemo()).then(() => {
    mongoose.disconnect();
    process.exit(0);
  }).catch(err => {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  });
}

module.exports = { seedPlanningDemo, cleanPlanningDemo };
