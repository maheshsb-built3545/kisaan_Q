'use strict';

/**
 * demo.routes.js
 *
 * POST /api/demo/reset — re-times showcase documents.
 * Requires demo:true JWT and DEMO_MODE=true.
 * Rate-limited to 1 request per 30 seconds per IP.
 */

const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demo.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { demoModeGuard, requireDemoToken, demoResetRateLimiter } = require('../middleware/demo.middleware');

/**
 * POST /api/demo/reset
 * Resets only showcase-tagged documents to live timings.
 * Requires: DEMO_MODE=true, valid demo JWT (farmer or staff).
 */
router.post(
  '/reset',
  demoModeGuard,
  authenticate,
  requireDemoToken,
  demoResetRateLimiter,
  demoController.resetDemoData
);

module.exports = router;
