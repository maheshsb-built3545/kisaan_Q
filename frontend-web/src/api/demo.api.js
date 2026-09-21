import { farmerClient, staffClient } from './client';

/**
 * demo.api.js — KisanQ Showcase Demo API
 *
 * getDemoStatus()      — GET /auth/demo/status (no auth required)
 * demoFarmerLogin()    — POST /auth/demo/farmer  (issues farmer JWT with demo:true)
 * demoStaffLogin()     — POST /auth/demo/staff   (issues staff JWT with demo:true)
 * resetDemoData()      — POST /demo/reset (requires active demo token)
 *
 * Uses farmerClient for farmer endpoints, staffClient for staff endpoints.
 */

export const demoApi = {
  /**
   * GET /api/auth/demo/status
   * Returns { enabled: bool }. No auth required.
   */
  getDemoStatus: async () => {
    const res = await farmerClient.get('/auth/demo/status');
    return res.data;
  },

  /**
   * POST /api/auth/demo/farmer
   * Body: { profile: 'ramesh_kadam' | 'sunil_shinde' | 'dattatray_pawar' }
   * Returns { token, user, landingPath }
   */
  demoFarmerLogin: async (profile = 'ramesh_kadam') => {
    const res = await farmerClient.post('/auth/demo/farmer', { profile });
    return res.data;
  },

  /**
   * POST /api/auth/demo/staff
   * Body: { role: 'security_gate' | 'quality_assayer' | ... }
   * Returns { token, user, landingPath }
   */
  demoStaffLogin: async (role) => {
    const res = await staffClient.post('/auth/demo/staff', { role });
    return res.data;
  },

  /**
   * POST /api/demo/reset
   * Re-times showcase-tagged live scenarios.
   * Uses farmerClient (farmer demo token) or staffClient (staff demo token)
   * depending on which area is calling the reset.
   * area: 'farmer' | 'staff'
   */
  resetDemoData: async (area = 'farmer') => {
    const client = area === 'staff' ? staffClient : farmerClient;
    const res = await client.post('/demo/reset');
    return res.data;
  }
};

export default demoApi;
