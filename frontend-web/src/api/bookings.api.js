import { farmerClient } from './client';

export const bookingsApi = {
  createBooking: async (data) => {
    const res = await farmerClient.post('/bookings', data);
    return res.data;
  },

  getMyBookings: async () => {
    const res = await farmerClient.get('/bookings/my');
    return res.data;
  },

  getBookingById: async (id) => {
    const res = await farmerClient.get(`/bookings/${id}`);
    return res.data;
  },

  cancelBooking: async (id, reason) => {
    const res = await farmerClient.post(`/bookings/${id}/cancel`, { reason });
    return res.data;
  },
};
