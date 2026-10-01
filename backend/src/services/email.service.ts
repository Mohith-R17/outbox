import { prisma } from '../config/db';
import { sendEmail } from '../integrations/smtp/ethereal.service';
import dotenv from 'dotenv';
import { DelayedError } from 'bullmq';
import { reserveEmailCapacity, getMsUntilNextHour } from './rate-limit.service';
import { updateEmailStatusInIndex } from '../integrations/elasticsearch/elasticsearch.service';

dotenv.config();

export const processEmailJob = async (emailId: string, job?: any) => {
  // 1. Load email by ID
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    throw new Error(`Email with ID ${emailId} not found`);
  }

  // 2. If already SENT, ignore
  if (email.status === 'SENT') {
    console.log(`[Email Service] Email ${emailId} is already SENT. Ignoring.`);
    return;
  }

  // 3. Atomically transition SCHEDULED or FAILED -> PROCESSING
  // We use updateMany to conditionally update and check if it actually updated.
  const updateResult = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: {
        in: ['SCHEDULED', 'FAILED'], // Allow retries from FAILED state if BullMQ retries
      },
    },
    data: {
      status: 'PROCESSING',
    },
  });

  if (updateResult.count === 0) {
    console.log(`[Email Service] Email ${emailId} could not transition to PROCESSING. Might be processed by another worker.`);
    return;
  }

  // Update ES Status to PROCESSING
  updateEmailStatusInIndex(emailId, 'PROCESSING').catch(err => {});

  // 4. Rate Limiting and Minimum Delay Coordination
  const maxEmailsPerHour = parseInt(process.env.MAX_EMAILS_PER_HOUR || '3', 10);
  const minDelayMs = parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10);

  const { allowed, waitTime } = await reserveEmailCapacity(email.senderId, maxEmailsPerHour, minDelayMs);

  if (!allowed) {
    // Capacity unavailable: Reschedule for the next hour window
    const nextHourMs = getMsUntilNextHour();
    console.log(`[Email Service] Sender ${email.senderId} reached hourly limit. Rescheduling job for next hour (in ${nextHourMs}ms).`);
    
    // Send Slack alert
    const { sendSlackNotification } = await import('../integrations/slack/slack.service');
    sendSlackNotification(
      email.senderId,
      `⚠️ Email rate limit reached for sender ${email.senderId}. Additional emails have been rescheduled to the next available hour. Hourly limit: ${maxEmailsPerHour}.`
    ).catch(err => {
      console.error('[Email Service] Failed to send Slack alert:', err.message);
    });

    // We must revert status to SCHEDULED so it can be picked up again
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SCHEDULED' },
    });
    updateEmailStatusInIndex(emailId, 'SCHEDULED').catch(err => {});
    
    if (job && typeof job.moveToDelayed === 'function') {
      await job.moveToDelayed(Date.now() + nextHourMs, job.token);
    }
    throw new DelayedError();
  }

  if (waitTime > 0) {
    console.log(`[Email Service] Rate limit allowed, but minimum delay required. Sleeping worker for ${waitTime}ms (Sender: ${email.senderId}).`);
    // Sleep to respect min delay
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  console.log(`[Email Service] Worker processing email ${emailId}`);

  try {
    // 5. Send email
    const smtpResult = await sendEmail({
      to: email.recipient,
      subject: email.subject,
      body: email.body,
    });

    console.log(`[Email Service] SMTP Delivery Success for ${emailId}. Preview: ${smtpResult.previewUrl}`);

    // 5. Update to SENT
    const sentDate = new Date();
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: sentDate,
      },
    });
    updateEmailStatusInIndex(emailId, 'SENT', sentDate).catch(err => {});
  } catch (error: any) {
    console.error(`[Email Service] SMTP Delivery Failed for ${emailId}:`, error.message);

    // 6. Update to FAILED
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: error.message || 'Unknown SMTP error',
      },
    });
    updateEmailStatusInIndex(emailId, 'FAILED').catch(err => {});

    // Throw error so BullMQ knows it failed and can retry according to backoff
    throw error;
  }
};
