import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const url = new URL(window.location.href);
      const impersonationToken = url.searchParams.get('impersonationToken');

      if (impersonationToken) {
        sessionStorage.setItem('token', impersonationToken);
        url.searchParams.delete('impersonationToken');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }

      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          if (data.success) {
            setUser(data.user);
          } else {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
          }
        } catch {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (data.success) {
      // Normal sign-ins should use shared persistent auth.
      sessionStorage.removeItem('token');
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { success: true };
    }
    return { success: false, message: data.message };
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
