import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Only persist non-sensitive display fields — never store roles, email, or loyalty balance in localStorage
  const safePersist = (userData) => {
    if (!userData) { localStorage.removeItem('habibi_user'); return; }
    const safe = { id: userData.id, name: userData.name, avatar_url: userData.avatar_url || null };
    localStorage.setItem('habibi_user', JSON.stringify(safe));
  };

  useEffect(() => {
    // Validate session via httpOnly cookie — source of truth is always the server
    authAPI.me()
      .then(userData => {
        setUser(userData);
        safePersist(userData);
      })
      .catch((err) => {
        // Only wipe cached data on explicit auth rejection, not server/network errors
        const status = err?.status;
        if (!status || status === 401 || status === 403) {
          localStorage.removeItem('habibi_user');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    if (data.user) {
      setUser(data.user);
      safePersist(data.user);
    }
    return data;
  };

  const register = async (name, email, password, extra = {}) => {
    const data = await authAPI.register(name, email, password, extra);
    if (data?.user) {
      setUser(data.user);
      safePersist(data.user);
    }
    return data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch (_) { /* server unreachable — proceed with local cleanup */ }
    localStorage.removeItem('habibi_user');
    setUser(null);
  };

  // Called after profile update so the navbar/header stays in sync
  const refreshUser = (updatedFields) => {
    setUser(prev => {
      const next = { ...prev, ...updatedFields };
      safePersist(next);
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
