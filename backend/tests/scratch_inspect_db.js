'use strict';
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const {
  Farmer, Centre, Booking, QueueState, ProcurementRecord, StaffUser,
  AuditLog, Notification, Exception, Token, CropPrice, Waitlist,
  SlotOffer, Complaint, FastTrackRound, FastTrackBid, Resource,
  Availability, CentreEvent, SlotCap, ForecastSnapshot, PlanRequest,
  RedirectOffer, InboundQuota, Broadcast
} = require('../../backend/src/models');

const SEED_BATCH = 'showcase-1';
const SHOWCASE_PHONES = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);

async function inspect() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  console.log('Database connected:', mongoose.connection.name);

  const collections = [
    { name: 'Farmers', model: Farmer, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { phone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, phone: { $nin: SHOWCASE_PHONES } } },
    { name: 'Bookings', model: Booking, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Tokens', model: Token, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }, { phone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES }, phone: { $nin: SHOWCASE_PHONES } } },
    { name: 'Waitlist', model: Waitlist, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } } },
    { name: 'SlotOffers', model: SlotOffer, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } } },
    { name: 'FastTrackRounds', model: FastTrackRound, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'FastTrackBids', model: FastTrackBid, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } } },
    { name: 'Complaints', model: Complaint, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerPhone: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerPhone: { $nin: SHOWCASE_PHONES } } },
    { name: 'Exceptions', model: Exception, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Notifications', model: Notification, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { recipientId: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, recipientId: { $nin: SHOWCASE_PHONES } } },
    { name: 'ProcurementRecords', model: ProcurementRecord, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'AuditLogs', model: AuditLog, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'CropPrices', model: CropPrice, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Resources', model: Resource, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Availability', model: Availability, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'CentreEvents', model: CentreEvent, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'SlotCaps', model: SlotCap, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'ForecastSnapshots', model: ForecastSnapshot, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'PlanRequests', model: PlanRequest, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'RedirectOffers', model: RedirectOffer, qShowcase: { $or: [{ seedBatch: SEED_BATCH }, { farmerId: { $in: SHOWCASE_PHONES } }] }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH }, farmerId: { $nin: SHOWCASE_PHONES } } },
    { name: 'InboundQuotas', model: InboundQuota, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Broadcasts', model: Broadcast, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'Centres', model: Centre, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } },
    { name: 'StaffUsers', model: StaffUser, qShowcase: { seedBatch: SEED_BATCH }, qNonShowcase: { seedBatch: { $ne: SEED_BATCH } } }
  ];

  console.log('Collection counts report:');
  for (const c of collections) {
    const total = await c.model.countDocuments({});
    const showcase = await c.model.countDocuments(c.qShowcase);
    const nonShowcase = await c.model.countDocuments(c.qNonShowcase);
    console.log(`- ${c.name.padEnd(20)}: Total=${total} | Showcase=${showcase} | Non-Showcase=${nonShowcase}`);
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
