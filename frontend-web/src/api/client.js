import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Centralized Axios instance configured for KisanQ API
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * Automatically injects the stored JWT Bearer token if available
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kq_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor
 * Formats API errors and handles authentication expiration smoothly
 */
apiClient.interceptors.response.use(
  (response) => {
    // Return standard response
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Server error occurred';

      if (status === 401) {
        console.warn(`[API 401 Unauthorized]: ${message}`);
        // Do not perform hard page reload; contexts and route guards will handle redirection
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

export default apiClient;
export { BASE_URL };
