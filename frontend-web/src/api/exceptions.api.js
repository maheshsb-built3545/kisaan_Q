import { staffClient } from './client';

export const exceptionsApi = {
  getAllExceptions: async (params = {}) => {
    const res = await staffClient.get('/exceptions', { params });
    return res.data;
  },

  raiseException: async ({ bookingId, type, reasonCode, raisedBy }) => {
    const res = await staffClient.post('/exceptions', {
      bookingId,
      type,
      reasonCode,
      raisedBy,
    });
    return res.data;
  },

  supervisorOverride: async (id, { overrideReason, outcome }) => {
    const res = await staffClient.post(`/exceptions/${id}/override`, {
      overrideReason,
      outcome,
    });
    return res.data;
  },

  getExceptionsByBooking: async (bookingId) => {
    const res = await staffClient.get(`/exceptions/booking/${bookingId}`);
    return res.data;
  },

  getExceptionById: async (id) => {
    const res = await staffClient.get(`/exceptions/${id}`);
    return res.data;
  },
};
