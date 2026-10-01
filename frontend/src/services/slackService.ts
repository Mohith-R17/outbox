import api from './api';
import type { SlackStatus } from '../types';

export const slackService = {
  getStatus: async (): Promise<SlackStatus> => {
    const response = await api.get('/slack/status');
    return response.data;
  },
  disconnect: async (): Promise<void> => {
    await api.post('/slack/disconnect');
  },
  getConnectUrl: (): string => {
    return `${api.defaults.baseURL}/slack/connect`;
  }
};
