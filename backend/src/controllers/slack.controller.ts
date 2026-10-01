import { Request, Response } from 'express';
import { exchangeSlackToken } from '../integrations/slack/slack.service';
import { prisma } from '../config/db';
import crypto from 'crypto';

// A simple state store for OAuth (In production, use Redis or DB with expiry)
const oauthStates = new Set<string>();

export const connectSlack = (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.add(state);

  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'Slack OAuth is not configured.' });
    return;
  }

  // Basic scope needed to send a message to a user or channel
  const scope = 'chat:write';
  const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(slackUrl);
};

export const slackCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
       res.status(400).json({ error: `OAuth error: ${error}` });
       return;
    }

    if (!state || !oauthStates.has(state as string)) {
      res.status(400).json({ error: 'Invalid or missing state parameter' });
      return;
    }
    oauthStates.delete(state as string);

    if (!code) {
      res.status(400).json({ error: 'Code parameter is required' });
      return;
    }

    const data = await exchangeSlackToken(code as string);

    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    // Save Slack connection
    await prisma.slackConnection.create({
      data: {
        userId: req.user.id,
        slackTeamId: data.team?.id || '',
        accessToken: data.access_token,
        channelId: data.authed_user?.id || '',
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?slack=success`);
  } catch (error: any) {
    console.error('[Slack Controller] Callback error:', error.message);
    res.status(500).json({ error: 'Failed to connect Slack' });
  }
};

export const disconnectSlack = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    await prisma.slackConnection.deleteMany({
      where: { userId: req.user.id },
    });

    res.status(200).json({ message: 'Slack disconnected successfully' });
  } catch (error: any) {
    console.error('[Slack Controller] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
};

export const slackStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const conns = await prisma.slackConnection.findMany({
      where: { userId: req.user.id }
    });

    if (conns.length === 0) {
      res.status(200).json({ connected: false });
      return;
    }

    res.status(200).json({ connected: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
