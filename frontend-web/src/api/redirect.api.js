import { farmerClient, staffClient } from './client';

/**
 * Redirect & Broadcast API client (B9)
 */
export const redirectApi = {
  // Staff actions
  proposeRedirect: async (data) => {
    const res = await staffClient.post('/planning/redirects', data);
    return res.data;
  },

  setInboundQuota: async (data) => {
    const res = await staffClient.post('/planning/inbound-quota', data);
    return res.data;
  },

  sendBroadcast: async (data) => {
    const res = await staffClient.post('/planning/broadcasts', data);
    return res.data;
  },

  // Farmer actions
  getMyOffers: async () => {
    const res = await farmerClient.get('/offers/redirect/mine');
    return res.data;
  },

  acceptOffer: async (id) => {
    const res = await farmerClient.post(`/offers/redirect/${id}/accept`);
    return res.data;
  },

  declineOffer: async (id) => {
    const res = await farmerClient.post(`/offers/redirect/${id}/decline`);
    return res.data;
  },

  // Public day load
  getDayLoad: async (centreId) => {
    const res = await farmerClient.get(`/centres/${centreId}/day-load`);
    return res.data;
  }
};

export default redirectApi;
