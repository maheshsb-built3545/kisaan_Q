import { farmerClient } from './client';

/**
 * Farmer-area notifications API — uses farmerClient (kisanq_farmer_token only).
 * Used by farmer portal NotificationBell and NotificationsPage.
 */
export const notificationsApi = {
  getMyNotifications: async (params = {}) => {
    const res = await farmerClient.get('/notifications', { params });
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await farmerClient.get('/notifications/unread-count');
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await farmerClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await farmerClient.post('/notifications/read-all');
    return res.data;
  },

  getNotificationLog: async (bookingId) => {
    const res = await farmerClient.get(`/notifications/${bookingId}/log`);
    return res.data;
  },

  sendNotification: async (data) => {
    const res = await farmerClient.post('/notifications/send', data);
    return res.data;
  },

  retryNotification: async (id) => {
    const res = await farmerClient.post(`/notifications/${id}/retry`);
    return res.data;
  },
};

export default notificationsApi;
