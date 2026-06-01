import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('habibi_user');
    const token  = localStorage.getItem('habibi_token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch (_) {}
    } else {
      // Clear stale user data if the token is gone
      localStorage.removeItem('habibi_user');
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    authAPI.saveToken(data.token);
    const userData = data.user || { email };
    localStorage.setItem('habibi_user', JSON.stringify(userData));
    setUser(userData);
    return data;
  };

  const register = async (name, email, password, extra = {}) => {
    const data = await authAPI.register(name, email, password, extra);
    // Never auto-login after registration — user must log in explicitly
    return data;
  };

  const logout = () => {
    authAPI.logout();
    localStorage.removeItem('habibi_user');
    setUser(null);
  };

  // Called after profile update so the navbar/header stays in sync
  const refreshUser = (updatedFields) => {
    setUser(prev => {
      const next = { ...prev, ...updatedFields };
      localStorage.setItem('habibi_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, isLoggedIn: !!user, isPartner: !!user?.is_partner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
