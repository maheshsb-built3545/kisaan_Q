'use strict';

const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { scopeToCentre } = require('../middleware/scopeToCentre.middleware');

const OFFICER_ROLES = ['resource_officer', 'supervisor', 'district_admin'];
const WRITE_ROLES = ['resource_officer'];

/**
 * Resource Planning Officer Endpoints (PRD 2.7)
 * resource_officer: full CRUD on own centre
 * district_admin: read-only across centres
 * supervisor: read-only (notified only)
 * others: 403
 */

// Officer profile
router.get('/me',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getPlanningMe
);

// 7-day forecast heat strip (labelled "rule-based forecast")
router.get('/forecast',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getForecast
);

// What-if scenario
router.post('/what-if',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.postWhatIf
);

// Simulate peak load (demo only)
router.post('/simulate-peak',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.postSimulatePeak
);

// Resources CRUD
router.get('/resources',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getResources
);
router.put('/resources',
  authenticate, checkRole(...WRITE_ROLES), scopeToCentre(),
  planningController.putResources
);

// Availability calendar
router.get('/availability',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getAvailability
);
router.put('/availability',
  authenticate, checkRole(...WRITE_ROLES), scopeToCentre(),
  planningController.putAvailability
);

// Centre events
router.get('/events',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getEvents
);
router.post('/events',
  authenticate, checkRole(...WRITE_ROLES), scopeToCentre(),
  planningController.postEvent
);

// Slot caps (warns, never cancels)
router.get('/slot-caps',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getSlotCaps
);
router.put('/slot-caps',
  authenticate, checkRole(...WRITE_ROLES), scopeToCentre(),
  planningController.putSlotCap
);

// Forecast accuracy
router.get('/accuracy',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getAccuracy
);

// Plan requests (own + borrow)
router.get('/requests',
  authenticate, checkRole(...OFFICER_ROLES), scopeToCentre(),
  planningController.getRequests
);
router.post('/requests',
  authenticate, checkRole(...WRITE_ROLES), scopeToCentre(),
  planningController.postRequest
);
router.post('/requests/:id/decision',
  authenticate, checkRole('resource_officer', 'district_admin'), scopeToCentre(),
  planningController.postDecision
);

// ─── B9: Redirect & Broadcast (officer side) ───────────────────────────────
const redirectController = require('../controllers/redirect.controller');

// Officer: propose redirect for a farmer
router.post('/redirects',
  authenticate, checkRole('resource_officer', 'district_admin'), scopeToCentre(),
  redirectController.proposeRedirect
);

// Officer: set inbound quota for receiving centre
router.post('/inbound-quota',
  authenticate, checkRole('resource_officer', 'district_admin'), scopeToCentre(),
  redirectController.setInboundQuota
);

// Officer: send broadcast to all farmers at centre
router.post('/broadcasts',
  authenticate, checkRole('resource_officer', 'district_admin'), scopeToCentre(),
  redirectController.sendBroadcast
);

module.exports = router;
