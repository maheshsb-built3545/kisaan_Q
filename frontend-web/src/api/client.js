import axios from 'axios';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';

/**
 * FARMER Axios instance — reads ONLY kisanq_farmer_token.
 * No fallback to staff token.
 * Use for all farmer-area API calls.
 */
const farmerClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

farmerClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kisanq_farmer_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * STAFF Axios instance — reads ONLY kisanq_staff_token.
 * No fallback to farmer token.
 * Use for all staff/officer/supervisor/admin API calls.
 */
const staffClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

staffClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kisanq_staff_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Shared response interceptor factory — formats errors consistently
 */
function attachResponseInterceptor(instance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Server error occurred';
        if (status === 401) {
          console.warn(`[API 401 Unauthorized]: ${message}`);
        } else if (status === 403) {
          console.warn(`[API 403 Forbidden]: ${message}`);
        } else if (status >= 500) {
          console.error(`[API 500 Internal Error]: ${message}`);
        }
      } else if (error.request) {
        console.error('[API Network Error]: No response received from server');
      }
      return Promise.reject(error);
    }
  );
}

attachResponseInterceptor(farmerClient);
attachResponseInterceptor(staffClient);

// Legacy default export — NOT used by any new module.
// Kept only so any module that has not been migrated still compiles.
// It reads farmer token with NO staff fallback.
const apiClient = farmerClient;

export default apiClient;
export { farmerClient, staffClient, BASE_URL };
