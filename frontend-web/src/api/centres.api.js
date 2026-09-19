import apiClient from './client';

export const centresApi = {
  getAllCentres: async (params = {}) => {
    const res = await apiClient.get('/centres', { params });
    return res.data;
  },

  getCentreById: async (id) => {
    const res = await apiClient.get(`/centres/${id}`);
    return res.data;
  },

  getAvailability: async (id, { date, crop } = {}) => {
    const res = await apiClient.get(`/centres/${id}/availability`, {
      params: { date, crop },
    });
    return res.data;
  },

  createCentre: async (centreData) => {
    const res = await apiClient.post('/centres', centreData);
    return res.data;
  },
};
