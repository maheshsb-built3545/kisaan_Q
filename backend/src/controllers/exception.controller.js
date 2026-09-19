const exceptionService = require('../services/exceptionService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const exceptionController = {
  /**
   * POST /api/exceptions - Raise an exception on a booking
   */
  raiseException: async (req, res) => {
    try {
      const { bookingId, type, reasonCode } = req.body;
      const exception = await exceptionService.raiseException({
        bookingId,
        type,
        reasonCode,
        raisedBy: req.user.id,
        actorRole: req.user.role
      });
      return successResponse(res, exception, 'Exception raised successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/exceptions/:id/override - Supervisor override
   */
  supervisorOverride: async (req, res) => {
    try {
      const { id } = req.params;
      const { overrideReason, outcome } = req.body;
      const exception = await exceptionService.supervisorOverride(id, {
        overrideReason,
        outcome,
        actorId: req.user.id
      });
      return successResponse(res, exception, 'Supervisor override applied successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * GET /api/exceptions/:id - Fetch exception details
   */
  getExceptionById: async (req, res) => {
    try {
      const exception = await exceptionService.getExceptionById(req.params.id);
      return successResponse(res, exception, 'Exception details retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  },

  /**
   * GET /api/exceptions/booking/:bookingId - Get all exceptions for a booking
   */
  getExceptionsByBooking: async (req, res) => {
    try {
      const exceptions = await exceptionService.getExceptionsByBooking(req.params.bookingId);
      return successResponse(res, exceptions, 'Booking exceptions retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * GET /api/exceptions - List all exceptions with optional ?status= filter
   * status values: 'pending_review' (supervisorOverride=false) | 'resolved' (supervisorOverride=true)
   */
  getAllExceptions: async (req, res) => {
    try {
      const exceptions = await exceptionService.getAllExceptions(req.query);
      return successResponse(res, exceptions, 'Exceptions retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = exceptionController;
