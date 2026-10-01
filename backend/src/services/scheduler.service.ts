import { prisma } from '../config/db';
import { emailQueue } from '../queues/email.queue';
import { indexEmail } from '../integrations/elasticsearch/elasticsearch.service';

interface ScheduleEmailPayload {
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  idempotencyKey: string;
}

export const scheduleEmail = async (payload: ScheduleEmailPayload) => {
  const { userId, senderId, recipient, subject, body, scheduledAt, idempotencyKey } = payload;

  if (!senderId || !recipient || !subject || !body || !scheduledAt || !idempotencyKey) {
    throw new Error('Missing required fields');
  }

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender || sender.userId !== userId) {
    throw new Error('Sender does not belong to the authenticated user');
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new Error('Invalid scheduledAt date');
  }

  const delay = Math.max(0, scheduledDate.getTime() - Date.now());
  
  if (scheduledDate.getTime() <= Date.now()) {
      throw new Error('scheduledAt must be in the future');
  }

  // Idempotency check:
  const existing = await prisma.email.findUnique({
    where: { idempotencyKey },
  });
  
  if (existing) {
    throw new Error('Duplicate idempotencyKey');
  }

  // Create email record
  const email = await prisma.email.create({
    data: {
      senderId,
      recipient,
      subject,
      body,
      scheduledAt: scheduledDate,
      status: 'SCHEDULED',
      idempotencyKey,
    },
  });

  // Schedule job
  const job = await emailQueue.add(
    'send-email',
    { emailId: email.id },
    {
      delay,
      jobId: `email-${email.id}`, // deterministic job ID
    }
  );

  // Save bullmq job ID
  const updatedEmail = await prisma.email.update({
    where: { id: email.id },
    data: { bullmqJobId: job.id },
    include: { sender: true },
  });

  // Index in Elasticsearch (fire-and-forget)
  indexEmail(updatedEmail).catch(err => {
    console.error(`[Scheduler] Failed to index email ${updatedEmail.id} in Elasticsearch. Core scheduling succeeded.`);
  });

  console.log(`[Scheduler] Email scheduled. ID: ${updatedEmail.id}, JobID: ${job.id}, Delay: ${delay}ms`);

  return updatedEmail;
};
