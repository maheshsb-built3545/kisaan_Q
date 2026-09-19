const fastTrackService = require('../services/fastTrackService');
const cropPriceService = require('../services/cropPriceService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  broadcastFastTrackRequested,
  broadcastFastTrackApproved,
  broadcastFastTrackRejected
} = require('../socket/queue.socket');

const fastTrackController = {
  /**
   * Submit Fast-Track Request for a Token
   * POST /api/tokens/:tokenNumber/fasttrack-request
   */
  createRequest: async (req, res) => {
    try {
      const { tokenNumber } = req.params;
      const { tier, phone } = req.body;
      const farmerPhone = phone || req.user?.phone;

      const io = req.io || req.app?.get('io') || req.app?.io;

      const result = await fastTrackService.createRequest({
        tokenNumber,
        tier,
        farmerPhone,
        user: req.user,
        io
      });

      // Broadcast event via WebSocket to Mandi room
      if (io && result?.request) {
        broadcastFastTrackRequested(io, result.request.mandiId, result.request);
      }

      return successResponse(
        res,
        result.request,
        `Fast-Track Priority requested at ₹${result.request.tier}/Qtl discount (Final rate: ₹${result.request.discountedPrice}/Qtl). Pending staff verification.`,
        201
      );
    } catch (error) {
      const status = error.statusCode || (error.message.includes('not found') ? 404 : 400);
      return res.status(status).json({
        success: false,
        code: error.code || 'FAST_TRACK_ERROR',
        message: error.message,
        availableTiers: error.validTiers || [],
        validTiers: error.validTiers || [],
        tierDetails: error.tierDetails || []
      });
    }
  },

  /**
   * Get Available Fast-Track Tiers & Status for a Token
   * GET /api/tokens/:tokenNumber/fasttrack-status
   */
  getTokenStatus: async (req, res) => {
    try {
      const { tokenNumber } = req.params;
      const { mandiId, crop } = req.query;

      const activeRequest = await fastTrackService.getTokenStatus(tokenNumber);

      let effMandiId = mandiId || activeRequest?.mandiId || 'KPG-01';
      let effCrop = crop || activeRequest?.crop || 'Soybean';

      const prices = await cropPriceService.getPricesByMandi(effMandiId);
      const cropRecord = prices.find((p) => p.crop.toLowerCase() === effCrop.toLowerCase());
      if (!cropRecord || cropRecord.marketPriceToday === undefined || cropRecord.mspPrice === undefined) {
        return errorResponse(
          res,
          `Official price bulletin not found for crop '${effCrop}' at Mandi '${effMandiId}'.`,
          404
        );
      }
      const marketPrice = cropRecord.marketPriceToday;
      const mspPrice = cropRecord.mspPrice;

      const tierAvailability = fastTrackService.calculateTierAvailability(marketPrice, mspPrice);

      return successResponse(res, {
        hasFastTrack: Boolean(activeRequest),
        activeRequest,
        request: activeRequest,
        tierAvailability,
        mandiId: effMandiId,
        crop: effCrop
      }, 'Fast-Track status retrieved');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  },

  /**
   * Get Pending Fast-Track Requests (Staff view, ranked by fairness)
   * GET /api/staff/fasttrack-requests?mandiId=X&status=PENDING
   */
  getPendingRequests: async (req, res) => {
    try {
      const { mandiId, status } = req.query;
      const effectiveMandiId = mandiId || req.user?.assignedMandi || req.user?.mandiId || null;

      const requests = await fastTrackService.getPendingRequests({
        mandiId: effectiveMandiId,
        status: status || 'PENDING'
      });

      return successResponse(res, requests, 'Pending fast-track requests retrieved');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  },

  /**
   * Approve Fast-Track Request
   * POST /api/staff/fasttrack-requests/:id/approve
   */
  approveRequest: async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user || !req.user.role) {
        return errorResponse(res, 'Access denied. Authenticated supervisor session required.', 401);
      }
      if (!['supervisor', 'district_admin', 'operator', 'admin'].includes(req.user.role)) {
        return errorResponse(res, 'Forbidden: Only authorized supervisors can approve fast-track priority.', 403);
      }
      const officerUser = req.user;

      const result = await fastTrackService.approveRequest({
        requestId: id,
        officerUser
      });

      // Broadcast approval event via WebSocket
      const io = req.io || req.app.get('io');
      if (io) {
        broadcastFastTrackApproved(
          io,
          result.request.mandiId,
          result.request.tokenNumber,
          result.request,
          result.token
        );
      }

      return successResponse(
        res,
        result,
        `Fast-Track Request approved. Token ${result.request.tokenNumber} moved to priority Queue Position 1.`
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Reject Fast-Track Request
   * POST /api/staff/fasttrack-requests/:id/reject
   */
  rejectRequest: async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user || !req.user.role) {
        return errorResponse(res, 'Access denied. Authenticated supervisor session required.', 401);
      }
      if (!['supervisor', 'district_admin', 'operator', 'admin'].includes(req.user.role)) {
        return errorResponse(res, 'Forbidden: Only authorized supervisors can reject fast-track priority.', 403);
      }
      const officerUser = req.user;

      const result = await fastTrackService.rejectRequest({
        requestId: id,
        officerUser
      });

      // Broadcast rejection event via WebSocket
      const io = req.io || req.app.get('io');
      if (io) {
        broadcastFastTrackRejected(
          io,
          result.request.mandiId,
          result.request.tokenNumber,
          result.request
        );
      }

      return successResponse(
        res,
        result.request,
        `Fast-Track Request rejected. Token remains at original queue position.`
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }
};

module.exports = fastTrackController;
