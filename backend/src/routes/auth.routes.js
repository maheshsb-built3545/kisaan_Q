const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const demoController = require('../controllers/demo.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { otpRateLimiter, loginRateLimiter } = require('../middleware/rateLimiter.middleware');
const { demoModeGuard } = require('../middleware/demo.middleware');
const { successResponse } = require('../utils/apiResponse');

// Farmer authentication endpoints (with aliases for standard /request-otp and /verify-otp)
router.post('/farmer/request-otp', otpRateLimiter, authController.requestFarmerOtp);
router.post('/farmer/verify-otp', otpRateLimiter, authController.verifyFarmerOtp);
router.post('/request-otp', otpRateLimiter, authController.requestFarmerOtp);
router.post('/verify-otp', otpRateLimiter, authController.verifyFarmerOtp);

// Staff 2FA authentication pipeline
router.post('/staff/verify-credentials', loginRateLimiter, authController.verifyStaffCredentials);
router.post('/staff/verify-otp', loginRateLimiter, authController.verifyStaffOtp);

// Dynamic Mandi Center Switching (Requires active staff session)
router.patch('/staff/switch-centre', authenticate, authController.switchStaffCenter);

// Legacy / Administrative Staff endpoints
router.post('/staff/login', loginRateLimiter, authController.staffLogin);
router.post('/staff/register', authController.staffRegister);
router.post('/staff/seed', authController.seedStaff);

// ─── Demo Authentication Endpoints (DEMO_MODE guard required) ──────────────
// GET /api/auth/demo/status — no auth needed; returns { enabled: bool }
router.get('/demo/status', demoController.getDemoStatus);
// POST /api/auth/demo/farmer — issues farmer JWT with demo:true
router.post('/demo/farmer', demoModeGuard, demoController.demoFarmerLogin);
// POST /api/auth/demo/staff — issues staff JWT with demo:true
router.post('/demo/staff', demoModeGuard, demoController.demoStaffLogin);

// Current user profile check (Protected)
router.get('/me', authenticate, authController.getMe);

// RBAC test endpoints for automated testing and verification
router.get('/test-supervisor-guard', authenticate, checkRole('supervisor', 'district_admin'), (req, res) => {
  return successResponse(res, { role: req.user.role }, 'Supervisor authorization check passed');
});

router.get('/test-farmer-guard', authenticate, checkRole('farmer'), (req, res) => {
  return successResponse(res, { role: req.user.role }, 'Farmer authorization check passed');
});

module.exports = router;

