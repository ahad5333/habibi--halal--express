import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session via httpOnly cookie — avoids reading JWT from localStorage
    authAPI.me()
      .then(userData => {
        setUser(userData);
        localStorage.setItem('habibi_user', JSON.stringify(userData));
      })
      .catch(() => {
        localStorage.removeItem('habibi_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    // Token lives in httpOnly cookie set by the server — do NOT store in localStorage
    if (data.user) {
      localStorage.setItem('habibi_user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  };

  const register = async (name, email, password, extra = {}) => {
    const data = await authAPI.register(name, email, password, extra);
    // Never auto-login after registration — user must log in explicitly
    return data;
  };

  const logout = () => {
    authAPI.logout(); // calls POST /api/auth/logout → revokes JTI + clears cookie
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
