const notificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const notificationController = {
  /**
   * GET /api/notifications/:bookingId/log - View notification delivery log for a booking
   */
  getNotificationLog: async (req, res) => {
    try {
      const { bookingId } = req.params;
      const logs = await notificationService.getNotificationLog(bookingId);
      return successResponse(res, logs, 'Notification delivery logs retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * POST /api/notifications/send - Send a notification (internal/admin simulation)
   */
  sendNotification: async (req, res) => {
    try {
      const { bookingId, channel, messageType, payload } = req.body;
      const notification = await notificationService.sendNotification({
        bookingId,
        channel,
        messageType,
        payload
      });
      return successResponse(res, notification, 'Notification dispatched successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/notifications/:id/retry - Retry a failed notification
   */
  retryNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await notificationService.retryNotification(id);
      return successResponse(res, notification, 'Notification retried successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/notifications/test-push - Send a test push notification to the authenticated farmer's device
   */
  sendTestPush: async (req, res) => {
    try {
      const farmerId = req.user?.id || req.user?._id;
      const phone = req.user?.phone;
      const { pushToken, title, body, data } = req.body || {};

      const result = await notificationService.sendTestPushNotification({
        farmerId,
        phone,
        pushToken,
        title,
        body,
        data
      });

      return successResponse(res, result, 'Test push notification dispatched to Expo');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }
};

module.exports = notificationController;
