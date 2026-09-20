import { staffClient } from './client';

/**
 * Staff-area notification API — uses staffClient (kisanq_staff_token only).
 * Used by StaffHeader NotificationBell and any staff portal notification page.
 */
export const staffNotificationsApi = {
  getMyNotifications: async (params = {}) => {
    const res = await staffClient.get('/notifications', { params });
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await staffClient.get('/notifications/unread-count');
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await staffClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await staffClient.post('/notifications/read-all');
    return res.data;
  },
};

export default staffNotificationsApi;
