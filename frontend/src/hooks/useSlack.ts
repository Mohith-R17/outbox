import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slackService } from '../services/slackService';
import toast from 'react-hot-toast';

export const useSlackStatus = () => {
  return useQuery({
    queryKey: ['slackStatus'],
    queryFn: slackService.getStatus,
  });
};

export const useDisconnectSlack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: slackService.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
      toast.success('Slack disconnected successfully');
    },
    onError: () => {
      toast.error('Failed to disconnect Slack');
    }
  });
};
