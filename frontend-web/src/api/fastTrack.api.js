import apiClient from './client';

export const fastTrackApi = {
  /**
   * Get active and past Fast-Track auction rounds
   * GET /api/fasttrack/rounds
   */
  getRounds: async (params = {}) => {
    const res = await apiClient.get('/fasttrack/rounds', { params });
    return res.data;
  },

  /**
   * Get single Fast-Track round details with candidateQueue and leader
   * GET /api/fasttrack/rounds/:id
   */
  getRoundById: async (id) => {
    const res = await apiClient.get(`/fasttrack/rounds/${id}`);
    return res.data;
  },

  /**
   * Get bid stream for a round
   * GET /api/fasttrack/rounds/:id/bids
   */
  getRoundBids: async (id) => {
    const res = await apiClient.get(`/fasttrack/rounds/${id}/bids`);
    return res.data;
  },

  /**
   * Farmer joins a round with their confirmed booking
   * POST /api/fasttrack/rounds/:id/join
   */
  joinRound: async (id, data) => {
    const res = await apiClient.post(`/fasttrack/rounds/${id}/join`, data);
    return res.data;
  },

  /**
   * Farmer requests round start when <5 participants
   * POST /api/fasttrack/rounds/:id/request-start
   */
  requestStart: async (id) => {
    const res = await apiClient.post(`/fasttrack/rounds/${id}/request-start`);
    return res.data;
  },

  /**
   * Place atomic bid
   * POST /api/fasttrack/rounds/:id/bids
   */
  placeBid: async (id, data) => {
    const res = await apiClient.post(`/fasttrack/rounds/${id}/bids`, data);
    return res.data;
  },

  /**
   * Officer approves or declines start request
   * POST /api/fasttrack/rounds/:id/start-decision
   */
  officerStartDecision: async (id, data) => {
    const res = await apiClient.post(`/fasttrack/rounds/${id}/start-decision`, data);
    return res.data;
  },

  /**
   * Officer approves or declines round winner
   * POST /api/fasttrack/rounds/:id/decision
   */
  officerDecision: async (id, data) => {
    const res = await apiClient.post(`/fasttrack/rounds/${id}/decision`, data);
    return res.data;
  },

  // Legacy fallback
  getPendingRequests: async (params = {}) => {
    const res = await apiClient.get('/fasttrack/rounds', { params: { ...params, status: 'AWAITING_APPROVAL' } });
    return res.data;
  }
};
