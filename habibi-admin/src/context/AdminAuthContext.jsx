import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('habibi_admin_user');
    if (stored) {
      try { setAdmin(JSON.parse(stored)); } catch (_) {}
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

  const logout = () => {
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
