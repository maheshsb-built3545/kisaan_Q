import apiClient from './client';

export const authApi = {
  /**
   * Request OTP for farmer login / registration
   */
  requestFarmerOtp: async ({ phone, name, preferredLanguage, registeredVia, passcode, mode }) => {
    const res = await apiClient.post('/auth/farmer/request-otp', {
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
   * Verify OTP and complete farmer authentication
   */
  verifyFarmerOtp: async ({ phone, otp, name, preferredLanguage, registeredVia, passcode, mode }) => {
    const res = await apiClient.post('/auth/farmer/verify-otp', {
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
   * Step 1: Staff Role & Credential Match
   */
  verifyStaffCredentials: async ({ mobileNumber, phone, password, role }) => {
    const res = await apiClient.post('/auth/staff/verify-credentials', {
      mobileNumber: mobileNumber || phone,
      phone: phone || mobileNumber,
      password,
      role,
    });
    return res.data;
  },

  /**
   * Step 2: Clean OTP Verification
   */
  verifyStaffOtp: async ({ challengeToken, otp }) => {
    const res = await apiClient.post('/auth/staff/verify-otp', {
      challengeToken,
      otp,
    });
    return res.data;
  },

  /**
   * Dynamic Mandi Center Switching (PATCH /api/auth/staff/switch-centre)
   */
  switchStaffCenter: async ({ targetMandiId, targetMandiName }) => {
    const res = await apiClient.patch('/auth/staff/switch-centre', {
      targetMandiId,
      targetMandiName,
    });
    return res.data;
  },

  /**
   * Legacy Staff login with name/phone and password
   */
  staffLogin: async ({ name, phone, password }) => {
    const res = await apiClient.post('/auth/staff/login', {
      name,
      phone,
      password,
    });
    return res.data;
  },

  /**
   * Staff registration (internal onboarding)
   */
  staffRegister: async ({ name, role, centreId, password, officerCode, deskName, terminalLane, assignedMandi }) => {
    const res = await apiClient.post('/auth/staff/register', {
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
   * Fetch current authenticated user profile
   */
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  /**
   * Save or update farmer pickup location pin
   */
  updatePickupLocation: async ({ latitude, longitude, address, phone }) => {
    const res = await apiClient.patch('/farmers/pickup-location', {
      latitude,
      longitude,
      address,
      phone
    });
    return res.data;
  },
};


