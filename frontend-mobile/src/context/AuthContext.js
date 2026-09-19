import React, { createContext, useState, useEffect, useContext } from 'react';
import { Storage } from '../utils/storage';
import { connectSocket, disconnectSocket } from '../api/socket';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await Storage.getAuthToken();
        const savedUser = await Storage.getJson(Storage.ASYNC_KEYS.USER_PROFILE);

        if (savedToken) {
          setToken(savedToken);
          setUser(savedUser);
          connectSocket();
        }
      } catch (error) {
        console.warn('[AuthContext] Session restore failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (jwtToken, userProfile) => {
    try {
      await Storage.setAuthToken(jwtToken);
      if (userProfile) {
        await Storage.setJson(Storage.ASYNC_KEYS.USER_PROFILE, userProfile);
      }
      setToken(jwtToken);
      setUser(userProfile);
      connectSocket();
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await Storage.clearAuth();
      disconnectSocket();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }
  };

  const updateProfile = async (updatedData) => {
    try {
      const merged = { ...user, ...updatedData };
      await Storage.setJson(Storage.ASYNC_KEYS.USER_PROFILE, merged);
      setUser(merged);
    } catch (error) {
      console.warn('[AuthContext] Profile update error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        isAuthenticated: Boolean(token),
        login,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
