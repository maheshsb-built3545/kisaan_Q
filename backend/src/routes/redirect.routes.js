'use strict';

const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirect.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * Farmer-facing Redirect Offer Routes (B9 — PRD 2.9)
 * Mounted at /api/offers
 *
 * GET  /api/offers/redirect/mine         — farmer's pending/accepted/declined redirect offers
 * POST /api/offers/redirect/:id/accept   — farmer accepts the redirect
 * POST /api/offers/redirect/:id/decline  — farmer declines the redirect
 */

router.get('/redirect/mine',
  authenticate,
  redirectController.getMyOffers
);

router.post('/redirect/:id/accept',
  authenticate,
  redirectController.acceptOffer
);

router.post('/redirect/:id/decline',
  authenticate,
  redirectController.declineOffer
);

module.exports = router;
