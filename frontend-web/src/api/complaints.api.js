import apiClient from './client';

export const complaintsApi = {
  createComplaint: async (data) => {
    const res = await apiClient.post('/complaints', data);
    return res.data;
  },

  getMyComplaints: async (phone = null) => {
    const res = await apiClient.get('/complaints/my', { params: phone ? { phone } : {} });
    return res.data;
  },

  getComplaints: async (params = {}) => {
    const res = await apiClient.get('/complaints', { params });
    return res.data;
  },

  getAllComplaints: async (params = {}) => {
    const res = await apiClient.get('/complaints/all', { params });
    return res.data;
  },

  getComplaintById: async (id) => {
    const res = await apiClient.get(`/complaints/${id}`);
    return res.data;
  },

  resolveComplaint: async (id, data) => {
    const res = await apiClient.patch(`/complaints/${id}/resolve`, data);
    return res.data;
  }
};
