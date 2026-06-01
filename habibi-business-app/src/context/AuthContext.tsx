import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/authAPI';
import { Storage } from '../utils/storage';

export interface BusinessUser {
  id: number;
  name: string;
  email: string;
  role: string;
  business_name?: string;
  partner_id?: number;
  loyalty_points?: number;
}

interface AuthContextType {
  user: BusinessUser | null;
  loading: boolean;
  login:  (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<BusinessUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await Storage.getUser();
        const token  = await Storage.getToken();
        if (stored && token) setUser(stored as BusinessUser);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const login = async (identifier: string, password: string) => {
    const data = await authAPI.login(identifier, password);
    if (!data.token) throw new Error('Login failed — no token returned.');
    const u: BusinessUser = data.user ?? { email: identifier };
    // Restrict to business / partner roles only
    if (!['business', 'admin', 'customer'].includes(u.role)) {
      throw new Error('Access denied. Business accounts only.');
    }
    await Storage.setToken(data.token);
    await Storage.setUser(u);
    setUser(u);
  };

  const logout = async () => {
    await Storage.clearAll();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
