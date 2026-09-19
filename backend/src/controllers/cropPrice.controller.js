const cropPriceService = require('../services/cropPriceService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const cropPriceController = {
  /**
   * Get prices for a specific mandi
   * GET /api/centres/:mandiId/prices
   */
  getPricesByMandi: async (req, res) => {
    try {
      const mandiId = req.params.mandiId || req.params.id;
      const { date } = req.query;
      const prices = await cropPriceService.getPricesByMandi(mandiId, date);
      return successResponse(res, prices, `Prices retrieved for Mandi ${mandiId}`);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get cross-mandi prices for a specific crop
   * GET /api/prices/:crop
   */
  getPricesByCrop: async (req, res) => {
    try {
      const { crop } = req.params;
      const { date } = req.query;
      const prices = await cropPriceService.getPricesByCrop(crop, date);
      return successResponse(res, prices, `Cross-mandi prices for ${crop}`);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get all current crop prices
   * GET /api/prices
   */
  getAllPrices: async (req, res) => {
    try {
      const prices = await cropPriceService.getAllPrices(req.query);
      return successResponse(res, prices, 'Crop prices retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = cropPriceController;
