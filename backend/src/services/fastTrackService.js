const mongoose = require('mongoose');
const FastTrackRequest = require('../models/FastTrackRequest');
const Token = require('../models/Token');
const AuditLog = require('../models/AuditLog');
const auditService = require('./auditService');
const cropPriceService = require('./cropPriceService');
const { TOKEN_STATUS, normalizeStatus } = require('../utils/statusEnums');
const logger = require('../utils/logger');

// In-memory store fallback for offline testing / execution
const inMemoryFastTrackStore = new Map();

/**
 * Valid pre-Desk-1 waiting statuses where fast-track is permitted
 * Matches standard TOKEN_STATUS.BOOKED and raw status variants before Gate Check-in
 */
const PRE_DESK_1_STATUSES = new Set([
  'Booked', 'BOOKED', 'Confirmed', 'CONFIRMED'
]);

const fastTrackService = {
  /**
   * Helper: Calculate available flat-rate discount tiers (₹10, ₹20, ₹40/Qtl) that satisfy the statutory MSP floor
   */
  calculateTierAvailability: (marketPriceToday, mspPrice) => {
    const tiers = [10, 20, 40];
    const tierDetails = tiers.map((discountPerQtl) => {
      const discountedPrice = marketPriceToday - discountPerQtl;
      const isValid = discountedPrice >= mspPrice;
      return {
        tier: discountPerQtl,
        discountPerQuintal: discountPerQtl,
        discountAmount: discountPerQtl,
        discountedPrice,
        marketPrice: marketPriceToday,
        mspPrice,
        isValid,
        label: `₹${discountPerQtl}/Qtl Off`
      };
    });

    const validTiers = tierDetails.filter((t) => t.isValid).map((t) => t.tier);
    return {
      marketPriceToday,
      mspPrice,
      tierDetails,
      validTiers,
      hasValidTiers: validTiers.length > 0
    };
  },

  /**
   * Submit a new Fast-Track Priority Request
   */
  createRequest: async ({ tokenNumber, tier, farmerPhone, user = null, io = null }) => {
    const cleanTokenNumber = (tokenNumber || '').trim().toUpperCase();
    const selectedTier = Number(tier);

    if (![10, 20, 40, 2, 5].includes(selectedTier)) {
      const err = new Error('Invalid tier. Fast-track discount tier must be flat rate ₹10, ₹20, or ₹40/Qtl.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Find Token in DB or Memory
    let token = null;
    if (mongoose.connection.readyState === 1) {
      try {
        token = await Token.findOne({
          $or: [
            { tokenNumber: cleanTokenNumber },
            { id: cleanTokenNumber }
          ]
        });
      } catch (err) {
        logger.warn(`[FastTrack] DB query notice: ${err.message}`);
      }
    }

    // Fallback: check in-memory store in token routes if not in DB
    if (!token) {
      const tokenRoutes = require('../routes/token.routes');
      if (tokenRoutes.inMemoryGetActiveTokens) {
        const activeTokens = tokenRoutes.inMemoryGetActiveTokens();
        token = activeTokens.find(
          (t) => (t.tokenNumber || t.id) === cleanTokenNumber || t.id === cleanTokenNumber
        );
      }
    }

    if (!token) {
      const err = new Error(`Token '${cleanTokenNumber}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Ownership Confirmation
    const rawTokenPhone = (token.phone || '').toString().replace(/\D/g, '');
    const requestingPhone = (farmerPhone || user?.phone || '').toString().replace(/\D/g, '');

    if (requestingPhone && rawTokenPhone && requestingPhone !== rawTokenPhone) {
      const err = new Error('Unauthorized: This token does not belong to the authenticated farmer.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Pre-Desk-1 Waiting State Check
    const normalizedTokenStatus = normalizeStatus(token.status);
    const desk1Pending = !token.stages || !token.stages[0] || (token.stages[0].status || '').toLowerCase() !== 'completed';
    const isPreDesk1 =
      (token.currentStageIndex === undefined || token.currentStageIndex === 0) &&
      (PRE_DESK_1_STATUSES.has(token.status) || normalizedTokenStatus === TOKEN_STATUS.BOOKED) &&
      desk1Pending;

    if (!isPreDesk1) {
      const err = new Error(
        'Token is already checked in or processing at operational desks. Fast-track priority is only available prior to physical gate check-in.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 4. Check for existing PENDING request for this token
    let existingPending = null;
    if (mongoose.connection.readyState === 1) {
      existingPending = await FastTrackRequest.findOne({
        tokenNumber: cleanTokenNumber,
        status: 'PENDING'
      });
    } else {
      existingPending = Array.from(inMemoryFastTrackStore.values()).find(
        (r) => r.tokenNumber === cleanTokenNumber && r.status === 'PENDING'
      );
    }

    if (existingPending) {
      const err = new Error('A pending fast-track request already exists for this token.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Fetch Today's CropPrice (NO hardcoded fallback)
    const mandiId = token.mandiId || 'KPG-01';
    const crop = token.crop;
    const prices = await cropPriceService.getPricesByMandi(mandiId);
    const cropPriceRecord = prices.find((p) => p.crop.toLowerCase() === (crop || '').toLowerCase());

    if (!cropPriceRecord || cropPriceRecord.marketPriceToday === undefined || cropPriceRecord.mspPrice === undefined) {
      const err = new Error(
        `Official price bulletin not found for crop '${crop}' at Mandi '${mandiId}'. Fast-track pricing cannot be calculated without verified market rates.`
      );
      err.statusCode = 404;
      err.code = 'CROP_PRICE_NOT_FOUND';
      throw err;
    }

    const marketPriceToday = cropPriceRecord.marketPriceToday;
    const mspPrice = cropPriceRecord.mspPrice;

    // 6. HARD STATUTORY FLOOR CHECK (MarketRate - FlatDiscount >= MSPFloor)
    const flatDiscount = [10, 20, 40].includes(selectedTier)
      ? selectedTier
      : Math.round(marketPriceToday * (selectedTier / 100)); // backwards compatibility

    const discountedPrice = marketPriceToday - flatDiscount;
    const tierCheck = fastTrackService.calculateTierAvailability(marketPriceToday, mspPrice);

    if (discountedPrice < mspPrice) {
      const validOptions = tierCheck.validTiers.length > 0
        ? tierCheck.validTiers.map((t) => `₹${t}/Qtl`).join(', ')
        : 'None (market rate is within statutory MSP margin)';

      const err = new Error(
        `Statutory floor violation: ₹${flatDiscount}/Qtl discount yields ₹${discountedPrice}/Qtl, which is below the statutory MSP floor of ₹${mspPrice}/Qtl. Available valid tiers for ${crop} today: ${validOptions}.`
      );
      err.statusCode = 400;
      err.code = 'FLOOR_PRICE_VIOLATION';
      err.validTiers = tierCheck.validTiers;
      err.tierDetails = tierCheck.tierDetails;
      throw err;
    }

    // 7. Atomic Concurrent Capacity Allocation with Slot Collision Retry (Max 5 concurrent PENDING per mandi)
    const MAX_SLOT_RETRIES = 3;
    let savedRequest = null;
    let assignedSlot = null;

    for (let attempt = 1; attempt <= MAX_SLOT_RETRIES; attempt++) {
      let occupiedSlots = [];
      if (mongoose.connection.readyState === 1) {
        const pendingDocs = await FastTrackRequest.find(
          { mandiId, status: 'PENDING' },
          { slotNumber: 1 }
        ).lean();
        occupiedSlots = pendingDocs.map((d) => d.slotNumber).filter(Boolean);
      } else {
        occupiedSlots = Array.from(inMemoryFastTrackStore.values())
          .filter((r) => r.mandiId === mandiId && r.status === 'PENDING')
          .map((r) => r.slotNumber)
          .filter(Boolean);
      }

      const availableSlot = [1, 2, 3, 4, 5].find((s) => !occupiedSlots.includes(s));
      if (!availableSlot || occupiedSlots.length >= 5) {
        const err = new Error(
          `Fast-track pool is currently full for Mandi ${mandiId} (max 5 concurrent priority slots). Please try again shortly once pending requests are processed.`
        );
        err.statusCode = 429;
        err.code = 'CAPACITY_LIMIT_EXCEEDED';
        throw err;
      }

      assignedSlot = availableSlot;
      const requestData = {
        tokenNumber: cleanTokenNumber,
        farmerPhone: requestingPhone || rawTokenPhone,
        mandiId,
        crop,
        tier: selectedTier,
        slotNumber: assignedSlot,
        marketPriceAtRequest: marketPriceToday,
        mspPriceAtRequest: mspPrice,
        discountedPrice,
        status: 'PENDING',
        requestedAt: new Date()
      };

      if (mongoose.connection.readyState === 1) {
        try {
          savedRequest = await FastTrackRequest.create(requestData);
          break; // Successfully inserted without collision
        } catch (err) {
          if (err.code === 11000) {
            logger.warn(
              `[FastTrack] Slot ${assignedSlot} collision (duplicate key 11000) on attempt ${attempt}/${MAX_SLOT_RETRIES}. Re-evaluating available slots...`
            );
            if (attempt === MAX_SLOT_RETRIES) {
              const capErr = new Error(
                `Fast-track pool is currently full for Mandi ${mandiId} (max 5 concurrent priority slots). Please try again shortly once pending requests are processed.`
              );
              capErr.statusCode = 429;
              capErr.code = 'CAPACITY_LIMIT_EXCEEDED';
              throw capErr;
            }
            await new Promise((res) => setTimeout(res, 25 * attempt));
            continue;
          }
          logger.warn(`[FastTrack] DB create notice: ${err.message}`);
          break;
        }
      } else {
        const reqId = new mongoose.Types.ObjectId().toString();
        savedRequest = {
          _id: reqId,
          id: reqId,
          ...requestData
        };
        break;
      }
    }

    if (!savedRequest) {
      const reqId = new mongoose.Types.ObjectId().toString();
      savedRequest = {
        _id: reqId,
        id: reqId,
        tokenNumber: cleanTokenNumber,
        farmerPhone: requestingPhone || rawTokenPhone,
        mandiId,
        crop,
        tier: selectedTier,
        slotNumber: assignedSlot || 1,
        marketPriceAtRequest: marketPriceToday,
        mspPriceAtRequest: mspPrice,
        discountedPrice,
        status: 'PENDING',
        requestedAt: new Date()
      };
    }

    inMemoryFastTrackStore.set(savedRequest._id ? savedRequest._id.toString() : savedRequest.id, savedRequest);
    logger.info(`[FastTrack] Created request for ${cleanTokenNumber} (Tier ₹${selectedTier}/Qtl, Slot ${assignedSlot}, Rate ₹${discountedPrice}/Qtl)`);

    // Emit Socket.IO event to Mandi room immediately upon creation if io is provided
    if (io) {
      try {
        const { broadcastFastTrackRequested } = require('../socket/queue.socket');
        broadcastFastTrackRequested(io, mandiId, savedRequest);
      } catch (err) {
        logger.warn(`[FastTrack] Socket broadcast warning: ${err.message}`);
      }
    }

    return {
      request: savedRequest,
      tierCheck
    };
  },

  /**
   * Get all pending Fast-Track requests for a Mandi ranked by fairness
   * Fairness algorithm:
   * 1. Higher discount tier has higher priority (Tier 10 > Tier 5 > Tier 2)
   * 2. Within same tier, earlier submission time has priority (FIFO)
   */
  getPendingRequests: async ({ mandiId = null, status = 'PENDING' }) => {
    const cleanMandiId = mandiId ? mandiId.trim() : null;

    if (mongoose.connection.readyState === 1) {
      const filter = { status: status || 'PENDING' };
      if (cleanMandiId) {
        filter.$or = [
          { mandiId: cleanMandiId },
          { mandiId: cleanMandiId.split('-')[0] }
        ];
      }

      return await FastTrackRequest.find(filter)
        .sort({ tier: -1, requestedAt: 1 })
        .lean();
    }

    // In-memory fallback
    const list = Array.from(inMemoryFastTrackStore.values()).filter((r) => {
      let match = r.status === (status || 'PENDING');
      if (cleanMandiId && r.mandiId !== cleanMandiId) match = false;
      return match;
    });

    list.sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier; // Tier DESC
      return new Date(a.requestedAt || 0) - new Date(b.requestedAt || 0); // requestedAt ASC
    });

    return list;
  },

  /**
   * Approve a Fast-Track Priority Request
   * Hard-requires an authenticated supervisor-role user.
   * Repositions the full queue and records an AuditLog that MUST succeed.
   */
  approveRequest: async ({ requestId, officerUser }) => {
    if (!officerUser || !officerUser.role || !['supervisor', 'district_admin', 'operator', 'admin'].includes(officerUser.role)) {
      const err = new Error('Forbidden: An authenticated officer with supervisor privileges is required.');
      err.statusCode = 403;
      throw err;
    }

    let request = null;
    if (mongoose.connection.readyState === 1) {
      try {
        request = await FastTrackRequest.findById(requestId);
      } catch (err) {
        logger.warn(`[FastTrack] DB find notice: ${err.message}`);
      }
    }

    if (!request) {
      request = inMemoryFastTrackStore.get(requestId);
    }

    if (!request) {
      const err = new Error(`FastTrackRequest '${requestId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (request.status !== 'PENDING') {
      const err = new Error(`FastTrackRequest is already '${request.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const officerIdentity = officerUser.name || officerUser.officerCode || officerUser.phone || 'Supervisor';
    const officerId = officerUser.id || officerUser.staffId || officerUser._id || 'SUPERVISOR';

    request.status = 'APPROVED';
    request.reviewedBy = officerIdentity;
    request.reviewedAt = new Date();

    if (request.save && typeof request.save === 'function') {
      await request.save();
    }
    inMemoryFastTrackStore.set(requestId, request);

    // 1. Update Token: mark as fast-track
    let token = null;
    if (mongoose.connection.readyState === 1) {
      try {
        token = await Token.findOne({
          $or: [
            { tokenNumber: request.tokenNumber },
            { id: request.tokenNumber }
          ]
        });
        if (token) {
          token.isFastTrack = true;
          token.fastTrackTier = request.tier;
          token.fastTrackDiscountedPrice = request.discountedPrice;
          await token.save();
        }
      } catch (err) {
        logger.warn(`[FastTrack] Token update notice: ${err.message}`);
      }
    }

    // 2. Reposition the full queue using token.routes.js repositionMandiQueue
    const tokenRoutes = require('../routes/token.routes');
    if (tokenRoutes.repositionMandiQueue) {
      await tokenRoutes.repositionMandiQueue(request.mandiId);
    }

    if (tokenRoutes.inMemoryGetActiveTokens) {
      const activeTokens = tokenRoutes.inMemoryGetActiveTokens(request.mandiId);
      const memToken = activeTokens.find(
        (t) => (t.tokenNumber || t.id) === request.tokenNumber || t.id === request.tokenNumber
      );
      if (memToken) {
        memToken.isFastTrack = true;
        memToken.fastTrackTier = request.tier;
        memToken.fastTrackDiscountedPrice = request.discountedPrice;
        if (!token) token = memToken;
      }
    }

    // 3. Log to AuditLog (MUST NOT fail silently; failure causes the action to be rejected)
    await auditService.recordLog({
      actorId: officerId,
      actorRole: officerUser.role,
      action: 'FAST_TRACK_APPROVED',
      targetId: request.tokenNumber,
      reason: `Approved Fast-Track Priority: Discounted ₹${request.discountedPrice}/Qtl (Flat -₹${request.tier}/Qtl) vs Market ₹${request.marketPriceAtRequest}/Qtl (MSP: ₹${request.mspPriceAtRequest}/Qtl)`
    });

    logger.info(`[FastTrack] APPROVED request ${requestId} for token ${request.tokenNumber} by ${officerIdentity}`);

    return {
      request,
      token,
      queuePosition: 1
    };
  },

  /**
   * Reject a Fast-Track Priority Request
   * Hard-requires an authenticated supervisor-role user.
   * Leaves the token's original queue position untouched and records an AuditLog.
   */
  rejectRequest: async ({ requestId, officerUser }) => {
    if (!officerUser || !officerUser.role || !['supervisor', 'district_admin', 'operator', 'admin'].includes(officerUser.role)) {
      const err = new Error('Forbidden: An authenticated officer with supervisor privileges is required.');
      err.statusCode = 403;
      throw err;
    }

    let request = null;
    if (mongoose.connection.readyState === 1) {
      try {
        request = await FastTrackRequest.findById(requestId);
      } catch (err) {
        logger.warn(`[FastTrack] DB find notice: ${err.message}`);
      }
    }

    if (!request) {
      request = inMemoryFastTrackStore.get(requestId);
    }

    if (!request) {
      const err = new Error(`FastTrackRequest '${requestId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (request.status !== 'PENDING') {
      const err = new Error(`FastTrackRequest is already '${request.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const officerIdentity = officerUser.name || officerUser.officerCode || officerUser.phone || 'Supervisor';
    const officerId = officerUser.id || officerUser.staffId || officerUser._id || 'SUPERVISOR';

    request.status = 'REJECTED';
    request.reviewedBy = officerIdentity;
    request.reviewedAt = new Date();

    if (request.save && typeof request.save === 'function') {
      await request.save();
    }
    inMemoryFastTrackStore.set(requestId, request);

    // Token position is left strictly untouched per requirements

    // Log to AuditLog (MUST NOT fail silently)
    await auditService.recordLog({
      actorId: officerId,
      actorRole: officerUser.role,
      action: 'FAST_TRACK_REJECTED',
      targetId: request.tokenNumber,
      reason: `Rejected Fast-Track Priority for ${request.tokenNumber}. Standard queue position preserved.`
    });

    logger.info(`[FastTrack] REJECTED request ${requestId} for token ${request.tokenNumber} by ${officerIdentity}`);

    return {
      request
    };
  },

  /**
   * Get Fast-Track status and available tiers for a token
   */
  getTokenStatus: async (tokenNumber) => {
    const cleanTokenNumber = (tokenNumber || '').trim().toUpperCase();

    let request = null;
    if (mongoose.connection.readyState === 1) {
      try {
        request = await FastTrackRequest.findOne({ tokenNumber: cleanTokenNumber })
          .sort({ requestedAt: -1 })
          .lean();
      } catch (err) {
        logger.warn(`[FastTrack] DB query notice: ${err.message}`);
      }
    }

    if (!request) {
      const requests = Array.from(inMemoryFastTrackStore.values()).filter(
        (r) => r.tokenNumber === cleanTokenNumber
      );
      if (requests.length > 0) {
        requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        request = requests[0];
      }
    }

    return request;
  },

  /**
   * Reset in-memory store for clean test suites
   */
  inMemoryReset: () => {
    inMemoryFastTrackStore.clear();
  }
};

module.exports = fastTrackService;
