import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const isLoginRequest = config.url && config.url.endsWith('/auth/login');
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  
  if (token && !isLoginRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('Server error data:', error.response.data);
      if (error.response.status === 401) {
        // Clear tokens on any 401 (except login)
        if (!error.config.url.endsWith('/auth/login')) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
