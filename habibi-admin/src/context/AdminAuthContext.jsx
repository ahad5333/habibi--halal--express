import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export function AdminAuthProvider({ children }) {
  // Restore from cache instantly so the panel shows on hard reload without a flash
  const cached = (() => {
    try { return JSON.parse(localStorage.getItem('habibi_admin_user') || 'null'); } catch { return null; }
  })();

  const [admin, setAdmin]         = useState(cached?.role === 'admin' ? cached : null);
  const [mfaEmail, setMfaEmail]   = useState(null);
  const [mfaSentTo, setMfaSentTo] = useState(null);
  // If we have a cached user, don't block the UI — validate silently in background
  const [loading, setLoading]     = useState(!cached || cached?.role !== 'admin');

  useEffect(() => {
    // Always re-validate with the server (cookie-based) to confirm session is still live
    authAPI.me()
      .then(userData => {
        if (userData.role !== 'admin') {
          // Server says this user is not an admin — clear everything
          localStorage.removeItem('habibi_admin_user');
          setAdmin(null);
        } else {
          setAdmin(userData);
          localStorage.setItem('habibi_admin_user', JSON.stringify(userData));
        }
      })
      .catch(err => {
        // Only force logout on explicit auth rejection (401/403)
        // Network errors or server errors (5xx) should not boot the user out
        const status = err?.status || (err?.message?.match(/^(\d{3})$/) ? parseInt(err.message) : null);
        if (status === 401 || status === 403) {
          localStorage.removeItem('habibi_admin_user');
          setAdmin(null);
        }
        // On 5xx / network error: keep the cached session, user stays logged in
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    if (data.mfa_required) {
      setMfaEmail(data.email);
      setMfaSentTo(data.sent_to || data.email);
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
    setMfaSentTo(null);
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
    <Ctx.Provider value={{ admin, loading, login, verifyMfa, logout, isAdmin: !!admin, mfaRequired: !!mfaEmail, mfaSentTo }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}
