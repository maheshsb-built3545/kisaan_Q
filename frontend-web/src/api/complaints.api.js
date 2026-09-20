import { farmerClient } from './client';
import { staffClient } from './client';

/**
 * Farmer-area complaints API — uses farmerClient (kisanq_farmer_token only).
 * Farmer actions: file complaint, view own complaints.
 */
export const complaintsApi = {
  createComplaint: async (data) => {
    const res = await farmerClient.post('/complaints', data);
    return res.data;
  },

  getMyComplaints: async () => {
    const res = await farmerClient.get('/complaints/my');
    return res.data;
  },

  getComplaintById: async (id) => {
    const res = await farmerClient.get(`/complaints/${id}`);
    return res.data;
  },
};

/**
 * Staff-area complaints API — uses staffClient (kisanq_staff_token only).
 * Staff/supervisor actions: view complaints list, resolve.
 */
export const staffComplaintsApi = {
  getComplaints: async (params = {}) => {
    const res = await staffClient.get('/complaints', { params });
    return res.data;
  },

  getAllComplaints: async (params = {}) => {
    const res = await staffClient.get('/complaints/all', { params });
    return res.data;
  },

  getComplaintById: async (id) => {
    const res = await staffClient.get(`/complaints/${id}`);
    return res.data;
  },

  resolveComplaint: async (id, data) => {
    const res = await staffClient.patch(`/complaints/${id}/resolve`, data);
    return res.data;
  },
};
