import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import jwt from 'jsonwebtoken';

jest.mock('../src/config/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    email: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../src/integrations/google/google.service', () => ({
  exchangeGoogleToken: jest.fn(),
  getGoogleUserInfo: jest.fn(),
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

jest.mock('../src/queues/email.queue', () => ({
  emailQueue: {
    add: jest.fn(),
  },
}));

describe('Auth & Ownership API', () => {
  const mockUser1 = { id: 'user-1', email: 'test1@example.com', name: 'User 1' };
  const mockUser2 = { id: 'user-2', email: 'test2@example.com', name: 'User 2' };

  let validTokenUser1: string;
  let validTokenUser2: string;

  beforeEach(() => {
    jest.clearAllMocks();
    const secret = process.env.JWT_SECRET || 'super-secret-key-for-development';
    validTokenUser1 = jwt.sign({ userId: mockUser1.id, email: mockUser1.email }, secret);
    validTokenUser2 = jwt.sign({ userId: mockUser2.id, email: mockUser2.email }, secret);
  });

  describe('Unauthenticated Access', () => {
    it('should reject unauthenticated access to /api/auth/me', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthenticated');
    });

    it('should reject unauthenticated access to /api/emails/scheduled', async () => {
      const response = await request(app).get('/api/emails/scheduled');
      expect(response.status).toBe(401);
    });
  });

  describe('Authenticated Access & Ownership', () => {
    it('should allow access to /api/auth/me with valid token', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser1);
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`reachinbox_auth=${validTokenUser1}`]);
        
      expect(response.status).toBe(200);
      expect(response.body.email).toBe(mockUser1.email);
    });

    it('should return 404 for email belonging to another user', async () => {
      // User 2 owns the email
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'email-1',
        sender: { userId: mockUser2.id }
      });

      // User 1 requests it
      const response = await request(app)
        .get('/api/emails/email-1')
        .set('Cookie', [`reachinbox_auth=${validTokenUser1}`]);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Email not found');
    });

    it('should return 200 for email belonging to the authenticated user', async () => {
      // User 1 owns the email
      (prisma.email.findUnique as any).mockResolvedValue({
        id: 'email-1',
        sender: { userId: mockUser1.id }
      });

      // User 1 requests it
      const response = await request(app)
        .get('/api/emails/email-1')
        .set('Cookie', [`reachinbox_auth=${validTokenUser1}`]);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('email-1');
    });
  });

  describe('Logout', () => {
    it('should clear cookie on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`reachinbox_auth=${validTokenUser1}`]);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie'][0]).toContain('reachinbox_auth=;');
    });
  });
});
