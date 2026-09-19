import apiClient from './client';

export const exceptionsApi = {
  getAllExceptions: async (params = {}) => {
    const res = await apiClient.get('/exceptions', { params });
    return res.data;
  },

  raiseException: async ({ bookingId, type, reasonCode, raisedBy }) => {
    const res = await apiClient.post('/exceptions', {
      bookingId,
      type,
      reasonCode,
      raisedBy,
    });
    return res.data;
  },

  supervisorOverride: async (id, { overrideReason, outcome }) => {
    const res = await apiClient.post(`/exceptions/${id}/override`, {
      overrideReason,
      outcome,
    });
    return res.data;
  },

  getExceptionsByBooking: async (bookingId) => {
    const res = await apiClient.get(`/exceptions/booking/${bookingId}`);
    return res.data;
  },

  getExceptionById: async (id) => {
    const res = await apiClient.get(`/exceptions/${id}`);
    return res.data;
  },
};
