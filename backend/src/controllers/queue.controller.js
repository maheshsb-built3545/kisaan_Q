const queueService = require('../services/queueService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const queueController = {
  /**
   * GET /api/queue/live/:centreId - Get live queue state for a centre
   */
  getLiveQueue: async (req, res) => {
    try {
      const { centreId } = req.params;
      const { date } = req.query;
      const queue = await queueService.getLiveQueue(centreId, date);
      return successResponse(res, queue, 'Live queue state retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * POST /api/queue/:bookingId/check-in - Staff marks farmer as arrived
   */
  checkIn: async (req, res) => {
    try {
      const { bookingId } = req.params;
      const booking = await queueService.checkIn(
        bookingId,
        { actorId: req.user.id, actorRole: req.user.role },
        req.io
      );
      return successResponse(res, booking, 'Farmer checked in successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/queue/:bookingId/release - Staff-confirmed vacancy release
   */
  releaseSlot: async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;
      const booking = await queueService.releaseSlot(
        bookingId,
        { actorId: req.user.id, actorRole: req.user.role, reason },
        req.io
      );
      return successResponse(res, booking, 'Slot released successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/queue/:bookingId/mark-eligible - Mark booking as ELIGIBLE_FOR_RELEASE
   */
  markEligibleForRelease: async (req, res) => {
    try {
      const { bookingId } = req.params;
      const booking = await queueService.markEligibleForRelease(bookingId, req.io);
      return successResponse(res, booking, 'Booking marked as eligible for release');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * GET /api/queue/:centreId/position/:bookingId - HTTP fallback for position recovery
   */
  getPosition: async (req, res) => {
    try {
      const { centreId, bookingId } = req.params;
      const { date } = req.query;
      const position = await queueService.getBookingPosition(centreId, bookingId, date);
      return successResponse(res, position, 'Queue position retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  }
};

module.exports = queueController;
