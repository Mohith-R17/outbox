export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Email {
  id: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  sentAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  idempotencyKey: string;
  bullmqJobId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledEmailRequest {
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  idempotencyKey?: string;
}

export interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
}
