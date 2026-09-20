import apiClient from './client';

export const waitlistApi = {
  joinWaitlist: async (data) => {
    const res = await apiClient.post('/waitlist/join', data);
    return res.data;
  },

  getMyWaitlist: async () => {
    const res = await apiClient.get('/waitlist/my');
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

  acceptOffer: async (offerId) => {
    const res = await apiClient.post(`/waitlist/offers/${offerId}/accept`);
    return res.data;
  },

  declineOffer: async (offerId) => {
    const res = await apiClient.post(`/waitlist/offers/${offerId}/decline`);
    return res.data;
  }
};

export default waitlistApi;
