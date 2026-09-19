const express = require('express');
const router = express.Router();
const fastTrackController = require('../controllers/fastTrack.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

/**
 * Staff Fast-Track Priority Management Endpoints
 * NOTE: Role placeholder 'supervisor', 'district_admin', 'operator', 'admin' is used pending
 * a dedicated officer role definition in future releases.
 */
router.get(
  '/',
  authenticate,
  checkRole('supervisor', 'district_admin', 'operator', 'admin'),
  fastTrackController.getPendingRequests
);

router.post(
  '/:id/approve',
  authenticate,
  checkRole('supervisor', 'district_admin', 'operator', 'admin'),
  fastTrackController.approveRequest
);

router.post(
  '/:id/reject',
  authenticate,
  checkRole('supervisor', 'district_admin', 'operator', 'admin'),
  fastTrackController.rejectRequest
);

module.exports = router;
