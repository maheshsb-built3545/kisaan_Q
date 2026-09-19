import apiClient from './client';

export const bookingsApi = {
  createBooking: async (data) => {
    const res = await apiClient.post('/bookings', data);
    return res.data;
  },

  getMyBookings: async () => {
    const res = await apiClient.get('/bookings/my');
    return res.data;
  },

  getBookingById: async (id) => {
    const res = await apiClient.get(`/bookings/${id}`);
    return res.data;
  },

  cancelBooking: async (id, reason) => {
    const res = await apiClient.post(`/bookings/${id}/cancel`, { reason });
    return res.data;
  },
};
