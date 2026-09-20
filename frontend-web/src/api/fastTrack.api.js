import { farmerClient } from './client';
import { staffClient } from './client';

/**
 * Farmer-area Fast-Track API — uses farmerClient (kisanq_farmer_token only).
 * Farmer actions: view rounds, join, bid, request-start.
 */
export const fastTrackApi = {
  getRounds: async (params = {}) => {
    const res = await farmerClient.get('/fasttrack/rounds', { params });
    return res.data;
  },

  getRoundById: async (id) => {
    const res = await farmerClient.get(`/fasttrack/rounds/${id}`);
    return res.data;
  },

  getRoundBids: async (id) => {
    const res = await farmerClient.get(`/fasttrack/rounds/${id}/bids`);
    return res.data;
  },

  joinRound: async (id, data) => {
    const res = await farmerClient.post(`/fasttrack/rounds/${id}/join`, data);
    return res.data;
  },

  requestStart: async (id) => {
    const res = await farmerClient.post(`/fasttrack/rounds/${id}/request-start`);
    return res.data;
  },

  placeBid: async (id, data) => {
    const res = await farmerClient.post(`/fasttrack/rounds/${id}/bids`, data);
    return res.data;
  },

  // Legacy / Compatibility Aliases:
  getPendingRequests: async (params = {}) => {
    const res = await farmerClient.get('/fasttrack/rounds', { params: { ...params, status: 'AWAITING_APPROVAL' } });
    return res.data;
  },

  getFastTrackStatus: async (tokenNumber, params = {}) => {
    const res = await farmerClient.get('/fasttrack/rounds', { params: { centreId: params.mandiId } });
    return res.data;
  },

  requestFastTrack: async (tokenNumber, data = {}) => {
    return { success: true, message: 'Please join the active Fast-Track auction round.' };
  },
};

/**
 * Staff-area Fast-Track API — uses staffClient (kisanq_staff_token only).
 * Officer actions: start-decision, final decision, view all rounds.
 */
export const staffFastTrackApi = {
  getRounds: async (params = {}) => {
    const res = await staffClient.get('/fasttrack/rounds', { params });
    return res.data;
  },

  getRoundById: async (id) => {
    const res = await staffClient.get(`/fasttrack/rounds/${id}`);
    return res.data;
  },

  getRoundBids: async (id) => {
    const res = await staffClient.get(`/fasttrack/rounds/${id}/bids`);
    return res.data;
  },

  officerStartDecision: async (id, data) => {
    const res = await staffClient.post(`/fasttrack/rounds/${id}/start-decision`, data);
    return res.data;
  },

  officerDecision: async (id, data) => {
    const res = await staffClient.post(`/fasttrack/rounds/${id}/decision`, data);
    return res.data;
  },

  // Legacy / Compatibility Aliases (maps to PRD decision route with staffClient):
  getPendingRequests: async (params = {}) => {
    const res = await staffClient.get('/fasttrack/rounds', { params: { ...params, status: 'AWAITING_APPROVAL' } });
    return res.data;
  },

  approveRequest: async (roundId, officerId) => {
    const res = await staffClient.post(`/fasttrack/rounds/${roundId}/decision`, {
      approved: true,
      officerId
    });
    return res.data;
  },

  rejectRequest: async (roundId, officerId, reason) => {
    const res = await staffClient.post(`/fasttrack/rounds/${roundId}/decision`, {
      approved: false,
      reason,
      officerId
    });
    return res.data;
  },
};

