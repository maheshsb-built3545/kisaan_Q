import { staffClient } from './client';

/**
 * Planning API — uses staffClient for Resource Planning Officer Portal (B7/B9).
 */
export const planningApi = {
  getMe: async () => {
    const res = await staffClient.get('/planning/me');
    return res.data;
  },

  getForecast: async (centreId) => {
    const res = await staffClient.get('/planning/forecast', {
      params: centreId ? { centreId } : {}
    });
    return res.data;
  },

  postWhatIf: async (data) => {
    const res = await staffClient.post('/planning/what-if', data);
    return res.data;
  },

  simulatePeak: async (data) => {
    const res = await staffClient.post('/planning/simulate-peak', data);
    return res.data;
  },

  getResources: async (centreId) => {
    const res = await staffClient.get('/planning/resources', {
      params: centreId ? { centreId } : {}
    });
    return res.data;
  },

  putResources: async (data) => {
    const res = await staffClient.put('/planning/resources', data);
    return res.data;
  },

  getAvailability: async (centreId, date) => {
    const res = await staffClient.get('/planning/availability', {
      params: { centreId, date }
    });
    return res.data;
  },

  putAvailability: async (data) => {
    const res = await staffClient.put('/planning/availability', data);
    return res.data;
  },

  getEvents: async (centreId) => {
    const res = await staffClient.get('/planning/events', {
      params: centreId ? { centreId } : {}
    });
    return res.data;
  },

  postEvent: async (data) => {
    const res = await staffClient.post('/planning/events', data);
    return res.data;
  },

  getSlotCaps: async (centreId, date) => {
    const res = await staffClient.get('/planning/slot-caps', {
      params: { centreId, date }
    });
    return res.data;
  },

  putSlotCap: async (data) => {
    const res = await staffClient.put('/planning/slot-caps', data);
    return res.data;
  },

  getAccuracy: async (centreId) => {
    const res = await staffClient.get('/planning/accuracy', {
      params: centreId ? { centreId } : {}
    });
    return res.data;
  },

  getRequests: async (params = {}) => {
    const res = await staffClient.get('/planning/requests', { params });
    return res.data;
  },

  createRequest: async (data) => {
    const res = await staffClient.post('/planning/requests', data);
    return res.data;
  },

  decideRequest: async (id, data) => {
    const res = await staffClient.post(`/planning/requests/${id}/decision`, data);
    return res.data;
  }
};

export default planningApi;
