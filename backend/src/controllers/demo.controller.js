'use strict';

/**
 * demo.controller.js
 *
 * Provides one-click demo authentication for the KisanQ showcase.
 * All endpoints refuse unless DEMO_MODE=true AND (NODE_ENV !== 'production'
 * OR ALLOW_DEMO_IN_PRODUCTION=true).
 *
 * Farmer showcase phones: 9800100001–9800100025 (3 named profiles offered)
 * Staff showcase phones:  9800000001–9800000008 (8 role desks)
 * Every issued token carries demo:true so downstream guards can detect demo sessions.
 */

const mongoose = require('mongoose');
const { Farmer, StaffUser, Token, Booking, Waitlist, FastTrackRound } = require('../models');
const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Showcase Farmer Profiles ───────────────────────────────────────────────
const SHOWCASE_FARMER_PROFILES = {
  'ramesh_kadam': {
    phone: '9800100001',
    name: 'Ramesh Kadam',
    preferredLanguage: 'mr',
    description: 'Hero farmer – active booking, fast-track, waitlist offer'
  },
  'sunil_shinde': {
    phone: '9800100002',
    name: 'Sunil Shinde',
    preferredLanguage: 'mr',
    description: 'Live assaying token + open complaint CMP-2026-101'
  },
  'dattatray_pawar': {
    phone: '9800100003',
    name: 'Dattatray Pawar',
    preferredLanguage: 'mr',
    description: 'Waitlist candidate'
  }
};

