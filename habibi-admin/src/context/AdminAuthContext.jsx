import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('habibi_admin_token');
    const storedUser  = localStorage.getItem('habibi_admin_user');

    if (storedToken) {
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token has expired — clear everything and force re-login
          localStorage.removeItem('habibi_admin_token');
          localStorage.removeItem('habibi_admin_user');
          setLoading(false);
          return;
        }
      } catch (_) {
        localStorage.removeItem('habibi_admin_token');
        localStorage.removeItem('habibi_admin_user');
        setLoading(false);
        return;
      }
    }

    if (storedUser) {
      try { setAdmin(JSON.parse(storedUser)); } catch (_) {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    if (data.user?.role !== 'admin') throw new Error('Access denied — admin accounts only.');
    authAPI.save(data.token);
    localStorage.setItem('habibi_admin_user', JSON.stringify(data.user));
    setAdmin(data.user);
    return data;
  };

  const logout = async () => {
    // Tell the server to revoke this token so it can't be reused
    try { await authAPI.logout(); } catch (_) {}
    authAPI.clear();
    localStorage.removeItem('habibi_admin_user');
    setAdmin(null);
  };

  return (
    <Ctx.Provider value={{ admin, loading, login, logout, isAdmin: !!admin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}
