import apiClient from './client';

export const auditApi = {
  getAuditLogs: async (params = {}) => {
    const res = await apiClient.get('/audit/logs', { params });
    return res.data;
  },
};

export default auditApi;
