import apiClient from './client';

export const queueApi = {
  getLiveQueue: async (centreId, date) => {
    const res = await apiClient.get(`/queue/live/${centreId}`, {
      params: date ? { date } : {},
    });
    return res.data;
  },

  checkIn: async (bookingId) => {
    const res = await apiClient.post(`/queue/${bookingId}/check-in`);
    return res.data;
  },

  releaseSlot: async (bookingId, reason) => {
    const res = await apiClient.post(`/queue/${bookingId}/release`, { reason });
    return res.data;
  },

  markEligible: async (bookingId) => {
    const res = await apiClient.post(`/queue/${bookingId}/mark-eligible`);
    return res.data;
  },

  getPosition: async (centreId, bookingId, date) => {
    const res = await apiClient.get(`/queue/${centreId}/position/${bookingId}`, {
      params: date ? { date } : {},
    });
    return res.data;
  },
};
