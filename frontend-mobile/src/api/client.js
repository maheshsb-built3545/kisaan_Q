import axios from 'axios';
import { Storage } from '../utils/storage';
import { API_BASE_URL } from '../utils/constants';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT from SecureStore
client.interceptors.request.use(
  async (config) => {
    try {
      const token = await Storage.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[API Client] Error attaching authorization token:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 session expiry and network offline errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('[API Client] 401 Unauthorized - clearing secure session');
      await Storage.clearAuth();
    }
    return Promise.reject(error);
  }
);

export default client;
