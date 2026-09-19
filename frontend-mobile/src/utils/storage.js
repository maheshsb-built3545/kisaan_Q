import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEYS = {
  JWT_TOKEN: 'kisanq_farmer_jwt',
  USER_PASSCODE: 'kisanq_farmer_passcode',
  FARMER_PHONE: 'kisanq_farmer_phone'
};

const ASYNC_KEYS = {
  USER_PROFILE: 'kisanq_user_profile',
  ACTIVE_TOKEN: 'kisanq_cached_active_token',
  ALL_TOKENS: 'kisanq_cached_all_tokens',
  QR_PAYLOAD: 'kisanq_cached_qr_payload',
  CENTRES: 'kisanq_cached_centres',
  LAST_QUEUE: 'kisanq_cached_last_queue_position',
  CROP_PRICES: 'kisanq_cached_crop_prices'
};

export const Storage = {
  // Secure Store (Encrypted)
  async getAuthToken() {
    try {
      return await SecureStore.getItemAsync(SECURE_KEYS.JWT_TOKEN);
    } catch {
      return null;
    }
  },

  async setAuthToken(token) {
    try {
      if (token) {
        await SecureStore.setItemAsync(SECURE_KEYS.JWT_TOKEN, token);
      } else {
        await SecureStore.deleteItemAsync(SECURE_KEYS.JWT_TOKEN);
      }
    } catch (e) {
      console.warn('[Storage] SecureStore write error:', e);
    }
  },

  async clearAuth() {
    try {
      await SecureStore.deleteItemAsync(SECURE_KEYS.JWT_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_KEYS.USER_PASSCODE);
      await AsyncStorage.removeItem(ASYNC_KEYS.USER_PROFILE);
    } catch (e) {
      console.warn('[Storage] Clear auth error:', e);
    }
  },

  // AsyncStorage (General / Offline Cache)
  async getJson(key) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setJson(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] AsyncStorage set error for ${key}:`, e);
    }
  },

  ASYNC_KEYS,
  SECURE_KEYS
};
