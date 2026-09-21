const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const farmerController = require('../controllers/farmer.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// In-memory upload configuration with 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  }
});

// Rate limiter for 7/12 OCR extraction (max 10 requests per 15 mins)
const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many 7/12 extract requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Farmer Profile Endpoints (Farmer JWT required)
router.patch('/pickup-location', authenticate, checkRole('farmer'), farmerController.updatePickupLocation);
router.patch('/push-token', authenticate, checkRole('farmer'), farmerController.updatePushToken);

// Land Record CRUD (Authenticated farmer only)
router.put('/me/land', authenticate, checkRole('farmer'), farmerController.updateLandRecord);
router.get('/me/land', authenticate, checkRole('farmer'), farmerController.getLandRecord);

// Ephemeral 7/12 Extraction (Rate limited, strictly discarded in finally block)
router.post(
  '/me/land/extract',
  authenticate,
  checkRole('farmer'),
  extractLimiter,
  upload.single('file'),
  farmerController.extractLandRecord
);

// Land Verification & Rejection (Supervisor / Resource Officer only)
router.patch(
  '/:id/land-verification',
  authenticate,
  checkRole('supervisor', 'resource_officer', 'admin'),
  farmerController.verifyLandRecord
);

// District Admin Read-only Verification Counts
router.get(
  '/land-verification/counts',
  authenticate,
  checkRole('district_admin', 'admin', 'supervisor', 'resource_officer'),
  farmerController.getLandVerificationCounts
);

module.exports = router;
