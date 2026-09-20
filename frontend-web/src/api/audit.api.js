import { staffClient } from './client';

export const auditApi = {
  getAuditLogs: async (params = {}) => {
    const res = await staffClient.get('/audit/logs', { params });
    return res.data;
  },
};

export default auditApi;
