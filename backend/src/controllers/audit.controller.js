const auditService = require('../services/auditService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const auditController = {
  /**
   * GET /api/audit/logs
   * Optional query params: targetId, actorRole
   * Returns up to 100 log entries sorted by timestamp descending.
   */
  getAuditLogs: async (req, res) => {
    try {
      const { targetId, actorRole } = req.query;
      const logs = await auditService.getAuditLogs({ targetId, actorRole });
      return successResponse(res, logs, 'Audit logs retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to retrieve audit logs', 500);
    }
  }
};

module.exports = auditController;
