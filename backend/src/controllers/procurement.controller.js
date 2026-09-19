const procurementService = require('../services/procurementService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const procurementController = {
  recordInspection: async (req, res) => {
    try {
      const result = await procurementService.recordInspection(req.body, req.io);
      return successResponse(res, result, 'Inspection recorded successfully', 200);
    } catch (error) {
      const statusCode = error.message && error.message.includes('not found') ? 404 : 400;
      return errorResponse(res, error.message, statusCode);
    }
  },
  recordWeight: async (req, res) => {
    try {
      const result = await procurementService.recordWeight(req.body, req.io);
      return successResponse(res, result, 'Weight recorded successfully', 200);
    } catch (error) {
      const statusCode = error.message && error.message.includes('not found') ? 404 : 400;
      return errorResponse(res, error.message, statusCode);
    }
  },
  updatePaymentStatus: async (req, res) => {
    try {
      const result = await procurementService.updatePaymentStatus(req.body, req.io);
      return successResponse(res, result, 'Payment status updated successfully', 200);
    } catch (error) {
      const statusCode = error.message && error.message.includes('not found') ? 404 : 400;
      return errorResponse(res, error.message, statusCode);
    }
  }
};

module.exports = procurementController;

