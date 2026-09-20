import { staffClient } from './client';

export const adminApi = {
  getDashboardStats: async () => {
    const res = await staffClient.get('/admin/dashboard-stats');
    return res.data;
  },
};

export const auditApi = {
  getAuditLogs: async (params = {}) => {
    const res = await staffClient.get('/audit/logs', { params });
    return res.data;
  },
};

export const notificationsApi = {
  getNotificationLog: async (bookingId) => {
    const res = await staffClient.get(`/notifications/${bookingId}/log`);
    return res.data;
  },

  sendNotification: async (data) => {
    const res = await staffClient.post('/notifications/send', data);
    return res.data;
  },

  retryNotification: async (id) => {
    const res = await staffClient.post(`/notifications/${id}/retry`);
    return res.data;
  },
};
