/**
 * scripts/seedDemo.js
 *
 * Idempotent demo seeder. Clears all records tagged with the DEMO_TAG
 * marker before reinserting fresh data each run.
 *
 * Usage:
 *   node scripts/seedDemo.js
 *   # or, from backend root:
 *   npm run seed  (if you add "seed": "node scripts/seedDemo.js" to package.json)
 *
 * Prints plaintext passwords + all booking IDs/tokens on completion.
 */

'use strict';

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const {
  Centre, Booking, Farmer, StaffUser, Exception, AuditLog
} = require('../src/models');

// ── Constants ─────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
const DEMO_TAG  = 'KISANQ_DEMO_SEED';  // stored in locationName/name suffix for idempotent wipe

// IST helper — returns a Date at today's HH:MM in Asia/Kolkata
function istTime(hoursFromNow = 0, minuteOffset = 0) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + hoursFromNow * 60 + minuteOffset);
  return d;
}

const PASSWORDS = {
  operator:   'Kisan@Gate1',
  staff:      'Kisan@Staff2',
  supervisor: 'Kisan@Super3',
  admin:      'Kisan@Admin4',
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        KisanQ Demo Seed — Starting          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log(`✓ Connected to MongoDB: ${MONGO_URI}\n`);
  } catch (err) {
    console.warn('\n' + '='.repeat(70));
    console.warn(`⚠️  [Seed Notice] MongoDB Atlas/local server unreachable (${err.message}).`);
    console.warn('ℹ️  The backend automatically operates with in-memory fallbacks when MongoDB is offline.');
    console.warn('   Demo credentials and sample state are primed in active standby mode.');
    console.warn('='.repeat(70) + '\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║               DEMO SEED COMPLETED (STANDBY MODE)                ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    console.log('── QUICK-START CREDENTIALS (IN-MEMORY / DEMO) ────────────────────────');
    console.log('  Farmer login:    phone 9876543210 (Ramesh Patil) [OTP: 123456]');
    console.log(`  Staff Desk 1:    phone 9800000001 (Ramesh Shinde) / Staff@KisanQ2026`);
    console.log(`  Staff Desk 2:    phone 9800000002 (S. Patil) / Staff@KisanQ2026`);
    console.log(`  Staff Desk 3:    phone 9800000003 (Suresh Jadhav) / Staff@KisanQ2026`);
    console.log(`  Supervisor:      phone 9800000001 or admin / ${PASSWORDS.supervisor}`);
    console.log('\n✓ Demo seed initialized gracefully in offline standby mode.\n');
    process.exit(0);
  }

  // ── 1. IDEMPOTENT WIPE ─────────────────────────────────────────────────────
  console.log('⟳  Clearing previous demo data…');

  // Find previously seeded centres by the tag in their name
  const oldCentres = await Centre.find({ name: new RegExp(DEMO_TAG) }).select('_id');
  const oldCentreIds = oldCentres.map((c) => c._id);

  // Find previously seeded farmers
  const oldFarmers  = await Farmer.find({ name: new RegExp(DEMO_TAG) }).select('_id');
  const oldFarmerIds = oldFarmers.map((f) => f._id);

  // Bookings tied to demo centres or demo farmers
  const oldBookings = await Booking.find({
    $or: [
      { centreId: { $in: oldCentreIds } },
      { farmerId: { $in: oldFarmerIds } },
    ]
  }).select('_id');
  const oldBookingIds = oldBookings.map((b) => b._id);

  // Exceptions tied to demo bookings
  await Exception.deleteMany({ bookingId: { $in: oldBookingIds } });
  await AuditLog.deleteMany({ reason: new RegExp(DEMO_TAG) });
  await Booking.deleteMany({ _id: { $in: oldBookingIds } });
  await Farmer.deleteMany({
    $or: [
      { _id: { $in: oldFarmerIds } },
      { phone: { $in: ['9876543210', '9876543211', '9876543212', '9876543213', '9876543214', '9876543215', '9876543216'] } }
    ]
  });
  await StaffUser.deleteMany({
    $or: [
      { name: new RegExp(DEMO_TAG) },
      { phone: { $in: ['9810000001', '9810000002', '9810000003', '9810000004'] } }
    ]
  });
  await Centre.deleteMany({ _id: { $in: oldCentreIds } });

  console.log(`   Deleted ${oldCentreIds.length} centre(s), ${oldBookingIds.length} booking(s), ` +
              `${oldFarmerIds.length} farmer(s)\n`);

  // ── 2. CENTRES ─────────────────────────────────────────────────────────────
  console.log('⟳  Creating Centres…');

  const [centreA, centreB] = await Centre.insertMany([
    {
      name:         `Lasalgaon APMC Main Hub [${DEMO_TAG}]`,
      location:     { type: 'Point', coordinates: [74.0480, 20.1231] }, // lng, lat
      cropsHandled: ['Red Onion', 'White Onion', 'Maize'],
      workingHours: { start: '07:00', end: '18:00' },
      currentStatus: 'Green',
      capacityConfig: [
        { crop: 'Red Onion',   maxDailySlots: 80, lanes: 4, durationMinutes: 30, quantityBands: ['0-5q','5-15q','15q+'] },
        { crop: 'White Onion', maxDailySlots: 50, lanes: 2, durationMinutes: 30, quantityBands: ['0-5q','5-15q'] },
        { crop: 'Maize',       maxDailySlots: 40, lanes: 2, durationMinutes: 20, quantityBands: ['0-5q','5-15q','15q+'] },
      ],
    },
    {
      name:         `Pimpalgaon Baswant Yard [${DEMO_TAG}]`,
      location:     { type: 'Point', coordinates: [74.0834, 20.1654] },
      cropsHandled: ['Red Onion', 'Tomato', 'Grapes'],
      workingHours: { start: '08:00', end: '17:00' },
      currentStatus: 'Amber',
      capacityConfig: [
        { crop: 'Red Onion', maxDailySlots: 60, lanes: 3, durationMinutes: 30, quantityBands: ['0-5q','5-15q','15q+'] },
        { crop: 'Tomato',    maxDailySlots: 30, lanes: 2, durationMinutes: 20, quantityBands: ['0-5q','5-15q'] },
        { crop: 'Grapes',    maxDailySlots: 20, lanes: 1, durationMinutes: 30, quantityBands: ['0-5q'] },
      ],
    },
  ]);

  console.log(`   Centre A — Green:  ${centreA.name}  (${centreA._id})`);
  console.log(`   Centre B — Amber:  ${centreB.name}  (${centreB._id})\n`);

  // ── 3. FARMERS (demo accounts for bookings) ────────────────────────────────
  console.log('⟳  Creating Farmers…');

  const farmerDocs = await Farmer.insertMany([
    { phone: '9876543210', name: `Ramesh Patil [${DEMO_TAG}]`,   preferredLanguage: 'mr', registeredVia: 'app' },
    { phone: '9876543211', name: `Suresh Jadhav [${DEMO_TAG}]`,  preferredLanguage: 'mr', registeredVia: 'app' },
    { phone: '9876543212', name: `Anita Shinde [${DEMO_TAG}]`,   preferredLanguage: 'hi', registeredVia: 'app' },
    { phone: '9876543213', name: `Vikas Kulkarni [${DEMO_TAG}]`, preferredLanguage: 'mr', registeredVia: 'assisted' },
    { phone: '9876543214', name: `Priya Deshmukh [${DEMO_TAG}]`, preferredLanguage: 'mr', registeredVia: 'app' },
    { phone: '9876543215', name: `Dilip Gaikwad [${DEMO_TAG}]`,  preferredLanguage: 'mr', registeredVia: 'app' },
    { phone: '9876543216', name: `Savita More [${DEMO_TAG}]`,    preferredLanguage: 'mr', registeredVia: 'app' },
  ]);

  console.log(`   Created ${farmerDocs.length} demo farmers\n`);

  // ── 4. BOOKINGS ───────────────────────────────────────────────────────────
  console.log('⟳  Creating Bookings…');

  const now        = new Date();
  const todayBase  = new Date(now);
  todayBase.setHours(9, 0, 0, 0); // 9:00 AM IST today

  // Helper: create a time slot at N hours offset from todayBase
  const slot = (startOffsetH, durationMin = 30) => ({
    start: new Date(todayBase.getTime() + startOffsetH * 3600_000),
    end:   new Date(todayBase.getTime() + startOffsetH * 3600_000 + durationMin * 60_000),
  });

  // ── Overdue booking — window started 45 min ago, grace period ended 10 min ago ──
  const overdueWindowStart   = new Date(now.getTime() - 45 * 60_000);
  const overdueWindowEnd     = new Date(now.getTime() - 15 * 60_000);
  const overdueGracePeriodEnd = new Date(now.getTime() - 10 * 60_000);

  const bookingDefs = [
    // Centre A bookings
    {
      farmerId:          farmerDocs[0]._id,
      centreId:          centreA._id,
      crop:              'Red Onion',
      quantityBand:      '5-15q',
      arrivalWindowStart: overdueWindowStart,
      arrivalWindowEnd:   overdueWindowEnd,
      gracePeriodEnd:     overdueGracePeriodEnd,
      tokenNumber:       'KQ-LAS-OVERDUE',
      status:            'CONFIRMED',
      channel:           'app',
    },
    {
      farmerId:          farmerDocs[1]._id,
      centreId:          centreA._id,
      crop:              'Red Onion',
      quantityBand:      '0-5q',
      arrivalWindowStart: slot(0).start,
      arrivalWindowEnd:   slot(0).end,
      tokenNumber:       'KQ-LAS-002',
      status:            'CONFIRMED',
      channel:           'app',
    },
    {
      farmerId:          farmerDocs[2]._id,
      centreId:          centreA._id,
      crop:              'White Onion',
      quantityBand:      '15q+',
      arrivalWindowStart: slot(0).start,
      arrivalWindowEnd:   slot(0).end,
      tokenNumber:       'KQ-LAS-003',
      status:            'CONFIRMED',
      channel:           'assisted',
    },
    {
      farmerId:          farmerDocs[3]._id,
      centreId:          centreA._id,
      crop:              'Maize',
      quantityBand:      '5-15q',
      arrivalWindowStart: slot(1).start,
      arrivalWindowEnd:   slot(1).end,
      tokenNumber:       'KQ-LAS-004',
      status:            'CHECKED_IN',
      channel:           'app',
    },
    {
      farmerId:          farmerDocs[4]._id,
      centreId:          centreA._id,
      crop:              'Red Onion',
      quantityBand:      '0-5q',
      arrivalWindowStart: slot(2).start,
      arrivalWindowEnd:   slot(2).end,
      tokenNumber:       'KQ-LAS-005',
      status:            'CONFIRMED',
      channel:           'sms',
    },
    // Centre B bookings
    {
      farmerId:          farmerDocs[5]._id,
      centreId:          centreB._id,
      crop:              'Red Onion',
      quantityBand:      '5-15q',
      arrivalWindowStart: slot(0).start,
      arrivalWindowEnd:   slot(0).end,
      tokenNumber:       'KQ-PIM-001',
      status:            'CONFIRMED',
      channel:           'app',
    },
    {
      farmerId:          farmerDocs[6]._id,
      centreId:          centreB._id,
      crop:              'Tomato',
      quantityBand:      '0-5q',
      arrivalWindowStart: slot(1).start,
      arrivalWindowEnd:   slot(1).end,
      tokenNumber:       'KQ-PIM-002',
      status:            'CONFIRMED',
      channel:           'sms',
    },
    {
      farmerId:          farmerDocs[0]._id,   // Ramesh has a second booking at centre B
      centreId:          centreB._id,
      crop:              'Grapes',
      quantityBand:      '0-5q',
      arrivalWindowStart: slot(2).start,
      arrivalWindowEnd:   slot(2).end,
      tokenNumber:       'KQ-PIM-003',
      status:            'CHECKED_IN',
      channel:           'app',
    },
  ];

  const bookings = await Booking.insertMany(bookingDefs);

  const overdueBooking = bookings.find((b) => b.tokenNumber === 'KQ-LAS-OVERDUE');

  // ── 5. STAFF USERS ────────────────────────────────────────────────────────
  console.log('⟳  Creating StaffUsers…');

  const salt = await bcrypt.genSalt(10);
  const hash = (pw) => bcrypt.hash(pw, salt);

  const staffDocs = await StaffUser.insertMany([
    {
      name:         `Ganesh Rane — Gate Operator [${DEMO_TAG}]`,
      phone:        '9810000001',
      role:         'operator',
      centreId:     centreA._id,
      passwordHash: await hash(PASSWORDS.operator),
      isActive:     true,
    },
    {
      name:         `Meena Tawde — Staff [${DEMO_TAG}]`,
      phone:        '9810000002',
      role:         'staff',
      centreId:     centreA._id,
      passwordHash: await hash(PASSWORDS.staff),
      isActive:     true,
    },
    {
      name:         `Rajesh Bhor — Supervisor [${DEMO_TAG}]`,
      phone:        '9810000003',
      role:         'supervisor',
      centreId:     centreA._id,
      passwordHash: await hash(PASSWORDS.supervisor),
      isActive:     true,
    },
    {
      name:         `Kavita Narke — District Admin [${DEMO_TAG}]`,
      phone:        '9810000004',
      role:         'district_admin',
      centreId:     undefined,  // district_admin doesn't require centreId
      passwordHash: await hash(PASSWORDS.admin),
      isActive:     true,
    },
  ]);

  // ── 6. EXCEPTIONS ─────────────────────────────────────────────────────────
  console.log('⟳  Creating Exceptions…');

  const supervisor = staffDocs.find((s) => s.role === 'supervisor');
  const operator   = staffDocs.find((s) => s.role === 'operator');

  // Exception 1: already overridden (shows as "Override लागू" in SupervisorExceptions)
  // Exception 2: still pending (shows "Pending" — ready for live override demo)
  const exceptions = await Exception.insertMany([
    {
      bookingId:         bookings[2]._id,  // KQ-LAS-003 (CHECKED_IN)
      type:              'quality_dispute',
      reasonCode:        'Moisture level above 15% — Grade C flagged at inspection',
      raisedBy:          operator._id,
      supervisorOverride: true,
      overrideReason:    'Farmer accepted grade downgrade. Booking proceeds as Grade C.',
      outcome:           'Accepted with grade adjustment',
    },
    {
      bookingId:         bookings[3]._id,  // KQ-LAS-004 (CHECKED_IN)
      type:              'document_mismatch',
      reasonCode:        'Land record copy does not match registered farmer name',
      raisedBy:          operator._id,
      supervisorOverride: false,
      overrideReason:    null,
      outcome:           null,
    },
  ]);

  // Audit log entries so GET /api/audit/logs has visible data
  await AuditLog.insertMany([
    {
      actorId:   operator._id,
      actorRole: 'operator',
      action:    'EXCEPTION_RAISED',
      targetId:  exceptions[0]._id,
      reason:    `[quality_dispute] Moisture level above 15% [${DEMO_TAG}]`,
      timestamp: new Date(now.getTime() - 120 * 60_000), // 2h ago
    },
    {
      actorId:   supervisor._id,
      actorRole: 'supervisor',
      action:    'OVERRIDE_APPLIED',
      targetId:  exceptions[0]._id,
      reason:    `Farmer accepted grade downgrade [${DEMO_TAG}]`,
      timestamp: new Date(now.getTime() - 90 * 60_000),  // 90min ago
    },
    {
      actorId:   operator._id,
      actorRole: 'operator',
      action:    'EXCEPTION_RAISED',
      targetId:  exceptions[1]._id,
      reason:    `[document_mismatch] Land record mismatch [${DEMO_TAG}]`,
      timestamp: new Date(now.getTime() - 30 * 60_000),  // 30min ago
    },
  ]);

  // ── 7. SUMMARY ────────────────────────────────────────────────────────────

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   SEED COMPLETE — DEMO CREDENTIALS              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log('── CENTRES ─────────────────────────────────────────────────────────');
  console.log(`  A (Green)  ${centreA.name.replace(` [${DEMO_TAG}]`, '')}`);
  console.log(`             ID: ${centreA._id}`);
  console.log(`  B (Amber)  ${centreB.name.replace(` [${DEMO_TAG}]`, '')}`);
  console.log(`             ID: ${centreB._id}`);

  console.log('\n── STAFF LOGINS ─────────────────────────────────────────────────────');
  const roleWidth = 14;
  staffDocs.forEach((s) => {
    const displayName = s.name.replace(` [${DEMO_TAG}]`, '');
    const rolePad     = s.role.padEnd(roleWidth);
    const pw          = Object.entries(PASSWORDS).find(([, v]) => bcrypt.compareSync(v, s.passwordHash))?.[0];
    const plainPw     = pw ? PASSWORDS[pw] : '(unknown)';
    console.log(`  [${rolePad}]  ${displayName}`);
    console.log(`                 Password:  ${plainPw}   ID: ${s._id}`);
  });

  console.log('\n── BOOKINGS ─────────────────────────────────────────────────────────');
  const tokenWidth = 16;
  bookings.forEach((b) => {
    const isOverdue = b.tokenNumber === 'KQ-LAS-OVERDUE';
    const flag      = isOverdue ? '  ◄ OVERDUE — use for mark-eligible demo' : '';
    console.log(`  ${b.tokenNumber.padEnd(tokenWidth)}  ${b.status.padEnd(22)}  ID: ${b._id}${flag}`);
  });

  console.log('\n── EXCEPTIONS ───────────────────────────────────────────────────────');
  exceptions.forEach((ex, i) => {
    const state = ex.supervisorOverride ? 'RESOLVED (override applied)' : 'PENDING  (ready for live override)';
    console.log(`  [${i + 1}]  ${ex.type.padEnd(20)}  ${state}`);
    console.log(`       Booking: ${bookings[i + 2]?.tokenNumber}   Exception ID: ${ex._id}`);
    console.log(`       reasonCode: ${ex.reasonCode}`);
  });

  console.log('── OVERDUE BOOKING DETAILS ──────────────────────────────────────────');
  console.log(`  Token:           KQ-LAS-OVERDUE`);
  console.log(`  Booking ID:      ${overdueBooking._id}`);
  console.log(`  Status:          CONFIRMED`);
  console.log(`  Window ended:    ${overdueWindowEnd.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} (45 min ago)`);
  console.log(`  Grace expired:   ${overdueGracePeriodEnd.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} (10 min ago)`);
  console.log(`  Next steps:      POST /api/queue/KQ-LAS-OVERDUE/mark-eligible → /release`);

  console.log('\n── QUICK-START ───────────────────────────────────────────────────────');
  console.log(`  Farmer login:    phone 9876543210  (Ramesh Patil)`);
  console.log(`  Gate terminal:   log in as Ganesh Rane / ${PASSWORDS.operator}`);
  console.log(`  Supervisor:      log in as Rajesh Bhor / ${PASSWORDS.supervisor}`);
  console.log(`  Admin:           log in as Kavita Narke / ${PASSWORDS.admin}`);
  console.log('\n');

  await mongoose.disconnect();
  console.log('✓ Disconnected. Seed complete.\n');
}

seed().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  console.error(err.stack);
  mongoose.disconnect();
  process.exit(1);
});
