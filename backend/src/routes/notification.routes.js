const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// 1. Authenticated User Inbox & Notification Bell Endpoints
router.get(
  '/',
  authenticate,
  notificationController.getMyNotifications
);

router.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

router.patch(
  '/:id/read',
  authenticate,
  notificationController.markAsRead
);

// Aliases for single-notification mark as read
router.put(
  '/:id/read',
  authenticate,
  notificationController.markAsRead
);
router.post(
  '/:id/read',
  authenticate,
  notificationController.markAsRead
);

/**
 * @route   POST /api/notifications/read-all
 * @desc    Mark all user notifications as read (PRD standard)
 * @access  Authenticated
 */
router.post(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead
);

// Documented Aliases for mark-all-as-read (PUT, PATCH)
router.put(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead
);
router.patch(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead
);


// 2. Administrative & Budget Oversight
router.get(
  '/sms-stats',
  authenticate,
  checkRole('supervisor', 'district_admin', 'auditor'),
  notificationController.getSmsStats
);

// 3. Legacy / Booking-Specific Endpoints
router.get(
  '/:bookingId/log',
  authenticate,
  notificationController.getNotificationLog
);

router.post(
  '/send',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'district_admin'),
  notificationController.sendNotification
);

router.post(
  '/:id/retry',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'district_admin', 'resource_officer'),
  notificationController.retryNotification
);

router.post(
  '/resend-sms/:id',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'district_admin', 'resource_officer'),
  notificationController.retryNotification
);

router.post(
  '/:id/resend-sms',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'district_admin', 'resource_officer'),
  notificationController.retryNotification
);

router.post(
  '/test-push',
  authenticate,
  notificationController.sendTestPush
);

module.exports = router;
