import api from './api';

export const authAPI = {
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    return res.data;
  },

  getProfile: async () => {
    const res = await api.get('/api/users/me');
    return res.data;
  },
};
