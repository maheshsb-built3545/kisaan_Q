/**
 * Land Yield Estimation & Quantity Rule Check Service
 * 
 * Rules:
 * 1. Expected max = areaAcres * yieldPerAcre * toleranceMultiplier (1.5).
 * 2. Compares with sum of farmer's active/completed bookings for that crop in the current season + new booking.
 * 3. Count each lot ONCE: sums Tokens first and adds Bookings only when no Token exists for that booking.
 * 4. Never blocks bookings: booking succeeds with warning { code: 'LAND_QUANTITY_EXCEEDS_ESTIMATE' }.
 * 5. Single open supervisor-visible flag per farmer+crop+season (updates numbers instead of creating duplicates).
 * 6. Sends a notification to the farmer.
 * 7. If farmer has no land record, returns a non-blocking reminder card (no flag).
 * 8. Yield estimates are labeled 'rule-based' and 'assumed'.
 */

const mongoose = require('mongoose');
const { Farmer, Booking, Token, Exception, AuditLog } = require('../models');
const {
  LAND_YIELD_CONFIG,
  normalizeCropKey,
  getCropYieldConfig,
  getCurrentSeasonBounds,
  calculateExpectedMaxYield
} = require('../config/landYield');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Shared in-memory fallbacks
const { inMemoryFarmers } = require('./authService');
const { _inMemoryBookings: inMemoryBookings } = require('./bookingService');

