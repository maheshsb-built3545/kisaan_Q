import apiClient from './client';

export const fastTrackApi = {
  /**
   * Submit a Fast-Track Priority request for a booked token
   * POST /api/tokens/:tokenNumber/fasttrack-request
   */
  requestFastTrack: async (tokenNumber, { tier, phone } = {}) => {
    const res = await apiClient.post(`/tokens/${tokenNumber}/fasttrack-request`, {
      tier,
      phone
    });
    return res.data;
  },

  /**
   * Get Fast-Track status and available tiers for a token
   * GET /api/tokens/:tokenNumber/fasttrack-status
   */
  getFastTrackStatus: async (tokenNumber, params = {}) => {
    const res = await apiClient.get(`/tokens/${tokenNumber}/fasttrack-status`, { params });
    return res.data;
  },

  /**
   * Get Pending Fast-Track requests for an APMC mandi (Staff)
   * GET /api/staff/fasttrack-requests
   */
  getPendingRequests: async (params = {}) => {
    const res = await apiClient.get('/staff/fasttrack-requests', { params });
    return res.data;
  },

  /**
   * Approve a Fast-Track request (Staff)
   * POST /api/staff/fasttrack-requests/:id/approve
   */
  approveRequest: async (id) => {
    const res = await apiClient.post(`/staff/fasttrack-requests/${id}/approve`);
    return res.data;
  },

  /**
   * Reject a Fast-Track request (Staff)
   * POST /api/staff/fasttrack-requests/:id/reject
   */
  rejectRequest: async (id) => {
    const res = await apiClient.post(`/staff/fasttrack-requests/${id}/reject`);
    return res.data;
  }
};
