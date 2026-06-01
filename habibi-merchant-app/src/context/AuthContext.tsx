import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/authAPI';
import { Storage } from '../utils/storage';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await Storage.getUser();
        const token  = await Storage.getToken();
        if (stored && token) setUser(stored);
      } catch (_) {
        // SecureStore unavailable in some emulator environments
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password);
    if (!data.token) throw new Error('Login failed — no token returned.');
    const u = data.user || { email };
    // Only allow admin or merchant roles
    if (u.role !== 'admin' && u.role !== 'merchant') {
      throw new Error('Access denied. Merchant accounts only.');
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
