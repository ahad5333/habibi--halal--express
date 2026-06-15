import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin]         = useState(null);
  const [mfaEmail, setMfaEmail]   = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    // Validate session via httpOnly cookie — no localStorage token needed
    authAPI.me()
      .then(userData => {
        if (userData.role !== 'admin') {
          localStorage.removeItem('habibi_admin_user');
          setLoading(false);
          return;
        }
        setAdmin(userData);
        localStorage.setItem('habibi_admin_user', JSON.stringify(userData));
      })
      .catch(() => {
        localStorage.removeItem('habibi_admin_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    if (data.mfa_required) {
      setMfaEmail(data.email);
      return data;
    }
    if (data.user?.role !== 'admin') throw new Error('Access denied — admin accounts only.');
    // Token is in httpOnly cookie — just cache user data
    localStorage.setItem('habibi_admin_user', JSON.stringify(data.user));
    setAdmin(data.user);
    return data;
  };

  const verifyMfa = async (otp) => {
    if (!mfaEmail) throw new Error('No MFA session. Please log in again.');
    const data = await authAPI.verifyAdminMfa(mfaEmail, otp);
    if (data.user?.role !== 'admin') throw new Error('Access denied.');
    localStorage.setItem('habibi_admin_user', JSON.stringify(data.user));
    setAdmin(data.user);
    setMfaEmail(null);
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
    <Ctx.Provider value={{ admin, loading, login, verifyMfa, logout, isAdmin: !!admin, mfaRequired: !!mfaEmail }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}
