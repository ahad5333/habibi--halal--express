import request from './api';

export const authAPI = {
  login: (identifier: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: identifier, password }),
    }),
};
