const express = require('express');
const router = express.Router();
const slotReallocationService = require('../services/slotReallocationService');
const Waitlist = require('../models/Waitlist');
const SlotOffer = require('../models/SlotOffer');
const { authenticateToken, optionalAuthenticate, scopeToCentre } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   POST /api/waitlist/join
 * @desc    Farmer joins waitlist for full/desired arrival slot
 * @access  Public / Farmer
 */
router.post('/join', optionalAuthenticate, async (req, res) => {
  try {
    const {
      farmerName,
      farmerPhone,
      phone,
      centreId,
      mandiId,
      mandiName,
      crop,
      quantity,
      requestedSlotDate,
      requestedSlotTime,
      priority
    } = req.body;

    const isFarmer = req.user?.role === 'farmer';
    const suppliedPhone = farmerPhone || phone;

    if (isFarmer && suppliedPhone && suppliedPhone !== req.user.phone) {
      return errorResponse(res, 'Access denied: Authenticated farmer cannot join waitlist under a different phone number.', 403);
    }

    const effectivePhone = isFarmer ? req.user.phone : (suppliedPhone || req.user?.phone);
    const effectiveName = isFarmer ? (req.user?.name || farmerName || 'Farmer') : (farmerName || req.user?.name || 'Farmer');
    const effectiveFarmerId = isFarmer ? (req.user.id || req.user._id) : (req.user?.id || null);

    if (!effectivePhone) {
      return errorResponse(res, 'Farmer phone number is required to join waitlist', 400);
    }
    if (!crop || !quantity) {
      return errorResponse(res, 'Crop and quantity are required', 400);
    }

    const waitlistEntry = await slotReallocationService.joinWaitlist({
      farmerId: effectiveFarmerId,
      farmerName: effectiveName,
      farmerPhone: effectivePhone,
      centreId: centreId || mandiId || 'KPG-01',
      mandiId: mandiId || centreId || 'KPG-01',
      mandiName,
      crop,
      quantity,
      requestedSlotDate,
      requestedSlotTime,
      priority
    });

    return successResponse(res, waitlistEntry, 'Joined waitlist successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   GET /api/waitlist/my
 * @desc    Fetch active waitlist entries and pending offers for authenticated farmer
 * @access  Farmer (Authenticated via JWT only)
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const phone = req.user?.phone;
    if (!phone) {
      return errorResponse(res, 'Authentication required: Valid farmer session token required.', 401);
    }

    const waitlistEntries = await Waitlist.find({ farmerPhone: phone }).sort({ createdAt: -1 });
    const pendingOffers = await SlotOffer.find({
      farmerPhone: phone,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    return successResponse(res, { waitlist: waitlistEntries, offers: pendingOffers }, 'Retrieved waitlist data', 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   GET /api/waitlist/centre/:centreId
 * @desc    Fetch waitlist entries for a specific centre (Staff scoped)
 * @access  Staff / Supervisor / Admin
 */
router.get('/centre/:centreId', authenticateToken, scopeToCentre, async (req, res) => {
  try {
    const centreId = req.scopedCentreId || req.params.centreId;
    const query = {
      centreId,
      status: { $in: ['WAITING', 'OFFERED'] }
    };
    if (req.user?.demo) {
      query.seedBatch = 'showcase-1';
    }
    const waitlist = await Waitlist.find(query).sort({ priority: -1, joinedAt: 1 });

    return successResponse(res, { waitlist, count: waitlist.length }, `Waitlist retrieved for centre ${centreId}`, 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   GET /api/waitlist/offers
 * @desc    List offers (scoped to authenticated officer centre, district_admin reads all)
 * @access  Staff / Supervisor / District Admin
 */
router.get('/offers', authenticateToken, scopeToCentre, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'district_admin' && req.user.role !== 'admin') {
      filter.centreId = req.scopedCentreId;
    } else if (req.query.centreId && req.query.centreId !== 'ALL') {
      filter.centreId = req.query.centreId;
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.user?.demo) filter.seedBatch = 'showcase-1';

    const offers = await SlotOffer.find(filter).sort({ createdAt: -1 });
    return successResponse(res, { offers }, 'Offers retrieved', 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   POST /api/waitlist/offers/:id/accept
 * @desc    Atomic acceptance of slot offer (Identity from JWT only)
 * @access  Farmer (Authenticated via JWT only)
 */
router.post('/offers/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.user?.phone;
    if (!phone) {
      return errorResponse(res, 'Authentication required: Valid farmer session token required.', 401);
    }

    const result = await slotReallocationService.acceptSlotOffer(id, phone, req.body);
    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result, result.message, 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   POST /api/waitlist/offers/:id/decline
 * @desc    Decline slot offer and trigger next reallocation (Identity from JWT only)
 * @access  Farmer (Authenticated via JWT only)
 */
router.post('/offers/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.user?.phone;
    if (!phone) {
      return errorResponse(res, 'Authentication required: Valid farmer session token required.', 401);
    }

    const result = await slotReallocationService.declineSlotOffer(id, phone, req.body);
    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(res, result, result.message, 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * @route   POST /api/waitlist/process-reallocations
 * @desc    Trigger slot release & waitlist reallocation check on-demand
 */
router.post('/process-reallocations', async (req, res) => {
  try {
    const results = await slotReallocationService.processSlotReallocationCycle(req.body || {});
    return successResponse(res, results, 'Slot reallocation cycle completed', 200);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
