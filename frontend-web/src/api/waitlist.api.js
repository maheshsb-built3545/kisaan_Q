import apiClient from './client';

export const waitlistApi = {
  joinWaitlist: async (data) => {
    const res = await apiClient.post('/waitlist/join', data);
    return res.data;
  },

  getMyWaitlist: async (phone = null) => {
    const res = await apiClient.get('/waitlist/my', { params: phone ? { phone } : {} });
    return res.data;
  },

  getCentreWaitlist: async (centreId) => {
    const res = await apiClient.get(`/waitlist/centre/${centreId}`);
    return res.data;
  },

  getOffers: async (params = {}) => {
    const res = await apiClient.get('/waitlist/offers', { params });
    return res.data;
  },

  acceptOffer: async (offerId, phone = null) => {
    const res = await apiClient.post(`/waitlist/offers/${offerId}/accept`, { phone });
    return res.data;
  },

  declineOffer: async (offerId, phone = null) => {
    const res = await apiClient.post(`/waitlist/offers/${offerId}/decline`, { phone });
    return res.data;
  }
};
