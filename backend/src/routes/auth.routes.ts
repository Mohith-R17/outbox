import { Router } from 'express';
import { googleLogin, googleCallback, getMe, logout } from '../controllers/auth.controller';
import { authenticateUser } from '../middleware/jwt.middleware';

const router = Router();

router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.get('/me', authenticateUser, getMe);
router.post('/logout', logout);

export default router;
