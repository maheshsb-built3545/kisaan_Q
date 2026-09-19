const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// GET /api/audit/logs — query params: targetId, actorRole
router.get(
  '/logs',
  authenticate,
  checkRole('supervisor', 'district_admin', 'auditor'),
  auditController.getAuditLogs
);

module.exports = router;
