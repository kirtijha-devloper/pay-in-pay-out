import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://abheepayqr02.vercel.app/api' : 'http://localhost:5000/api'),
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
