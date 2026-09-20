import { staffClient } from './client';

export const procurementApi = {
  recordInspection: async ({ bookingId, grade, moisturePercentage, inspectorNotes }) => {
    const res = await staffClient.post('/procurement/inspection', {
      bookingId,
      grade,
      moisturePercentage,
      inspectorNotes,
    });
    return res.data;
  },

  recordWeight: async ({ bookingId, grossWeight, tareWeight, netWeight, weighbridgeId }) => {
    const res = await staffClient.post('/procurement/weight', {
      bookingId,
      grossWeight,
      tareWeight,
      netWeight,
      weighbridgeId,
    });
    return res.data;
  },

  updatePaymentStatus: async ({ bookingId, paymentStatus }) => {
    const res = await staffClient.post('/procurement/payment-status', {
      bookingId,
      paymentStatus,
    });
    return res.data;
  },
};
