import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('kq_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('kq_token') || null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await authApi.getMe();
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('kq_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn('[AuthContext] Session validation failed or offline fallback', err.message);
          // Retain stored user
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [token]);

  /**
   * Request OTP for Farmer
   */
  const farmerOtpRequest = useCallback(async ({ phone, name, preferredLanguage, registeredVia = 'app', passcode, mode }) => {
    const res = await authApi.requestFarmerOtp({ phone, name, preferredLanguage, registeredVia, passcode, mode });
    return res;
  }, []);

  /**
   * Verify Farmer OTP and persist token
   */
  const farmerOtpVerify = useCallback(async ({ phone, otp, name, preferredLanguage, registeredVia = 'app', passcode, mode }) => {
    const res = await authApi.verifyFarmerOtp({ phone, otp, name, preferredLanguage, registeredVia, passcode, mode });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setToken(authToken);
      setUser(authUser);

      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_farmer_profile', JSON.stringify(authUser));
    }
    return res;
  }, []);

  /**
   * Step 1: Staff Verify Credentials & Issue 2FA Challenge
   */
  const staffVerifyCredentials = useCallback(async ({ mobileNumber, phone, password, role }) => {
    const res = await authApi.verifyStaffCredentials({ mobileNumber, phone, password, role });
    return res;
  }, []);

  /**
   * Step 2: Staff Verify OTP & Establish Authenticated Session
   */
  const staffVerifyOtp = useCallback(async ({ challengeToken, otp }) => {
    const res = await authApi.verifyStaffOtp({ challengeToken, otp });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setToken(authToken);
      setUser(authUser);

      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_staff_session', JSON.stringify(authUser));
      if (authUser.assignedMandi) {
        localStorage.setItem('kisanq_active_mandi_id', authUser.assignedMandi);
      }
    }
    return res;
  }, []);

  /**
   * Switch Active Mandi Center
   */
  const switchCenter = useCallback(async ({ targetMandiId, targetMandiName }) => {
    const res = await authApi.switchStaffCenter({ targetMandiId, targetMandiName });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setToken(authToken);
      setUser(authUser);

      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_staff_session', JSON.stringify(authUser));
      localStorage.setItem('kisanq_active_mandi_id', targetMandiId);
    }
    return res;
  }, []);

  /**
   * Legacy Staff login with name and password
   */
  const staffLogin = useCallback(async ({ name, phone, password }) => {
    const res = await authApi.staffLogin({ name, phone, password });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setToken(authToken);
      setUser(authUser);

      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_staff_session', JSON.stringify(authUser));
      if (authUser.assignedMandi) {
        localStorage.setItem('kisanq_active_mandi_id', authUser.assignedMandi);
      }
    }
    return res;
  }, []);

  /**
   * Universal login wrapper
   */
  const login = useCallback(async (credentials) => {
    if (credentials.phone && credentials.otp) {
      return await farmerOtpVerify(credentials);
    }
    return await staffLogin(credentials);
  }, [farmerOtpVerify, staffLogin]);

  /**
   * Save / Update Farmer Pickup Location
   */
  const updateFarmerPickupLocation = useCallback(async ({ latitude, longitude, address, phone }) => {
    const res = await authApi.updatePickupLocation({ latitude, longitude, address, phone });
    if (res?.data?.pickupLocation) {
      const updatedUser = {
        ...(user || {}),
        pickupLocation: res.data.pickupLocation
      };
      setUser(updatedUser);
      localStorage.setItem('kq_user', JSON.stringify(updatedUser));
      localStorage.setItem('kisanq_farmer_profile', JSON.stringify(updatedUser));
    }
    return res;
  }, [user]);

  /**
   * Clear active Farmer session before starting new login / registration flow
   */
  const clearFarmerSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
    localStorage.removeItem('kisanq_token');
    localStorage.removeItem('kisanq_user');
    localStorage.removeItem('kisanq_farmer_profile');
    localStorage.removeItem('kisanq_staff_session');
    localStorage.removeItem('kisanq_active_mandi_id');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  /**
   * Logout user and completely purge authentication tokens
   */
  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
    localStorage.removeItem('kisanq_token');
    localStorage.removeItem('kisanq_user');
    localStorage.removeItem('kisanq_farmer_profile');
    localStorage.removeItem('kisanq_staff_session');
    localStorage.removeItem('kisanq_active_mandi_id');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    isLoading,
    farmerOtpRequest,
    farmerOtpVerify,
    updateFarmerPickupLocation,
    clearFarmerSession,
    staffVerifyCredentials,
    staffVerifyOtp,
    switchCenter,
    staffLogin,
    login,
    logout,
  };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

