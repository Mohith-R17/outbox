import { Request, Response } from 'express';
import { exchangeGoogleToken, getGoogleUserInfo } from '../integrations/google/google.service';
import { prisma } from '../config/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const oauthStates = new Set<string>();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-development';
const COOKIE_NAME = 'reachinbox_auth';

export const googleLogin = (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.add(state);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'Google OAuth is not configured.' });
    return;
  }

  const scope = 'openid email profile';
  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

  res.redirect(googleUrl);
};

export const googleCallback = async (req: Request, res: Response) => {
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

    const data = await exchangeGoogleToken(code as string);
    const userInfo = await getGoogleUserInfo(data.access_token);

    if (!userInfo.id || !userInfo.email) {
      res.status(400).json({ error: 'Incomplete user info received from Google' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { googleId: userInfo.id }
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: userInfo.email }
      });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: userInfo.id,
            name: user.name || userInfo.name,
            avatar: user.avatar || userInfo.picture,
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
            googleId: userInfo.id,
          }
        });
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/`);
  } catch (err: any) {
    console.error('[Auth Controller] Callback error:', err.message);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
};
