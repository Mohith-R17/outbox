import { Router } from 'express';
import {
  scheduleEmailController,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
  searchEmailsController,
} from '../controllers/email.controller';

import { authenticateUser } from '../middleware/jwt.middleware';

const router = Router();

router.use(authenticateUser);

router.post('/schedule', scheduleEmailController);
router.get('/search', searchEmailsController);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/:id', getEmailById);

export default router;
