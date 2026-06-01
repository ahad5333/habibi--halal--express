import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'hb_biz_token';
const USER_KEY  = 'hb_biz_user';

// SecureStore is not available on web — fall back to AsyncStorage
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
async function secureDel(key: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

export const Storage = {
  getToken:  () => secureGet(TOKEN_KEY),
  setToken:  (t: string) => secureSet(TOKEN_KEY, t),
  getUser:   async () => {
    const raw = await secureGet(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  setUser:   (u: object) => secureSet(USER_KEY, JSON.stringify(u)),
  clearAll:  async () => { await secureDel(TOKEN_KEY); await secureDel(USER_KEY); },
};