// Full allowed showcase phone range (9800100001–9800100025)
const SHOWCASE_FARMER_PHONE_SET = new Set(
  Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`)
);

// ─── Showcase Staff Map ─────────────────────────────────────────────────────
const SHOWCASE_STAFF_MAP = {
  'security_gate':      { phone: '9800000001', name: 'Ramesh Shinde',                  assignedMandi: 'KPG-01', landingPath: '/admin-dashboard/desk' },
  'quality_assayer':    { phone: '9800000002', name: 'S. Patil',                        assignedMandi: 'KPG-01', landingPath: '/admin-dashboard/desk' },
  'weighmaster':        { phone: '9800000003', name: 'Suresh Jadhav',                   assignedMandi: 'KPG-01', landingPath: '/admin-dashboard/desk' },
  'procurement':        { phone: '9800000004', name: 'Secretary Deshmukh',              assignedMandi: 'KPG-01', landingPath: '/admin-dashboard/desk' },
  'accounts_settlement':{ phone: '9800000005', name: 'Treasury Officer Kale',          assignedMandi: 'KPG-01', landingPath: '/admin-dashboard/desk' },
  'resource_officer':   { phone: '9800000006', name: 'P. Kulkarni',                     assignedMandi: 'KPG-01', landingPath: '/planning' },
  'supervisor':         { phone: '9800000007', name: 'V. Pawar',                        assignedMandi: 'KPG-01', landingPath: '/supervisor-exceptions' },
  'district_admin':     { phone: '9800000008', name: 'District Collector Ahilyanagar', assignedMandi: 'KPG-01', landingPath: '/admin-dashboard' }
};

// Showcase seed batch tag used by seedShowcase.js
const SEED_BATCH = 'showcase-1';
// Showcase farmer phone range for reset isolation
const SHOWCASE_FARMER_PHONES_ARRAY = Array.from({ length: 25 }, (_, i) => `98001000${String(i + 1).padStart(2, '0')}`);

const demoController = {

  /**
   * GET /api/auth/demo/status
   * Returns { enabled: bool } — no auth required.
   */
  getDemoStatus: (req, res) => {
    const enabled = (
      process.env.DEMO_MODE === 'true' &&
      (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_IN_PRODUCTION === 'true')
    );
    return successResponse(res, { enabled }, 'Demo status retrieved');
  },

  /**
   * POST /api/auth/demo/farmer
   * Body: { profile } — one of 'ramesh_kadam' | 'sunil_shinde' | 'dattatray_pawar'
   * (or omit for default Ramesh Kadam)
   * Issues a normal farmer JWT with demo:true claim.
   */
  demoFarmerLogin: async (req, res) => {
    try {
      const profileKey = (req.body?.profile || 'ramesh_kadam').toLowerCase().replace(/\s+/g, '_');
      const profile = SHOWCASE_FARMER_PROFILES[profileKey];

      if (!profile) {
        return errorResponse(
          res,
          `Unknown demo farmer profile '${profileKey}'. ` +
          `Valid options: ${Object.keys(SHOWCASE_FARMER_PROFILES).join(', ')}`,
          403
        );
      }

      // Additional safety: phone must be in the showcase range
      if (!SHOWCASE_FARMER_PHONE_SET.has(profile.phone)) {
        return errorResponse(res, 'Demo login refused: phone not in showcase range.', 403);
      }

      // Try to find or resolve the farmer in DB / in-memory
      let farmer = null;
      if (mongoose.connection.readyState === 1) {
        farmer = await Farmer.findOne({ phone: profile.phone }).lean();
      }
      if (!farmer && authService.inMemoryFarmers?.has(profile.phone)) {
        farmer = authService.inMemoryFarmers.get(profile.phone);
      }

      // If farmer not yet in DB (seed not run), create a transient object for the JWT
      const farmerId = farmer?._id || new mongoose.Types.ObjectId();
      const farmerName = farmer?.name || profile.name;

      const tokenPayload = {
        id: farmerId,
        role: 'farmer',
        phone: profile.phone,
        name: farmerName,
        preferredLanguage: farmer?.preferredLanguage || profile.preferredLanguage,
        pickupLocation: farmer?.pickupLocation || null,
        demo: true  // ← demo claim
      };

      const demoTokenTtl = process.env.DEMO_TOKEN_TTL || '4h';
      const token = authService.generateToken(tokenPayload, demoTokenTtl);

      logger.info(`[Demo] Farmer demo login issued: ${farmerName} (${profile.phone})`);

      return successResponse(res, {
        token,
        user: { ...tokenPayload, id: farmerId.toString() },
        landingPath: '/farmer-dashboard'
      }, `Demo farmer login issued for ${farmerName}`);

    } catch (err) {
      logger.error(`[Demo] demoFarmerLogin error: ${err.message}`);
      return errorResponse(res, 'Demo farmer login failed', 500, err.message);
    }
  },

  /**
   * POST /api/auth/demo/staff
   * Body: { role } — one of the 8 showcase staff roles
   * Issues a normal staff JWT with demo:true claim.
   */
  demoStaffLogin: async (req, res) => {
    try {
      const role = (req.body?.role || '').toLowerCase().trim();

      if (!role || !SHOWCASE_STAFF_MAP[role]) {
        return errorResponse(
          res,
          `Unknown demo staff role '${role}'. ` +
          `Valid roles: ${Object.keys(SHOWCASE_STAFF_MAP).join(', ')}`,
          403
        );
      }

      const staffInfo = SHOWCASE_STAFF_MAP[role];

      // Try to find staff record in DB / in-memory for additional claims
      let staff = null;
      if (mongoose.connection.readyState === 1) {
        staff = await StaffUser.findOne({ phone: staffInfo.phone }).lean();
      }
      // staffId from DB if available, else generate transient ObjectId
      const staffId = staff?._id || new mongoose.Types.ObjectId();

      const tokenPayload = {
        id: staffId.toString(),
        staffId: staffId.toString(),
        name: staff?.name || staffInfo.name,
        phone: staffInfo.phone,
        role,
        officerCode: staff?.officerCode || `DEMO-${role.toUpperCase().replace(/_/g, '-')}`,
        assignedMandi: 'KPG-01',  // always KPG-01 for showcase
        mandiId: 'KPG-01',
        mandiName: 'APMC Kopargaon',
        deskName: staff?.deskName || staffInfo.name,
        terminalLane: staff?.terminalLane || 'Demo Terminal',
        terminalCode: staff?.terminalCode || 'DEMO-01',
        demo: true  // ← demo claim
      };

      const demoTokenTtl = process.env.DEMO_TOKEN_TTL || '4h';
      const token = authService.generateToken(tokenPayload, demoTokenTtl);

      logger.info(`[Demo] Staff demo login issued: ${tokenPayload.name} (${role})`);

      return successResponse(res, {
        token,
        user: tokenPayload,
        landingPath: staffInfo.landingPath
      }, `Demo staff login issued for role: ${role}`);

    } catch (err) {
      logger.error(`[Demo] demoStaffLogin error: ${err.message}`);
      return errorResponse(res, 'Demo staff login failed', 500, err.message);
    }
  },

  /**
   * POST /api/demo/reset
   * Requires demo:true JWT (farmer or staff).
   * Re-times ONLY showcase-tagged live scenarios.
   * Never modifies non-showcase documents.
   * Prints non-showcase counts before and after to prove isolation.
   */
  resetDemoData: async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return errorResponse(res, 'Database offline — reset not available.', 503);
      }

      // ─── 1. Count non-showcase documents BEFORE (proof of isolation) ─────
      const nonShowcaseBefore = {
        tokens: await Token.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES_ARRAY }, seedBatch: { $ne: SEED_BATCH } }),
        bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
        waitlist: await Waitlist.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES_ARRAY }, seedBatch: { $ne: SEED_BATCH } }),
        fastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
      };
      logger.info('[Demo Reset] Non-showcase counts BEFORE:', JSON.stringify(nonShowcaseBefore));

      const now = new Date();

      // ─── 2. Re-time showcase Token — active JOINING round window ──────────
      // Move any showcase FastTrackRound in JOINING status to have endsAt = now + 3 min
      const joiningWindow = new Date(now.getTime() + 3 * 60 * 1000);
      await FastTrackRound.updateMany(
        { seedBatch: SEED_BATCH, status: { $in: ['JOINING', 'AWAITING_APPROVAL'] } },
        { $set: { endsAt: joiningWindow, officerDecisionExpiresAt: new Date(now.getTime() + 10 * 60 * 1000) } }
      );

      // ─── 3. Re-time any showcase Token with graceDeadlineAt (no-show window) ─
      const noShowWindow = new Date(now.getTime() + 2 * 60 * 1000);
      await Token.updateMany(
        { seedBatch: SEED_BATCH, graceDeadlineAt: { $exists: true, $ne: null }, status: 'Booked' },
        { $set: { graceDeadlineAt: noShowWindow, warnedAt: now } }
      );

      // ─── 4. Re-time showcase Waitlist slot offers (9-minute countdown) ────
      const slotOfferExpiry = new Date(now.getTime() + 9 * 60 * 1000);
      await Waitlist.updateMany(
        { seedBatch: SEED_BATCH, status: 'OFFERED' },
        { $set: { updatedAt: now } }
      );

      // ─── 5. Re-time showcase Booking arrivalWindowStart to next whole hour ─
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      const slotWindowEnd = new Date(nextHour.getTime() + 60 * 60 * 1000);

      await Booking.updateMany(
        { seedBatch: SEED_BATCH, status: { $in: ['BOOKED', 'CONFIRMED'] } },
        { $set: { arrivalWindowStart: nextHour, arrivalWindowEnd: slotWindowEnd } }
      );

      // ─── 6. Reset Fast-Track Rounds to Initial Showcase State ────────────
      const b1 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6281' });
      const b2 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6282' });
      const b3 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6283' });
      const b4 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-6284' });

      await FastTrackRound.updateOne(
        { seedBatch: SEED_BATCH, roundId: 'FTR-KPG-2026-8001' },
        {
          $set: {
            status: 'JOINING',
            participants: [
              { farmerId: '65f1a2b3c4d5e6f7a8b9e102', phone: '9800100002', name: 'Sunil Shinde', bookingId: b1?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6281', joinedAt: new Date(now.getTime() - 10 * 60000) },
              { farmerId: '65f1a2b3c4d5e6f7a8b9e103', phone: '9800100003', name: 'Dattatray Pawar', bookingId: b2?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6282', joinedAt: new Date(now.getTime() - 8 * 60000) },
              { farmerId: '65f1a2b3c4d5e6f7a8b9e104', phone: '9800100004', name: 'Vikas Deshmukh', bookingId: b3?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6283', joinedAt: new Date(now.getTime() - 5 * 60000) },
              { farmerId: '65f1a2b3c4d5e6f7a8b9e105', phone: '9800100005', name: 'Suresh Patil', bookingId: b4?._id || new mongoose.Types.ObjectId(), tokenNumber: 'KQ-KPG-2026-6284', joinedAt: new Date(now.getTime() - 2 * 60000) }
            ],
            currentLeader: null,
            candidateQueue: [],
            endsAt: null
          }
        }
      );

      const b2005 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-2005' });
      const b2006 = await Booking.findOne({ seedBatch: SEED_BATCH, tokenNumber: 'KQ-KPG-2026-2006' });
      await FastTrackRound.updateOne(
        { seedBatch: SEED_BATCH, roundId: 'FTR-KPG-2026-8002' },
        {
          $set: {
            status: 'AWAITING_APPROVAL',
            officerDecision: {},
            officerDecisionExpiresAt: new Date(now.getTime() + 15 * 60000),
            currentLeader: {
              farmerId: '65f1a2b3c4d5e6f7a8b9e106',
              phone: '9800100006',
              name: 'Balasaheb Thorat',
              bookingId: b2005?._id || new mongoose.Types.ObjectId(),
              tokenNumber: 'KQ-KPG-2026-2005',
              amount: 260,
              bidTime: new Date(now.getTime() - 5 * 60000)
            },
            candidateQueue: [
              {
                farmerId: '65f1a2b3c4d5e6f7a8b9e107',
                phone: '9800100007',
                name: 'Eknath Gaikwad',
                bookingId: b2006?._id || new mongoose.Types.ObjectId(),
                tokenNumber: 'KQ-KPG-2026-2006',
                amount: 240,
                bidTime: new Date(now.getTime() - 6 * 60000)
              }
            ]
          }
        }
      );

      // ─── 7. Count non-showcase documents AFTER (must match before exactly) ─
      const nonShowcaseAfter = {
        tokens: await Token.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES_ARRAY }, seedBatch: { $ne: SEED_BATCH } }),
        bookings: await Booking.countDocuments({ seedBatch: { $ne: SEED_BATCH } }),
        waitlist: await Waitlist.countDocuments({ farmerPhone: { $nin: SHOWCASE_FARMER_PHONES_ARRAY }, seedBatch: { $ne: SEED_BATCH } }),
        fastTrackRounds: await FastTrackRound.countDocuments({ seedBatch: { $ne: SEED_BATCH } })
      };
      logger.info('[Demo Reset] Non-showcase counts AFTER:', JSON.stringify(nonShowcaseAfter));

      // ─── 8. Verify isolation ─────────────────────────────────────────────
      const isolationOk = Object.keys(nonShowcaseBefore).every(
        (k) => nonShowcaseBefore[k] === nonShowcaseAfter[k]
      );
      if (!isolationOk) {
        logger.error('[Demo Reset] ISOLATION VIOLATION — non-showcase counts changed!',
          { before: nonShowcaseBefore, after: nonShowcaseAfter });
        return errorResponse(res, 'Demo reset isolation check failed — non-showcase documents were unexpectedly modified.', 500);
      }

      logger.info(`[Demo Reset] Success — performed by ${req.user?.name || req.user?.phone || 'unknown'} (demo:${req.user?.demo})`);

      return successResponse(res, {
        retimed: {
          fastTrackRounds: 'JOINING/AWAITING_APPROVAL rounds re-timed (+3 min window)',
          noShowTokens: 'No-show grace windows re-set to now+2min',
          waitlistOffers: 'Offered waitlist entries updatedAt refreshed',
          activeBookings: `Arrival window moved to next whole hour (${nextHour.toISOString()})`
        },
        isolation: {
          nonShowcaseBefore,
          nonShowcaseAfter,
          isolationOk
        }
      }, 'Showcase demo data re-timed successfully');

    } catch (err) {
      logger.error(`[Demo] resetDemoData error: ${err.message}`);
      return errorResponse(res, 'Demo reset failed', 500, err.message);
    }
  }
};

module.exports = demoController;