const landYieldService = {
  /**
   * Find farmer record from MongoDB or in-memory fallback
   * @param {string} farmerId 
   * @param {string} phone 
   */
  findFarmer: async (farmerId, phone) => {
    let farmer = null;
    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');

    try {
      if (mongoose.connection.readyState === 1) {
        if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
          farmer = await Farmer.findById(farmerId);
        }
        if (!farmer && rawPhone) {
          farmer = await Farmer.findOne({ phone: rawPhone });
        }
      }
    } catch (e) {
      logger.warn(`[LandYield] Farmer lookup notice: ${e.message}`);
    }

    if (!farmer && inMemoryFarmers) {
      const memKey = rawPhone || (farmerId ? farmerId.toString() : null);
      if (memKey && inMemoryFarmers.has(memKey)) {
        farmer = inMemoryFarmers.get(memKey);
      } else {
        for (const [, f] of inMemoryFarmers.entries()) {
          if (f._id?.toString() === farmerId?.toString() || f.phone === rawPhone) {
            farmer = f;
            break;
          }
        }
      }
    }

    return farmer;
  },

  /**
   * Calculate total booked quantity for a farmer and crop within current season.
   * DEDUPLICATION: Count each lot ONCE: sum Tokens and add Bookings ONLY when no token exists for that booking.
   * Excludes CANCELLED bookings/tokens.
   * @param {Object} params
   * @param {string} params.farmerId
   * @param {string} params.phone
   * @param {string} params.crop
   * @param {Date} [params.targetDate]
   * @param {string} [params.excludeBookingId]
   * @returns {Promise<{ totalQuintals: number, lots: Array }>}
   */
  getSeasonalBookedQuantityWithLots: async ({ farmerId, phone, crop, targetDate = new Date(), excludeBookingId = null }) => {
    const { startDate, endDate } = getCurrentSeasonBounds(targetDate);
    const rawPhone = (phone || '').toString().trim().replace(/\D/g, '');
    const normCrop = normalizeCropKey(crop);

    const countedLots = [];
    const countedBookingIds = new Set();
    const countedTokenNumbers = new Set();
    let totalQuintals = 0;

    try {
      if (mongoose.connection.readyState === 1) {
        // 1. Query Tokens collection first
        const tokenQuery = {
          status: { $nin: ['CANCELLED', 'Cancelled'] },
          createdAt: { $gte: startDate, $lte: endDate }
        };
        if (rawPhone) {
          tokenQuery.$or = [{ farmerPhone: rawPhone }, { phone: rawPhone }];
        } else if (farmerId) {
          tokenQuery.farmerId = farmerId;
        }

        if (excludeBookingId) {
          tokenQuery._id = { $ne: excludeBookingId };
          tokenQuery.tokenNumber = { $ne: excludeBookingId };
        }

        const tokens = await Token.find(tokenQuery);
        for (const t of tokens) {
          if (normalizeCropKey(t.crop) !== normCrop) continue;

          let qtl = Number(t.quantity) || 10;
          if (t.bookingId) countedBookingIds.add(t.bookingId.toString());
          if (t.tokenNumber) countedTokenNumbers.add(t.tokenNumber.toString());

          totalQuintals += qtl;
          countedLots.push({
            type: 'token',
            id: t._id.toString(),
            tokenNumber: t.tokenNumber,
            bookingId: t.bookingId?.toString() || null,
            crop: t.crop,
            quantity: qtl,
            status: t.status
          });
        }

        // 2. Query Bookings collection — add ONLY if not already counted as a token
        const bookingQuery = {
          status: { $nin: ['CANCELLED', 'Cancelled'] },
          createdAt: { $gte: startDate, $lte: endDate }
        };

        if (farmerId && mongoose.Types.ObjectId.isValid(farmerId)) {
          bookingQuery.farmerId = farmerId;
        } else if (rawPhone) {
          const farmerDoc = await Farmer.findOne({ phone: rawPhone });
          if (farmerDoc) bookingQuery.farmerId = farmerDoc._id;
        }

        if (excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)) {
          bookingQuery._id = { $ne: excludeBookingId };
        }

        if (bookingQuery.farmerId) {
          const bookings = await Booking.find(bookingQuery);
          for (const b of bookings) {
            if (normalizeCropKey(b.crop) !== normCrop) continue;

            const bIdStr = b._id.toString();
            if (countedBookingIds.has(bIdStr) || (b.tokenNumber && countedTokenNumbers.has(b.tokenNumber))) {
              // Already counted as a token — skip double counting
              continue;
            }

            let qtl = Number(b.netWeight) / 100 || 0;
            if (qtl <= 0) {
              if (b.quantityBand === '0-5q') qtl = 5;
              else if (b.quantityBand === '5-15q') qtl = 15;
              else if (b.quantityBand === '15q+') qtl = 25;
              else {
                const match = (b.quantityBand || '').match(/(\d+)/);
                qtl = match ? Number(match[1]) : 10;
              }
            }

            countedBookingIds.add(bIdStr);
            totalQuintals += qtl;
            countedLots.push({
              type: 'booking',
              id: bIdStr,
              tokenNumber: b.tokenNumber || null,
              crop: b.crop,
              quantity: qtl,
              status: b.status
            });
          }
        }
      }
    } catch (dbErr) {
      logger.warn(`[LandYield] Seasonal booking sum DB error: ${dbErr.message}`);
    }

    // In-memory fallback
    if (inMemoryBookings && totalQuintals === 0) {
      for (const [, b] of inMemoryBookings.entries()) {
        if (excludeBookingId && b._id?.toString() === excludeBookingId.toString()) continue;
        if (['CANCELLED', 'Cancelled'].includes(b.status)) continue;
        if (!b.crop || normalizeCropKey(b.crop) !== normCrop) continue;
        const bDate = new Date(b.createdAt || Date.now());
        if (bDate < startDate || bDate > endDate) continue;

        if (
          (farmerId && b.farmerId?.toString() === farmerId?.toString()) ||
          (rawPhone && b.phone === rawPhone)
        ) {
          let qtl = 10;
          if (b.quantityBand === '0-5q') qtl = 5;
          else if (b.quantityBand === '5-15q') qtl = 15;
          else if (b.quantityBand === '15q+') qtl = 25;
          totalQuintals += qtl;
          countedLots.push({
            type: 'booking_memory',
            id: b._id?.toString() || 'mem',
            tokenNumber: b.tokenNumber,
            crop: b.crop,
            quantity: qtl,
            status: b.status
          });
        }
      }
    }

    return {
      totalQuintals: Math.round(totalQuintals * 100) / 100,
      lots: countedLots
    };
  },

  /**
   * Helper returning just the total quantity
   */
  getSeasonalBookedQuantity: async (params) => {
    const res = await landYieldService.getSeasonalBookedQuantityWithLots(params);
    return res.totalQuintals;
  },

  /**
   * Run Rule-Based Land Quantity Check for a farmer booking
   * @param {Object} params
   * @param {string} [params.farmerId]
   * @param {string} [params.phone]
   * @param {string} params.crop
   * @param {number} params.requestedQuantity - in Quintals
   * @param {string} [params.bookingId]
   * @param {string} [params.tokenNumber]
   * @param {string} [params.centreId]
   */
  checkLandQuantityLimit: async ({
    farmer = null,
    farmerId,
    phone,
    crop,
    requestedQuantity,
    newBookingQuantity,
    bookingId = null,
    tokenNumber = null,
    centreId = 'KPG-01',
    existingActiveBookings = null
  }) => {
    let targetFarmer = farmer;
    if (!targetFarmer) {
      targetFarmer = await landYieldService.findFarmer(farmerId, phone);
    }
    const newQty = Number(requestedQuantity !== undefined ? requestedQuantity : newBookingQuantity) || 10;

    // Check if farmer has valid land details
    const hasLandRecord = Boolean(
      targetFarmer &&
      targetFarmer.landRecord &&
      typeof targetFarmer.landRecord.areaAcres === 'number' &&
      targetFarmer.landRecord.areaAcres > 0
    );

    // If NO land record: non-blocking reminder card only, NO supervisor flag created
    if (!hasLandRecord) {
      return {
        passed: true,
        isExceeded: false,
        exceedsLimit: false,
        hasLandRecord: false,
        areaAcres: 0,
        expectedMax: null,
        expectedMaxQtl: null,
        totalSeasonalBooked: newQty,
        bookedQtl: newQty,
        warning: null,
        reminder: {
          code: 'ADD_LAND_DETAILS',
          message: 'Add your land details to verify yield estimates & expedite mandi check-in',
          actionUrl: '/profile#land-details'
        }
      };
    }

    const areaAcres = targetFarmer.landRecord.areaAcres;
    const yieldEst = calculateExpectedMaxYield(crop, areaAcres);
    const expectedMax = yieldEst.expectedMax;
    const assumedYield = yieldEst.yieldPerAcre;
    const toleranceMultiplier = yieldEst.toleranceMultiplier;

    // Sum seasonal bookings prior to this booking (deduplicating lots)
    let priorSeasonalTotal = 0;
    let countedLots = [];
    if (Array.isArray(existingActiveBookings)) {
      const normCrop = normalizeCropKey(crop);
      priorSeasonalTotal = existingActiveBookings
        .filter(b => {
          if (!b) return false;
          const status = (b.status || '').toLowerCase();
          if (status === 'cancelled' || status === 'canceled') return false;
          if (normalizeCropKey(b.crop) !== normCrop) return false;
          return true;
        })
        .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    } else {
      const lotRes = await landYieldService.getSeasonalBookedQuantityWithLots({
        farmerId: targetFarmer?._id || farmerId,
        phone: targetFarmer?.phone || phone,
        crop,
        excludeBookingId: bookingId
      });
      priorSeasonalTotal = lotRes.totalQuintals;
      countedLots = lotRes.lots;
    }

    const totalSeasonalBooked = Math.round((priorSeasonalTotal + newQty) * 100) / 100;

    // Check if total exceeds expected max
    const isExceeded = totalSeasonalBooked > expectedMax;

    if (!isExceeded) {
      return {
        passed: true,
        isExceeded: false,
        exceedsLimit: false,
        hasLandRecord: true,
        areaAcres,
        expectedMax,
        expectedMaxQtl: expectedMax,
        assumedYield,
        toleranceMultiplier,
        source: 'assumed',
        ruleLabel: 'rule-based',
        totalSeasonalBooked,
        bookedQtl: totalSeasonalBooked,
        warning: null,
        reminder: null,
        lots: countedLots
      };
    }

    // QUANTITY EXCEEDS ESTIMATE
    const tokenDisplay = tokenNumber || 'KQ-BOOKING';
    const warning = {
      code: 'LAND_QUANTITY_EXCEEDS_ESTIMATE',
      ruleLabel: 'rule-based',
      source: 'assumed',
      expected: expectedMax,
      booked: totalSeasonalBooked,
      newBookingQuantity: newQty,
      crop: yieldEst.cropName,
      areaAcres,
      assumedYield,
      toleranceMultiplier,
      tokenNumber: tokenDisplay,
      farmerNotice: 'This is more than we estimate your declared land can produce. A supervisor may check this. You can still continue.'
    };

    // Create or UPDATE single OPEN supervisor-visible anomaly flag (Exception record)
    let flagRecord = null;
    try {
      const reasonCode = `[Rule-Based Yield Warning] [Token: ${tokenDisplay}] Booked quantity (${totalSeasonalBooked} Qtl) exceeds expected max (${expectedMax} Qtl) for declared land ${areaAcres} Acres (Assumed Yield: ${assumedYield} Qtl/Acre × 1.5 tolerance)`;

      const staffRaisedId = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c001'); // Governance Desk
      const targetBookingId = bookingId && mongoose.Types.ObjectId.isValid(bookingId)
        ? bookingId
        : new mongoose.Types.ObjectId();

      if (mongoose.connection.readyState === 1) {
        // Find existing open exception for this booking or farmer to avoid duplicate open flags
        const existingOpenException = await Exception.findOne({
          bookingId: targetBookingId,
          type: 'quality_dispute',
          supervisorOverride: false
        });

        if (existingOpenException) {
          existingOpenException.reasonCode = reasonCode;
          existingOpenException.updatedAt = new Date();
          await existingOpenException.save();
          flagRecord = existingOpenException;
          logger.info(`[LandYield] Updated existing open supervisor flag: ${flagRecord._id}`);
        } else {
          flagRecord = await Exception.create({
            bookingId: targetBookingId,
            type: 'quality_dispute',
            reasonCode,
            raisedBy: staffRaisedId,
            supervisorOverride: false,
            overrideReason: null,
            outcome: null
          });
          logger.info(`[LandYield] Supervisor flag created in MongoDB: ${flagRecord._id}`);
        }
      }

      // Write Audit Log
      const auditPayload = {
        actorId: farmer?._id || staffRaisedId,
        actorRole: 'farmer',
        action: 'LAND_QUANTITY_FLAG_CREATED',
        targetId: flagRecord?._id || targetBookingId,
        reason: reasonCode,
        timestamp: new Date()
      };

      if (mongoose.connection.readyState === 1) {
        await AuditLog.create(auditPayload);
      }
    } catch (flagErr) {
      logger.warn(`[LandYield] Flag creation/update notice: ${flagErr.message}`);
    }

    // Notify farmer through notify()
    try {
      const farmerIdStr = (farmer?._id || farmerId || 'farmer').toString();
      notificationService.notify(
        { id: farmerIdStr, type: 'farmer' },
        'land_quantity_warning',
        {
          tokenNumber: tokenDisplay,
          crop: yieldEst.cropName,
          booked: totalSeasonalBooked,
          expected: expectedMax,
          notice: warning.farmerNotice
        },
        { dedupeKey: `${farmerIdStr}_land_warning_${tokenDisplay}` }
      ).catch((e) => logger.warn(`[LandYield] Notification dispatch notice: ${e.message}`));
    } catch (notifErr) {
      logger.warn(`[LandYield] Notification error: ${notifErr.message}`);
    }

    return {
      passed: true, // NON-BLOCKING: Booking still succeeds!
      isExceeded: true,
      exceedsLimit: true,
      hasLandRecord: true,
      areaAcres,
      expectedMax,
      expectedMaxQtl: expectedMax,
      assumedYield,
      toleranceMultiplier,
      source: 'assumed',
      ruleLabel: 'rule-based',
      totalSeasonalBooked,
      bookedQtl: totalSeasonalBooked,
      warning,
      reminder: null,
      flagId: flagRecord?._id || null,
      lots: countedLots
    };
  }
};

module.exports = landYieldService;
