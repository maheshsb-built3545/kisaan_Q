const centreService = require('../services/centreService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const centreController = {
  getAllCentres: async (req, res) => {
    try {
      const centres = await centreService.getAllCentres(req.query);
      return successResponse(res, centres, 'Centres retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getCentreById: async (req, res) => {
    try {
      const centre = await centreService.getCentreById(req.params.id);
      return successResponse(res, centre, 'Centre details retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  },

  getAvailability: async (req, res) => {
    try {
      const availability = await centreService.getCentreAvailability(req.params.id, req.query);
      return successResponse(res, availability, 'Arrival window availability retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  createCentre: async (req, res) => {
    try {
      const centre = await centreService.createCentre(req.body);
      return successResponse(res, centre, 'Centre created successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
};

module.exports = centreController;
