import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRoutes from './routes/health.routes';
import emailRoutes from './routes/email.routes';

import { emailQueue } from './queues/email.queue';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const app = express();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

import cookieParser from 'cookie-parser';
import slackRoutes from './routes/slack.routes';
import authRoutes from './routes/auth.routes';
import { basicAuth } from './middleware/auth.middleware';

app.use(cookieParser());
app.use('/admin/queues', basicAuth, serverAdapter.getRouter());
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

export default app;
