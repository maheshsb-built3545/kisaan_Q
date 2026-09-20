const notificationService = require('../services/notificationService');
const { Farmer } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const mongoose = require('mongoose');

const notificationController = {
  /**
   * GET /api/notifications - Get current authenticated user's notifications
   */
  getMyNotifications: async (req, res) => {
    try {
      const recipientId = [req.user?.phone, req.user?.id, req.user?._id].filter(Boolean);
      if (recipientId.length === 0) {
        return errorResponse(res, 'Authentication identity missing', 401);
      }

      const unreadOnly = req.query.unread === 'true' || req.query.unread === true;
      const limit = Number(req.query.limit) || 20;

      const notifications = await notificationService.getUserNotifications({
        recipientId,
        unreadOnly,
        limit
      });

      return successResponse(res, notifications, 'Notifications retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * GET /api/notifications/unread-count - Get unread count for current user
   */
  getUnreadCount: async (req, res) => {
    try {
      const recipientId = [req.user?.phone, req.user?.id, req.user?._id].filter(Boolean);
      if (recipientId.length === 0) {
        return errorResponse(res, 'Authentication identity missing', 401);
      }

      const count = await notificationService.getUnreadCount(recipientId);
      return successResponse(res, { unreadCount: count }, 'Unread count retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * PATCH /api/notifications/:id/read - Mark a single notification as read
   */
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const recipientId = [req.user?.phone, req.user?.id, req.user?._id].filter(Boolean);
      if (recipientId.length === 0) {
        return errorResponse(res, 'Authentication identity missing', 401);
      }

      const notification = await notificationService.markAsRead(id, recipientId);
      if (!notification) {
        return errorResponse(res, 'Notification not found or access denied', 404);
      }

      return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * POST /api/notifications/read-all - Mark all user notifications as read
   */
  markAllAsRead: async (req, res) => {
    try {
      const recipientId = [req.user?.phone, req.user?.id, req.user?._id].filter(Boolean);
      if (recipientId.length === 0) {
        return errorResponse(res, 'Authentication identity missing', 401);
      }

      const result = await notificationService.markAllAsRead(recipientId);
      return successResponse(res, result, 'All notifications marked as read');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * GET /api/notifications/sms-stats - View SMS usage and budget metrics (Admin read-only)
   */
  getSmsStats: async (req, res) => {
    try {
      let stats = { totalSmsSent: 0, farmersOverBudget: 0, sampleFarmers: [] };
      if (mongoose.connection.readyState === 1) {
        const total = await Farmer.aggregate([
          { $group: { _id: null, totalSent: { $sum: '$smsSentCount' } } }
        ]);
        const overBudget = await Farmer.countDocuments({ smsSentCount: { $gte: 5 } });
        const samples = await Farmer.find({ smsSentCount: { $gt: 0 } })
          .select('name phone smsSentCount noSmartphone')
          .limit(10)
          .lean();

        stats = {
          totalSmsSent: total[0]?.totalSent || 0,
          farmersOverBudget: overBudget,
          sampleFarmers: samples
        };
      }

      return successResponse(res, stats, 'SMS budget stats retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * GET /api/notifications/:bookingId/log - View notification delivery log for a booking (Legacy)
   * Scoped: Farmers read only their own booking log; Staff read bookings at their assigned centre.
   */
  getNotificationLog: async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!bookingId) {
        return errorResponse(res, 'Booking ID is required', 400);
      }

      const reqUser = req.user;
      if (!reqUser) {
        return errorResponse(res, 'Authentication required', 401);
      }

      const { Booking } = require('../models');
      let booking = null;
      if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(bookingId)) {
        booking = await Booking.findById(bookingId).populate('farmerId');
      }
      if (!booking) {
        const { _inMemoryBookings } = require('../services/bookingService');
        booking = _inMemoryBookings?.get(bookingId.toString()) || null;
      }

      if (booking) {
        const isFarmer = !reqUser.role || reqUser.role === 'farmer';
        const userId = (reqUser.id || reqUser._id || '').toString();
        const userPhone = reqUser.phone;
        const bookingFarmerId = (booking.farmerId?._id || booking.farmerId || '').toString();
        const bookingPhone = booking.farmerId?.phone || booking.phone;

        if (isFarmer) {
          const isOwner = (bookingFarmerId && bookingFarmerId === userId) || (bookingPhone && bookingPhone === userPhone);
          if (!isOwner) {
            return errorResponse(res, 'Access denied: You can only view notification logs for your own bookings', 403);
          }
        } else {
          const isDistrictWide = ['district_admin', 'auditor'].includes(reqUser.role);
          const staffCentre = reqUser.assignedMandi || reqUser.mandiId || reqUser.centreId;
          const bookingCentre = (booking.centreId?._id || booking.centreId || '').toString();
          if (!isDistrictWide && staffCentre && bookingCentre && staffCentre !== bookingCentre) {
            return errorResponse(res, `Access denied: Staff at centre ${staffCentre} cannot view logs for centre ${bookingCentre}`, 403);
          }
        }
      } else {
        // If booking not found and caller is farmer, return 404
        if (!reqUser.role || reqUser.role === 'farmer') {
          return errorResponse(res, `Booking '${bookingId}' not found`, 404);
        }
      }

      const logs = await notificationService.getNotificationLog(bookingId);
      return successResponse(res, logs, 'Notification delivery logs retrieved');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * POST /api/notifications/send - Send a notification (internal/admin simulation)
   * Staff only; validates recipient against booking
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
   * POST /api/notifications/test-push - Send a test push notification
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
