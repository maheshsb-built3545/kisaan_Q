import apiClient from './client';

export const notificationsApi = {
  getMyNotifications: async (params = {}) => {
    const res = await apiClient.get('/notifications', { params });
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },

  getNotificationLog: async (bookingId) => {
    const res = await apiClient.get(`/notifications/${bookingId}/log`);
    return res.data;
  },

  sendNotification: async (data) => {
    const res = await apiClient.post('/notifications/send', data);
    return res.data;
  },

  retryNotification: async (id) => {
    const res = await apiClient.post(`/notifications/${id}/retry`);
    return res.data;
  },
};

export default notificationsApi;
