import apiClient from './client';

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

export default notificationsApi;
