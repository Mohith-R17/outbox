import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { processEmailJob } from '../services/email.service';
import dotenv from 'dotenv';

dotenv.config();

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const minDelayMs = parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10);

export const emailWorker = new Worker(
  'emailQueue',
  async (job: Job) => {
    const { emailId } = job.data;
    if (!emailId) {
      console.error(`[Worker] Missing emailId in job ${job.id}`);
      return;
    }

    try {
      await processEmailJob(emailId, job);
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed processing:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});

console.log(`[Worker] Started listening to emailQueue with concurrency ${concurrency}`);
