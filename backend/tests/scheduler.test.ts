import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { emailQueue } from '../src/queues/email.queue';
import { processEmailJob } from '../src/services/email.service';
import * as etherealService from '../src/integrations/smtp/ethereal.service';

jest.mock('../src/config/db', () => ({
  prisma: {
    email: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    sender: {
      findUnique: jest.fn(),
    }
  },
}));

jest.mock('../src/queues/email.queue', () => ({
  emailQueue: {
    add: jest.fn(),
  },
}));

// Mock the background worker initialization to prevent it from starting and connecting to real Redis
jest.mock('../src/workers/email.worker', () => ({
  emailWorker: {
    on: jest.fn(),
  },
}));

jest.mock('../src/services/rate-limit.service', () => ({
  reserveEmailCapacity: jest.fn().mockReturnValue(Promise.resolve({ allowed: true, waitTime: 0 })),
  getMsUntilNextHour: jest.fn().mockReturnValue(3600000),
}));

jest.mock('../src/integrations/slack/slack.service', () => ({
  sendSlackNotification: jest.fn().mockReturnValue(Promise.resolve(true)),
}));

jest.mock('../src/integrations/elasticsearch/elasticsearch.service', () => ({
  initElasticsearch: jest.fn().mockReturnValue(Promise.resolve(true)),
  indexEmail: jest.fn().mockReturnValue(Promise.resolve(true)),
  updateEmailStatusInIndex: jest.fn().mockReturnValue(Promise.resolve(true)),
  searchEmails: jest.fn().mockReturnValue(Promise.resolve({ data: [], total: 0 })),
}));

jest.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@bull-board/api', () => ({
  createBullBoard: jest.fn(),
}));

jest.mock('@bull-board/express', () => ({
  ExpressAdapter: jest.fn().mockImplementation(() => ({
    setBasePath: jest.fn(),
    getRouter: jest.fn().mockReturnValue((req: any, res: any, next: any) => next()),
  })),
}));

jest.mock('../src/middleware/jwt.middleware', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', email: 'test@user.com' };
    next();
  },
}));

describe('Scheduler API & Worker Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.sender.findUnique as any).mockResolvedValue({ id: '123', userId: 'user-1' });
  });

  it('should validate and reject missing fields', async () => {
    const response = await request(app)
      .post('/api/emails/schedule')
      .send({
        recipient: 'test@example.com',
        // missing senderId, subject, etc.
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required fields');
  });

  it('should reject past scheduledAt dates', async () => {
    const response = await request(app)
      .post('/api/emails/schedule')
      .send({
        senderId: '123',
        recipient: 'test@example.com',
        subject: 'Test',
        body: 'Body',
        scheduledAt: new Date(Date.now() - 10000).toISOString(),
        idempotencyKey: 'key-1',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('must be in the future');
  });

  it('should reject duplicate idempotency keys', async () => {
    (prisma.email.findUnique as any).mockResolvedValue({ id: 'existing-id' });

    const response = await request(app)
      .post('/api/emails/schedule')
      .send({
        senderId: '123',
        recipient: 'test@example.com',
        subject: 'Test',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 10000).toISOString(),
        idempotencyKey: 'key-2',
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Duplicate idempotencyKey');
  });

  it('should create email and enqueue job for valid request', async () => {
    (prisma.email.findUnique as any).mockResolvedValue(null);
    (prisma.email.create as any).mockResolvedValue({ id: 'new-email-id' });
    (emailQueue.add as any).mockResolvedValue({ id: 'job-123' });
    (prisma.email.update as any).mockResolvedValue({ id: 'new-email-id', bullmqJobId: 'job-123' });

    const response = await request(app)
      .post('/api/emails/schedule')
      .send({
        senderId: '123',
        recipient: 'test@example.com',
        subject: 'Test',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 10000).toISOString(),
        idempotencyKey: 'key-3',
      });

    expect(response.status).toBe(201);
    expect(prisma.email.create).toHaveBeenCalled();
    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      { emailId: 'new-email-id' },
      expect.objectContaining({ delay: expect.any(Number), jobId: 'email-new-email-id' })
    );
  });

  describe('Worker processEmailJob', () => {
    it('should not process if already SENT', async () => {
      (prisma.email.findUnique as any).mockResolvedValue({ id: 'e1', status: 'SENT' });
      await processEmailJob('e1');
      expect(prisma.email.updateMany).not.toHaveBeenCalled();
    });

    it('should send email and mark SENT if processing succeeds', async () => {
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'e2',
        status: 'SCHEDULED',
        recipient: 'r@a.com',
        subject: 's',
        body: 'b'
      });
      (prisma.email.updateMany as any).mockResolvedValue({ count: 1 });
      
      const sendEmailMock = jest.spyOn(etherealService, 'sendEmail').mockResolvedValue({ messageId: 'm1', previewUrl: 'u1' });

      await processEmailJob('e2');

      expect(prisma.email.updateMany).toHaveBeenCalledWith({
        where: { id: 'e2', status: { in: ['SCHEDULED', 'FAILED'] } },
        data: { status: 'PROCESSING' }
      });
      expect(sendEmailMock).toHaveBeenCalled();
      expect(prisma.email.update).toHaveBeenCalledWith({
        where: { id: 'e2' },
        data: expect.objectContaining({ status: 'SENT' })
      });
    });

    it('should mark FAILED and throw if SMTP fails', async () => {
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'e3',
        status: 'SCHEDULED',
        recipient: 'r@a.com',
        subject: 's',
        body: 'b'
      });
      (prisma.email.updateMany as any).mockResolvedValue({ count: 1 });
      
      const sendEmailMock = jest.spyOn(etherealService, 'sendEmail').mockRejectedValue(new Error('SMTP Error'));

      await expect(processEmailJob('e3')).rejects.toThrow('SMTP Error');

      expect(prisma.email.update).toHaveBeenCalledWith({
        where: { id: 'e3' },
        data: expect.objectContaining({ status: 'FAILED', failureReason: 'SMTP Error' })
      });
    });

    it('should reschedule and throw DelayedError if hourly limit reached', async () => {
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'e4',
        status: 'SCHEDULED',
        senderId: 'sender-1',
      });
      (prisma.email.updateMany as any).mockResolvedValue({ count: 1 });
      const rateLimitMock = require('../src/services/rate-limit.service').reserveEmailCapacity;
      rateLimitMock.mockResolvedValueOnce({ allowed: false, waitTime: 0 });

      const mockJob = { moveToDelayed: jest.fn(), token: 'token-123' };

      await expect(processEmailJob('e4', mockJob)).rejects.toThrow(); // throws DelayedError

      expect(prisma.email.update).toHaveBeenCalledWith({
        where: { id: 'e4' },
        data: { status: 'SCHEDULED' }
      });
      expect(mockJob.moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'token-123');
    });

    it('should sleep if minimum delay required', async () => {
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'e5',
        status: 'SCHEDULED',
        senderId: 'sender-1',
      });
      (prisma.email.updateMany as any).mockResolvedValue({ count: 1 });
      const rateLimitMock = require('../src/services/rate-limit.service').reserveEmailCapacity;
      rateLimitMock.mockResolvedValueOnce({ allowed: true, waitTime: 50 }); // 50ms wait

      const sendEmailMock = jest.spyOn(etherealService, 'sendEmail').mockResolvedValue({ messageId: 'm1', previewUrl: 'u1' });
      
      const start = Date.now();
      await processEmailJob('e5');
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(40);
      expect(sendEmailMock).toHaveBeenCalled();
    });
  });
});
