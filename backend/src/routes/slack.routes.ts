import { Router } from 'express';
import {
  connectSlack,
  slackCallback,
  disconnectSlack,
  slackStatus,
} from '../controllers/slack.controller';

import { authenticateUser } from '../middleware/jwt.middleware';

const router = Router();

// Connect to Slack (doesn't need authenticateUser for redirect, but callback does)
router.get('/connect', connectSlack);
// We need authenticateUser to know who to associate the connection with
router.get('/callback', authenticateUser, slackCallback);
router.post('/disconnect', authenticateUser, disconnectSlack);
router.get('/status', authenticateUser, slackStatus);

export default router;
