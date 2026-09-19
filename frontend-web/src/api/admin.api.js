import apiClient from './client';

export const adminApi = {
  getDashboardStats: async () => {
    const res = await apiClient.get('/admin/dashboard-stats');
    return res.data;
  },
};

export const auditApi = {
  getAuditLogs: async (params = {}) => {
    const res = await apiClient.get('/audit/logs', { params });
    return res.data;
  },
};

export const notificationsApi = {
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
