const express = require('express');
const router = express.Router();
const exceptionController = require('../controllers/exception.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// List all exceptions with optional ?status= filter (pending_review | resolved)
router.get(
  '/',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  exceptionController.getAllExceptions
);

// Raise exception (staff, operator, supervisor)
router.post(
  '/',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  exceptionController.raiseException
);

// Supervisor override (strictly supervisor only)
router.post(
  '/:id/override',
  authenticate,
  checkRole('supervisor', 'district_admin'),
  exceptionController.supervisorOverride
);

// Get exceptions by booking ID (staff, operator, supervisor)
router.get(
  '/booking/:bookingId',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  exceptionController.getExceptionsByBooking
);

// Get exception details by ID (staff, operator, supervisor)
router.get(
  '/:id',
  authenticate,
  checkRole('operator', 'staff', 'supervisor'),
  exceptionController.getExceptionById
);

module.exports = router;
