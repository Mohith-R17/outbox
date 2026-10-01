import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const emailQueue = new Queue('emailQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: parseInt(process.env.EMAIL_JOB_ATTEMPTS || '3', 10),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.EMAIL_JOB_BACKOFF_MS || '5000', 10),
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
