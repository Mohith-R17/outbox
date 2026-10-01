import api from './api';
import type { User } from '../types';

export const authService = {
  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
  getGoogleLoginUrl: (): string => {
    return `${api.defaults.baseURL}/auth/google`;
  }
};
