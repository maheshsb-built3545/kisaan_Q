const mongoose = require('mongoose');
const { AuditLog } = require('../models');

const inMemoryAuditLogs = [];

const auditService = {
  /**
   * Record an immutable audit log entry in MongoDB or in-memory fallback
   */
  recordLog: async ({ actorId, actorRole, action, targetId, reason }) => {
    const entry = {
      _id: new mongoose.Types.ObjectId(),
      actorId,
      actorRole,
      action,
      targetId,
      reason,
      timestamp: new Date()
    };
    if (mongoose.connection.readyState === 1) {
      return await AuditLog.create(entry);
    }
    inMemoryAuditLogs.unshift(entry);
    return entry;
  },

  /**
   * Query AuditLog with optional targetId and actorRole filters.
   * Returns up to 100 entries sorted by timestamp descending.
   */
  getAuditLogs: async ({ targetId, actorRole } = {}) => {
    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (targetId)  filter.targetId  = targetId;
      if (actorRole) filter.actorRole = actorRole;

      const logs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      return logs;
    }

    return inMemoryAuditLogs.filter((log) => {
      if (targetId && String(log.targetId) !== String(targetId)) return false;
      if (actorRole && log.actorRole !== actorRole) return false;
      return true;
    }).slice(0, 100);
  }
};

module.exports = auditService;
