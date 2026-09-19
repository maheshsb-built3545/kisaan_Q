const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// GET /api/admin/dashboard-stats (Protected for district_admin / supervisor roles)
router.get(
  '/dashboard-stats',
  adminController.getDashboardStats
);

// POST /api/admin/reset-data (Purge all tokens/queues & reseed demo state)
router.post(
  '/reset-data',
  adminController.resetData
);

// GET /api/admin/farmers (List registered farmers with dues & active tokens)
router.get(
  '/farmers',
  adminController.getFarmers
);

// POST /api/admin/farmers (Manually register or provision a farmer profile)
router.post(
  '/farmers',
  adminController.createFarmer
);

module.exports = router;

