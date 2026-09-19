import apiClient from './client';

export const pricesApi = {
  /**
   * Get all crop prices or filter by params (e.g. { crop, mandiId, date })
   */
  getAllPrices: async (params = {}) => {
    const res = await apiClient.get('/prices', { params });
    return res.data;
  },

  /**
   * Get today's crop prices for a specific APMC mandi (e.g. 'KPG-01')
   */
  getPricesByMandi: async (mandiId, params = {}) => {
    const res = await apiClient.get(`/centres/${mandiId}/prices`, { params });
    return res.data;
  },

  /**
   * Get cross-mandi prices for a specific crop (e.g. 'Soybean')
   */
  getPricesByCrop: async (crop, params = {}) => {
    const res = await apiClient.get(`/prices/${crop}`, { params });
    return res.data;
  },
};
