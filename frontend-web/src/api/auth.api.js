import { farmerClient, staffClient } from './client';

export const authApi = {
  /**
   * Request OTP for farmer login / registration (no auth token needed yet)
   */
  requestFarmerOtp: async ({ phone, name, preferredLanguage, registeredVia, passcode, mode }) => {
    const res = await farmerClient.post('/auth/farmer/request-otp', {
      phone,
      name,
      preferredLanguage,
      registeredVia,
      passcode,
      mode,
    });
    return res.data;
  },

  /**
   * Verify OTP and complete farmer authentication (no auth token needed yet)
   */
  verifyFarmerOtp: async ({ phone, otp, name, preferredLanguage, registeredVia, passcode, mode }) => {
    const res = await farmerClient.post('/auth/farmer/verify-otp', {
      phone,
      otp,
      name,
      preferredLanguage,
      registeredVia,
      passcode,
      mode,
    });
    return res.data;
  },

  /**
   * Step 1: Staff Role & Credential Match (no auth token needed yet)
   */
  verifyStaffCredentials: async ({ mobileNumber, phone, password, role }) => {
    const res = await staffClient.post('/auth/staff/verify-credentials', {
      mobileNumber: mobileNumber || phone,
      phone: phone || mobileNumber,
      password,
      role,
    });
    return res.data;
  },

  /**
   * Step 2: Staff OTP Verification (no auth token needed yet — challenge token in body)
   */
  verifyStaffOtp: async ({ challengeToken, otp }) => {
    const res = await staffClient.post('/auth/staff/verify-otp', {
      challengeToken,
      otp,
    });
    return res.data;
  },

  /**
   * Dynamic Mandi Center Switching — uses staffClient (requires active staff token)
   */
  switchStaffCenter: async ({ targetMandiId, targetMandiName }) => {
    const res = await staffClient.patch('/auth/staff/switch-centre', {
      targetMandiId,
      targetMandiName,
    });
    return res.data;
  },

  /**
   * Legacy Staff login with name/phone and password — uses staffClient
   */
  staffLogin: async ({ name, phone, password }) => {
    const res = await staffClient.post('/auth/staff/login', {
      name,
      phone,
      password,
    });
    return res.data;
  },

  /**
   * Staff registration (internal onboarding) — uses staffClient
   */
  staffRegister: async ({ name, role, centreId, password, officerCode, deskName, terminalLane, assignedMandi }) => {
    const res = await staffClient.post('/auth/staff/register', {
      name,
      role,
      centreId,
      password,
      officerCode,
      deskName,
      terminalLane,
      assignedMandi,
    });
    return res.data;
  },

  /**
   * Fetch current authenticated user profile — uses staffClient (called during staff session validation)
   */
  getMe: async () => {
    const res = await staffClient.get('/auth/me');
    return res.data;
  },

  /**
   * Save or update farmer pickup location pin — uses farmerClient
   */
  updatePickupLocation: async ({ latitude, longitude, address, phone }) => {
    const res = await farmerClient.patch('/farmers/pickup-location', {
      latitude,
      longitude,
      address,
      phone,
    });
    return res.data;
  },
};
