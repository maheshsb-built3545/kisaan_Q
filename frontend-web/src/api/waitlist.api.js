import { farmerClient } from './client';
import { staffClient } from './client';

/**
 * Farmer-area waitlist API — uses farmerClient (kisanq_farmer_token only).
 */
export const waitlistApi = {
  joinWaitlist: async (data) => {
    const res = await farmerClient.post('/waitlist/join', data);
    return res.data;
  },

  getMyWaitlist: async () => {
    const res = await farmerClient.get('/waitlist/my');
    return res.data;
  },

  getOffers: async (params = {}) => {
    const res = await farmerClient.get('/waitlist/offers', { params });
    return res.data;
  },

  acceptOffer: async (offerId) => {
    const res = await farmerClient.post(`/waitlist/offers/${offerId}/accept`);
    return res.data;
  },

  declineOffer: async (offerId) => {
    const res = await farmerClient.post(`/waitlist/offers/${offerId}/decline`);
    return res.data;
  },
};

/**
 * Staff-area waitlist API — uses staffClient (kisanq_staff_token only).
 * Staff views: released slots, centre waitlist.
 */
export const staffWaitlistApi = {
  getCentreWaitlist: async (centreId) => {
    const res = await staffClient.get(`/waitlist/centre/${centreId}`);
    return res.data;
  },

  getOffers: async (params = {}) => {
    const res = await staffClient.get('/waitlist/offers', { params });
    return res.data;
  },
};

export default waitlistApi;
