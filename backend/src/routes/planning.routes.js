const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { scopeToCentre } = require('../middleware/scopeToCentre.middleware');

/**
 * Resource Planning Officer Endpoints
 */
router.get(
  '/me',
  authenticate,
  checkRole('resource_officer', 'supervisor', 'district_admin'),
  scopeToCentre(),
  planningController.getPlanningMe
);

module.exports = router;
