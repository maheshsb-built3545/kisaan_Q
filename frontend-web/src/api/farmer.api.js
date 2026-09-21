import { farmerClient, staffClient } from './client';

export const farmerApi = {
  /**
   * Get authenticated farmer's land record
   * GET /api/farmers/me/land
   */
  getLandRecord: async () => {
    const res = await farmerClient.get('/farmers/me/land');
    return res.data;
  },

  /**
   * Save or update authenticated farmer's land record
   * PUT /api/farmers/me/land
   */
  updateLandRecord: async (landData) => {
    const res = await farmerClient.put('/farmers/me/land', landData);
    return res.data;
  },

  /**
   * Ephemeral 7/12 OCR extraction
   * POST /api/farmers/me/land/extract (multipart/form-data)
   */
  extractLandRecord: async (formData) => {
    const res = await farmerClient.post('/farmers/me/land/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  /**
   * Update pickup location coordinates
   * PATCH /api/farmers/pickup-location
   */
  updatePickupLocation: async (data) => {
    const res = await farmerClient.patch('/farmers/pickup-location', data);
    return res.data;
  },

  /**
   * Supervisor or Resource Officer verifies or rejects farmer land record
   * PATCH /api/farmers/:id/land-verification
   */
  verifyLandRecord: async (farmerId, { status, reason }) => {
    const res = await staffClient.patch(`/farmers/${farmerId}/land-verification`, {
      status,
      reason
    });
    return res.data;
  },

  /**
   * District Admin read-only land verification counts per centre
   * GET /api/farmers/land-verification/counts
   */
  getLandVerificationCounts: async (centreId = null) => {
    const res = await staffClient.get('/farmers/land-verification/counts', {
      params: centreId ? { centreId } : {}
    });
    return res.data;
  }
};
