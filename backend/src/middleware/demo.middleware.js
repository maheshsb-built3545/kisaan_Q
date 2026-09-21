'use strict';

const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');

/**
 * isDemoAllowed — true only when DEMO_MODE=true AND (NODE_ENV !== 'production'
 * OR ALLOW_DEMO_IN_PRODUCTION=true is explicitly set).
 */
const isDemoAllowed = () => {
  if (process.env.DEMO_MODE !== 'true') return false;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    return false;
  }
  return true;
};

/**
 * demoModeGuard — rejects any request when demo is not allowed.
 * Used on all /auth/demo/* and /demo/* endpoints.
 */
const demoModeGuard = (req, res, next) => {
  if (!isDemoAllowed()) {
    return errorResponse(
      res,
      'Demo mode is not enabled on this server. Set DEMO_MODE=true in backend/.env.',
      403
    );
  }
  next();
};

/**
 * requireDemoToken — called after authenticate middleware.
 * Ensures the JWT was issued by a demo endpoint (demo:true claim).
 */
const requireDemoToken = (req, res, next) => {
  if (!req.user?.demo) {
    return errorResponse(res, 'This endpoint requires a demo session token.', 403);
  }
  next();
};

/**
 * demoResetRateLimiter — max 1 reset per 30 seconds per IP.
 */
const demoResetRateLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: {
    success: false,
    message: 'Demo reset is rate-limited to once every 30 seconds. Please wait.',
    timestamp: new Date().toISOString()
  }
});

module.exports = {
  isDemoAllowed,
  demoModeGuard,
  requireDemoToken,
  demoResetRateLimiter
};
