const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurement.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

router.post(
  '/inspection',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  procurementController.recordInspection
);
router.post(
  '/weight',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  procurementController.recordWeight
);
router.post(
  '/payment-status',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  procurementController.updatePaymentStatus
);

module.exports = router;
