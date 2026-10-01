import api from './api';
import type { Email, ScheduledEmailRequest } from '../types';

export const emailService = {
  getScheduledEmails: async (): Promise<Email[]> => {
    const response = await api.get('/emails/scheduled');
    return response.data;
  },
  getSentEmails: async (): Promise<Email[]> => {
    const response = await api.get('/emails/sent');
    return response.data;
  },
  scheduleEmail: async (data: ScheduledEmailRequest): Promise<Email> => {
    const response = await api.post('/emails/schedule', data);
    return response.data;
  },
  searchEmails: async (query: string): Promise<Email[]> => {
    const response = await api.get(`/emails/search?q=${encodeURIComponent(query)}`);
    return response.data.data || [];
  },
};
