import { Request, Response } from 'express';
import { scheduleEmail } from '../services/scheduler.service';
import { prisma } from '../config/db';

export const scheduleEmailController = async (req: Request, res: Response) => {
  try {
    const email = await scheduleEmail({ ...req.body, userId: req.user.id });
    res.status(201).json(email);
  } catch (error: any) {
    if (error.message === 'Duplicate idempotencyKey') {
      res.status(409).json({ error: error.message });
    } else if (error.message === 'Sender does not belong to the authenticated user') {
      res.status(403).json({ error: error.message });
    } else if (error.message === 'scheduledAt must be in the future' || error.message.includes('Missing') || error.message.includes('Invalid') || error.message.includes('not found')) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('[API] Error in scheduleEmailController:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const getScheduledEmails = async (req: Request, res: Response) => {
  try {
    const emails = await prisma.email.findMany({
      where: { 
        status: 'SCHEDULED',
        sender: { userId: req.user.id }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
    res.status(200).json(emails);
  } catch (error) {
    console.error('[API] Error in getScheduledEmails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSentEmails = async (req: Request, res: Response) => {
  try {
    const emails = await prisma.email.findMany({
      where: { 
        status: 'SENT',
        sender: { userId: req.user.id }
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.status(200).json(emails);
  } catch (error) {
    console.error('[API] Error in getSentEmails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmailById = async (req: Request, res: Response) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: String(req.params.id) },
      include: { sender: true }
    });
    if (!email || email.sender.userId !== req.user.id) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    // Remove populated sender object to match original response shape if needed
    // or just return as is.
    res.status(200).json(email);
  } catch (error) {
    console.error('[API] Error in getEmailById:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchEmailsController = async (req: Request, res: Response) => {
  try {
    const { q, page = '1', pageSize = '20' } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const { searchEmails } = await import('../integrations/elasticsearch/elasticsearch.service');
    const result = await searchEmails(q, req.user.id, parseInt(page as string, 10), parseInt(pageSize as string, 10));

    res.json(result);
  } catch (error: any) {
    console.error('[Email Controller] Error searching emails:', error);
    res.status(500).json({ error: 'Failed to search emails' });
  }
};
