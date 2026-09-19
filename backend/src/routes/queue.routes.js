const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// Live queue state (public for dashboard display boards)
router.get('/live/:centreId', queueController.getLiveQueue);

// Staff actions: check-in and release require authentication and staff roles
router.post(
  '/:bookingId/check-in',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  queueController.checkIn
);

router.post(
  '/:bookingId/release',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  queueController.releaseSlot
);

router.post(
  '/:bookingId/mark-eligible',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  queueController.markEligibleForRelease
);

// HTTP fallback for position recovery (authenticated farmer or staff)
router.get(
  '/:centreId/position/:bookingId',
  authenticate,
  queueController.getPosition
);

module.exports = router;
