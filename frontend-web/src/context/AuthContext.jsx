import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api';
import { demoApi } from '../api/demo.api';
import { destroySocket } from '../services/socketService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Farmer Session State
  const [farmerUser, setFarmerUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kisanq_farmer_user') || localStorage.getItem('kisanq_farmer_profile');
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem('kq_user');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.role === 'farmer' || !parsed.role) return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [farmerToken, setFarmerToken] = useState(() => {
    return localStorage.getItem('kisanq_farmer_token') ||
      (localStorage.getItem('kq_user') && JSON.parse(localStorage.getItem('kq_user') || '{}').role === 'farmer' ? localStorage.getItem('kq_token') : null);
  });

  // Staff Session State
  const [staffUser, setStaffUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kisanq_staff_user') || localStorage.getItem('kisanq_staff_session');
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem('kq_user');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.role && parsed.role !== 'farmer') return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [staffToken, setStaffToken] = useState(() => {
    return localStorage.getItem('kisanq_staff_token') ||
      (localStorage.getItem('kq_user') && JSON.parse(localStorage.getItem('kq_user') || '{}').role !== 'farmer' ? localStorage.getItem('kq_token') : null);
  });

  const [isLoading, setIsLoading] = useState(true);

  // Determine current active user/token context based on pathname or active presence
  const isStaffRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/staff') ||
    window.location.pathname.startsWith('/admin') ||
    window.location.pathname.startsWith('/supervisor') ||
    window.location.pathname.startsWith('/guard') ||
    window.location.pathname.startsWith('/weighmaster') ||
    window.location.pathname.startsWith('/planning')
  );

  const activeUser = isStaffRoute ? (staffUser || farmerUser) : (farmerUser || staffUser);
  const activeToken = isStaffRoute ? (staffToken || farmerToken) : (farmerToken || staffToken);

  // Validate active session on mount
  useEffect(() => {
    const initAuth = async () => {
      if (staffToken) {
        try {
          const res = await authApi.getMe();
          if (res.data?.user && res.data.user.role !== 'farmer') {
            setStaffUser(res.data.user);
            localStorage.setItem('kisanq_staff_user', JSON.stringify(res.data.user));
            localStorage.setItem('kisanq_staff_session', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn('[AuthContext] Staff session validation fallback:', err.message);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [staffToken]);

  /**
   * Request OTP for Farmer
   */
  const farmerOtpRequest = useCallback(async ({ phone, name, preferredLanguage, registeredVia = 'app', passcode, mode }) => {
    const res = await authApi.requestFarmerOtp({ phone, name, preferredLanguage, registeredVia, passcode, mode });
    return res;
  }, []);

  /**
   * Verify Farmer OTP and persist isolated farmer token
   */
  const farmerOtpVerify = useCallback(async ({ phone, otp, name, preferredLanguage, registeredVia = 'app', passcode, mode }) => {
    const res = await authApi.verifyFarmerOtp({ phone, otp, name, preferredLanguage, registeredVia, passcode, mode });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setFarmerToken(authToken);
      setFarmerUser(authUser);

      localStorage.setItem('kisanq_farmer_token', authToken);
      localStorage.setItem('kisanq_farmer_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_farmer_profile', JSON.stringify(authUser));
      // Retain fallback key for non-isolated legacy readers
      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
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
   * Step 2: Staff Verify OTP & Establish Authenticated Staff Session
   */
  const staffVerifyOtp = useCallback(async ({ challengeToken, otp }) => {
    const res = await authApi.verifyStaffOtp({ challengeToken, otp });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setStaffToken(authToken);
      setStaffUser(authUser);

      localStorage.setItem('kisanq_staff_token', authToken);
      localStorage.setItem('kisanq_staff_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_staff_session', JSON.stringify(authUser));
      if (authUser.assignedMandi) {
        localStorage.setItem('kisanq_active_mandi_id', authUser.assignedMandi);
      }
    }
    return res;
  }, []);

  /**
   * Switch Active Mandi Center for Staff
   */
  const switchCenter = useCallback(async ({ targetMandiId, targetMandiName }) => {
    const res = await authApi.switchStaffCenter({ targetMandiId, targetMandiName });
    if (res.data?.token && res.data?.user) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setStaffToken(authToken);
      setStaffUser(authUser);

      localStorage.setItem('kisanq_staff_token', authToken);
      localStorage.setItem('kisanq_staff_user', JSON.stringify(authUser));
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

      setStaffToken(authToken);
      setStaffUser(authUser);

      localStorage.setItem('kisanq_staff_token', authToken);
      localStorage.setItem('kisanq_staff_user', JSON.stringify(authUser));
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
   * Demo: one-click farmer login via showcase endpoint.
   * Uses the same localStorage keys as normal farmer auth so all routes work.
   */
  const demoFarmerLogin = useCallback(async (profile = 'ramesh_kadam') => {
    const res = await demoApi.demoFarmerLogin(profile);
    if (res?.data?.token && res?.data?.user) {
      const authToken = res.data.token;
      const authUser = {
        ...res.data.user,
        preferredLanguage: 'en',
        demo: true
      };
      setFarmerToken(authToken);
      setFarmerUser(authUser);
      localStorage.setItem('kisanq_lang', 'en');
      localStorage.setItem('kisanq_farmer_token', authToken);
      localStorage.setItem('kisanq_farmer_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_farmer_profile', JSON.stringify(authUser));
      localStorage.setItem('kq_token', authToken);
      localStorage.setItem('kq_user', JSON.stringify(authUser));
    }
    return res;
  }, []);

  /**
   * Demo: one-click staff login via showcase endpoint.
   * Uses the same localStorage keys as normal staff auth so all routes work.
   */
  const demoStaffLogin = useCallback(async (role) => {
    const res = await demoApi.demoStaffLogin(role);
    if (res?.data?.token && res?.data?.user) {
      const authToken = res.data.token;
      const authUser = {
        ...res.data.user,
        preferredLanguage: 'en',
        demo: true
      };
      setStaffToken(authToken);
      setStaffUser(authUser);
      localStorage.setItem('kisanq_lang', 'en');
      localStorage.setItem('kisanq_staff_token', authToken);
      localStorage.setItem('kisanq_staff_user', JSON.stringify(authUser));
      localStorage.setItem('kisanq_staff_session', JSON.stringify(authUser));
      localStorage.setItem('kisanq_active_mandi_id', authUser.assignedMandi || 'KPG-01');
    }
    return res;
  }, []);

  /**
   * Save / Update Farmer Pickup Location
   */
  const updateFarmerPickupLocation = useCallback(async ({ latitude, longitude, address, phone }) => {
    const res = await authApi.updatePickupLocation({ latitude, longitude, address, phone });
    if (res?.data?.pickupLocation) {
      const updatedUser = {
        ...(farmerUser || {}),
        pickupLocation: res.data.pickupLocation
      };
      setFarmerUser(updatedUser);
      localStorage.setItem('kisanq_farmer_user', JSON.stringify(updatedUser));
      localStorage.setItem('kisanq_farmer_profile', JSON.stringify(updatedUser));
    }
    return res;
  }, [farmerUser]);

  /**
   * Clear active Farmer session before starting new login / registration flow
   */
  const clearFarmerSession = useCallback(() => {
    setFarmerToken(null);
    setFarmerUser(null);
    localStorage.removeItem('kisanq_farmer_token');
    localStorage.removeItem('kisanq_farmer_user');
    localStorage.removeItem('kisanq_farmer_profile');
  }, []);

  /**
   * Logout Farmer specifically (Preserves staff session!)
   */
  const logoutFarmer = useCallback(() => {
    destroySocket('farmer');
    setFarmerToken(null);
    setFarmerUser(null);
    localStorage.removeItem('kisanq_farmer_token');
    localStorage.removeItem('kisanq_farmer_user');
    localStorage.removeItem('kisanq_farmer_profile');
    if (!staffToken) {
      localStorage.removeItem('kq_token');
      localStorage.removeItem('kq_user');
    }
  }, [staffToken]);

  /**
   * Logout Staff specifically (Preserves farmer session!)
   */
  const logoutStaff = useCallback(() => {
    destroySocket('staff');
    setStaffToken(null);
    setStaffUser(null);
    localStorage.removeItem('kisanq_staff_token');
    localStorage.removeItem('kisanq_staff_user');
    localStorage.removeItem('kisanq_staff_session');
    localStorage.removeItem('kisanq_active_mandi_id');
    if (!farmerToken) {
      localStorage.removeItem('kq_token');
      localStorage.removeItem('kq_user');
    }
  }, [farmerToken]);

  /**
   * Context-Aware Logout: Logs out only the relevant area
   */
  const logout = useCallback(async (area) => {
    if (area === 'farmer') {
      logoutFarmer();
      return;
    }
    if (area === 'staff') {
      logoutStaff();
      return;
    }

    // Auto-detect area based on current URL
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isStaff = currentPath.startsWith('/staff') ||
      currentPath.startsWith('/admin') ||
      currentPath.startsWith('/supervisor') ||
      currentPath.startsWith('/guard') ||
      currentPath.startsWith('/weighmaster') ||
      currentPath.startsWith('/planning');

    if (isStaff) {
      logoutStaff();
    } else {
      logoutFarmer();
    }
  }, [logoutFarmer, logoutStaff]);

  const value = {
    // Current Active (Context-Sensitive)
    user: activeUser,
    token: activeToken,
    role: activeUser?.role || null,
    isAuthenticated: Boolean(activeToken && activeUser),
    isLoading,

    // Explicit Isolated Sessions
    farmerUser,
    farmerToken,
    isAuthenticatedFarmer: Boolean(farmerToken && farmerUser),
    isDemoFarmer: Boolean(farmerUser?.demo),

    staffUser,
    staffToken,
    isAuthenticatedStaff: Boolean(staffToken && staffUser),
    isDemoStaff: Boolean(staffUser?.demo),

    // Auth actions
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
    logoutFarmer,
    logoutStaff,
    demoFarmerLogin,
    demoStaffLogin,
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
