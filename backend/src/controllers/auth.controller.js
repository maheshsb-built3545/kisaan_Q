const mongoose = require('mongoose');
const { Farmer } = require('../models');
const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const authController = {

  /**
   * Request OTP for Farmer
   */
  requestFarmerOtp: async (req, res) => {
    try {
      const { phone, name, preferredLanguage, registeredVia, passcode, password, mode } = req.body;
      const result = await authService.requestFarmerOtp({
        phone,
        name,
        preferredLanguage,
        registeredVia,
        passcode: passcode || password,
        mode: mode || 'login'
      });
      return successResponse(res, result, 'OTP sent successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Verify Farmer OTP and login/register
   */
  verifyFarmerOtp: async (req, res) => {
    try {
      const { phone, otp, name, preferredLanguage, registeredVia, passcode, password, mode } = req.body;
      const result = await authService.verifyFarmerOtp({
        phone,
        otp,
        name,
        preferredLanguage,
        registeredVia,
        passcode: passcode || password,
        mode
      });
      return successResponse(res, result, 'Farmer authenticated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Step 1: Staff Role & Credential Match (POST /api/auth/staff/verify-credentials)
   */
  verifyStaffCredentials: async (req, res) => {
    try {
      const { mobileNumber, phone, password, role } = req.body;
      const result = await authService.verifyStaffCredentials({ mobileNumber, phone, password, role });
      return successResponse(res, result, 'Staff credentials verified; 2FA challenge issued');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 401);
    }
  },

  /**
   * Step 2: Clean OTP Verification (POST /api/auth/staff/verify-otp)
   */
  verifyStaffOtp: async (req, res) => {
    try {
      const { challengeToken, otp } = req.body;
      const result = await authService.verifyStaffOtp({ challengeToken, otp });
      return successResponse(res, result, 'Staff authenticated successfully with locked role');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 401);
    }
  },

  /**
   * Dynamic Mandi Center Switching (PATCH /api/auth/staff/switch-centre)
   */
  switchStaffCenter: async (req, res) => {
    try {
      const { targetMandiId, mandiId, targetMandiName, mandiName } = req.body;
      const staffId = req.user?.id || req.user?.staffId;
      if (!staffId) {
        return errorResponse(res, 'Authentication required to switch duty centers.', 401);
      }
      const result = await authService.switchStaffCenter({
        staffId,
        targetMandiId: targetMandiId || mandiId,
        targetMandiName: targetMandiName || mandiName
      });
      return successResponse(res, result, 'Duty station center updated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Legacy Staff login via password
   */
  staffLogin: async (req, res) => {
    try {
      const { name, phone, password } = req.body;
      const result = await authService.staffLogin({ name, phone, password });
      return successResponse(res, result, 'Staff authenticated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 401);
    }
  },

  /**
   * Staff register / onboarding
   */
  staffRegister: async (req, res) => {
    try {
      const { name, phone, role, centreId, password, officerCode, deskName, terminalLane, assignedMandi } = req.body;
      const result = await authService.staffRegister({
        name,
        phone,
        role,
        centreId,
        password,
        officerCode,
        deskName,
        terminalLane,
        assignedMandi
      });
      return successResponse(res, result, 'Staff user registered successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  },

  /**
   * Trigger Seed of official staff registry
   */
  seedStaff: async (req, res) => {
    try {
      await authService.seedStaffRegistry();
      return successResponse(res, { seeded: true }, 'Staff registry seeded successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get current authenticated user profile
   */
  getMe: async (req, res) => {
    try {
      if (req.user?.role === 'farmer' || req.user?.phone) {
        const rawPhone = (req.user.phone || '').toString().trim().replace(/\D/g, '');
        let farmer = null;
        if (mongoose.connection.readyState === 1 && rawPhone) {
          farmer = await Farmer.findOne({ phone: rawPhone });
        }
        if (!farmer && authService.inMemoryFarmers && authService.inMemoryFarmers.has(rawPhone)) {
          farmer = authService.inMemoryFarmers.get(rawPhone);
        }

        if (farmer) {
          return successResponse(res, {
            user: {
              ...req.user,
              id: farmer._id || req.user.id,
              name: farmer.name || req.user.name,
              phone: farmer.phone || req.user.phone,
              preferredLanguage: farmer.preferredLanguage || req.user.preferredLanguage,
              pickupLocation: farmer.pickupLocation || null,
              village: farmer.village,
              district: farmer.district,
              state: farmer.state,
              landArea: farmer.landArea,
              crop: farmer.crop,
              pendingDues: farmer.pendingDues || 0
            }
          }, 'Current user profile fetched');
        }
      }

      return successResponse(res, { user: req.user }, 'Current user profile fetched');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = authController;


