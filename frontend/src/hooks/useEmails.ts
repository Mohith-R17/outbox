import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/emailService';
import type { ScheduledEmailRequest } from '../types';
import toast from 'react-hot-toast';

export const useScheduledEmails = () => {
  return useQuery({
    queryKey: ['emails', 'scheduled'],
    queryFn: emailService.getScheduledEmails,
  });
};

export const useSentEmails = () => {
  return useQuery({
    queryKey: ['emails', 'sent'],
    queryFn: emailService.getSentEmails,
  });
};

export const useSearchEmails = (query: string) => {
  return useQuery({
    queryKey: ['emails', 'search', query],
    queryFn: () => emailService.searchEmails(query),
    enabled: query.length > 0,
  });
};

export const useScheduleEmail = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ScheduledEmailRequest) => emailService.scheduleEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to schedule email');
    }
  });
};
