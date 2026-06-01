import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'merchant_token';
const USER_KEY  = 'merchant_user';

// expo-secure-store has no web implementation — fall back to localStorage
const isWeb = Platform.OS === 'web';

const webGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const webSet = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch {}
};
const webDel = (key: string): void => {
  try { localStorage.removeItem(key); } catch {}
};

export const Storage = {
  async getToken(): Promise<string | null> {
    if (isWeb) return webGet(TOKEN_KEY);
    try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
  },

  async setToken(token: string): Promise<void> {
    if (isWeb) { webSet(TOKEN_KEY, token); return; }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getUser(): Promise<any | null> {
    if (isWeb) {
      const raw = webGet(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async setUser(user: any): Promise<void> {
    if (isWeb) { webSet(USER_KEY, JSON.stringify(user)); return; }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clearAll(): Promise<void> {
    if (isWeb) { webDel(TOKEN_KEY); webDel(USER_KEY); return; }
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  },
};
