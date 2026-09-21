const farmerService = require('../services/farmerService');
const landExtractService = require('../services/landExtractService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const farmerController = {
  /**
   * Update farmer's pickup location
   * PATCH /api/farmers/pickup-location
   */
  updatePickupLocation: async (req, res) => {
    try {
      const { latitude, longitude, address } = req.body;
      const isFarmer = req.user?.role === 'farmer';
      
      if (isFarmer && req.body?.phone && req.body.phone !== req.user.phone) {
        return errorResponse(res, 'Access denied: Cannot update location for a different phone number.', 403);
      }

      const farmerId = isFarmer ? (req.user?.id || req.user?._id) : (req.user?.id || req.body?.farmerId);
      const phone = isFarmer ? req.user?.phone : (req.user?.phone || req.body?.phone);

      if (!latitude || !longitude) {
        return errorResponse(res, 'Latitude and longitude are required', 400);
      }

      const result = await farmerService.updatePickupLocation({
        farmerId,
        phone,
        latitude,
        longitude,
        address
      });

      return successResponse(res, result, 'Pickup location updated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Update farmer's Expo push token
   * PATCH /api/farmers/push-token
   */
  updatePushToken: async (req, res) => {
    try {
      const { pushToken } = req.body;
      const isFarmer = req.user?.role === 'farmer';

      if (isFarmer && req.body?.phone && req.body.phone !== req.user.phone) {
        return errorResponse(res, 'Access denied: Cannot update push token for a different phone number.', 403);
      }

      const farmerId = isFarmer ? (req.user?.id || req.user?._id) : (req.user?.id || req.body?.farmerId);
      const phone = isFarmer ? req.user?.phone : (req.user?.phone || req.body?.phone);

      if (!pushToken) {
        return errorResponse(res, 'pushToken string is required', 400);
      }

      const result = await farmerService.updatePushToken({
        farmerId,
        phone,
        pushToken
      });

      return successResponse(res, result, 'Push token updated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Update farmer's Land Record
   * PUT /api/farmers/me/land
   */
  updateLandRecord: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      const phone = req.user?.phone;

      if (!farmerId && !phone) {
        return errorResponse(res, 'Unauthorized: Farmer authentication token required.', 401);
      }

      const result = await farmerService.updateLandRecord({
        farmerId,
        phone,
        landData: req.body
      });

      return successResponse(res, result, 'Land details updated successfully. Verification status: Self-declared, pending verification');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Get authenticated farmer's Land Record
   * GET /api/farmers/me/land
   */
  getLandRecord: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      const phone = req.user?.phone;

      if (!farmerId && !phone) {
        return errorResponse(res, 'Unauthorized: Farmer authentication token required.', 401);
      }

      const landRecord = await farmerService.getLandRecord({ farmerId, phone });
      return successResponse(res, { landRecord }, 'Land record retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Get specific farmer's Land Record by ID or Phone (Staff only)
   * GET /api/farmers/:idOrPhone/land
   */
  getFarmerLandRecordByIdOrPhone: async (req, res) => {
    try {
      const { idOrPhone } = req.params;
      const isPhone = /^\d{10}$/.test(idOrPhone);
      const farmerId = isPhone ? null : idOrPhone;
      const phone = isPhone ? idOrPhone : null;

      const landRecord = await farmerService.getLandRecord({ farmerId, phone });
      return successResponse(res, { landRecord }, 'Farmer land record retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Ephemeral 7/12 OCR extraction endpoint
   * POST /api/farmers/me/land/extract
   * Ephemeral processing: Returns suggestions only, never keeps file on disk or DB.
   */
  extractLandRecord: async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return errorResponse(res, '7/12 document file (PDF, JPG, or PNG) is required.', 400);
      }

      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname;

      const extractionResult = await landExtractService.extract712LandDetails(
        fileBuffer,
        mimeType,
        originalName
      );

      return successResponse(
        res,
        {
          suggestions: extractionResult.suggestions,
          source: extractionResult.source,
          extracted: extractionResult.extracted
        },
        '7/12 suggestions extracted. Document discarded (not stored).'
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Supervisor or Resource Officer verifies or rejects farmer land record
   * PATCH /api/farmers/:id/land-verification
   */
  verifyLandRecord: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      const staffUser = req.user;

      if (!staffUser || !['supervisor', 'resource_officer', 'admin'].includes(staffUser.role)) {
        return errorResponse(res, 'Access denied: Only Mandi Supervisor or Resource Officer can verify or reject land records.', 403);
      }

      const result = await farmerService.verifyLandRecord({
        farmerId: id,
        staffUser,
        status,
        reason
      });

      return successResponse(res, result, result.message);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Read-only counts for district admin
   * GET /api/farmers/land-verification/counts
   */
  getLandVerificationCounts: async (req, res) => {
    try {
      const counts = await farmerService.getLandVerificationCounts(req.query.centreId);
      return successResponse(res, counts, 'Land verification counts retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = farmerController;
