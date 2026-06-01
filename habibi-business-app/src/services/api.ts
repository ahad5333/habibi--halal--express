import { Storage } from '../utils/storage';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001';

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await Storage.getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data as T;
}

export default request;
