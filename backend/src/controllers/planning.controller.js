const { successResponse, errorResponse } = require('../utils/apiResponse');
const { Centre, StaffUser } = require('../models');
const logger = require('../utils/logger');

const planningController = {
  /**
   * Get authenticated officer's profile & assigned centre operational parameters
   * @route GET /api/planning/me
   * @access Protected (resource_officer, supervisor, district_admin)
   */
  getPlanningMe: async (req, res) => {
    try {
      const user = req.user;
      const assignedCentreCode = user.assignedMandi || user.assignedMandiId || 'KPG-01';

      let centreDoc = null;
      try {
        centreDoc = await Centre.findOne({
          $or: [
            { code: assignedCentreCode },
            { id: assignedCentreCode },
            { _id: user.centreId }
          ]
        }).lean();
      } catch (e) {
        logger.debug(`[Planning] Centre lookup notice: ${e.message}`);
      }

      const centreData = {
        code: assignedCentreCode,
        name: centreDoc?.name || user.assignedMandiName || `APMC Mandi (${assignedCentreCode})`,
        district: centreDoc?.district || 'Nashik',
        state: centreDoc?.state || 'Maharashtra',
        weighbridges: centreDoc?.weighbridges || 2,
        assayingBays: centreDoc?.assayingBays || 3,
        gateLanes: centreDoc?.gateLanes || 2,
        dailySlotCap: centreDoc?.dailySlotCap || 120,
        operatingHours: centreDoc?.operatingHours || '08:00 - 18:00',
        activeCrops: centreDoc?.activeCrops || ['Soybean', 'Cotton', 'Wheat', 'Onion', 'Maize', 'Chana']
      };

      return successResponse(res, {
        user: {
          id: user.id || user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          officerCode: user.officerCode,
          deskName: user.deskName,
          terminalCode: user.terminalCode,
          assignedMandi: user.assignedMandi,
          assignedMandiName: user.assignedMandiName
        },
        centre: centreData
      }, 'Planning officer profile and centre configuration retrieved successfully');
    } catch (err) {
      logger.error(`[Planning] getPlanningMe error: ${err.message}`);
      return errorResponse(res, 'Failed to fetch planning officer profile', 500, err.message);
    }
  }
};

module.exports = planningController;
