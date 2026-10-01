# ReachInbox Email Job Scheduler

A production-quality full-stack email job scheduler built for ReachInbox.

## Phase 1 Architecture

### Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, Elasticsearch
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Infrastructure**: Docker Compose

### Repository Structure
- `/backend`: Express API server
- `/frontend`: React frontend application
- `docker-compose.yml`: Database and services infrastructure (PostgreSQL, Redis, Elasticsearch)

## Setup Instructions

### 1. Prerequisites
- Docker and Docker Compose
- Node.js (v18+)
- npm or yarn

### 2. Infrastructure Setup
Start the local infrastructure (PostgreSQL, Redis, Elasticsearch):
```bash
docker-compose up -d
```

### 3. Backend Setup
```bash
cd backend
npm install
# Configure environment variables
cp ../.env.example .env
# Run Prisma migrations
npx prisma migrate dev --name init
# Start development server
npm run dev
```
The backend server runs at `http://localhost:3000`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend application runs at `http://localhost:5173`.

## Phase 4: Authentication & Security

### Security Strategy & Authentication Flow
- **Stateless Authentication**: We use JWTs embedded in HTTP-only cookies (`reachinbox_auth`). This prevents XSS attacks from extracting tokens.
- **CSRF Protection**: The OAuth 2.0 flow implements `state` parameter validation to prevent CSRF attacks during the OAuth handshake.
- **Environment-Aware Cookies**: Cookies are strictly typed:
  - `Secure: true` and `SameSite: 'none'` in Production (allowing cross-domain frontend/backend if required, but secure).
  - `Secure: false` and `SameSite: 'lax'` in Development (localhost HTTP).
- **Ownership & Isolation**: All resource access (Emails, Senders, Slack Connections) is restricted to the authenticated user. A Prisma middleware-like approach ensures all DB queries enforce `userId: req.user.id`.

### Google Cloud OAuth Setup
To set up Google Login:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and go to **APIs & Services** > **Credentials**.
3. Create an **OAuth client ID** (Web application type).
4. Set **Authorized redirect URIs** to `http://localhost:3000/api/auth/google/callback`.
5. Note the Client ID and Client Secret to place into the backend `.env`.

### Environment Variables (.env)
Your backend `.env` should look like this:

```env
# Database & Infra
DATABASE_URL="postgresql://user:password@localhost:5432/reachinbox?schema=public"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_URL="http://localhost:9200"

# Frontend URL for Redirects
FRONTEND_URL="http://localhost:5173"

# Authentication
JWT_SECRET="your_long_random_jwt_secret"

# Google OAuth
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# Slack OAuth (Optional for integrations)
SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"
SLACK_CALLBACK_URL="http://localhost:3000/api/slack/callback"
```

## Phase 5: Production & Deployment

### Deployment Infrastructure
We have fully containerized the application for production deployment:
- **`render.yaml`**: Complete Blueprint specification for deploying to Render. It sets up PostgreSQL, Redis, Backend (API), Worker (BullMQ), and Frontend (React/Vite).
- **`Dockerfile` (Backend)**: Builds the backend and runs database migrations on startup.
- **`Dockerfile` (Frontend)**: Multi-stage build process compiling the React app using Vite and hosting it behind Nginx for optimized static file delivery.
- **`docker-compose.yml`**: Full local stack orchestrating all dependent services and application containers seamlessly.

### Feature Completeness
- **Frontend Dashboard**: Fully integrated React/TypeScript dashboard allowing users to:
  - Compose emails individually.
  - Upload CSV files to bulk schedule emails.
  - View real-time email statuses (Scheduled, Processing, Sent, Failed).
  - Search across all their scheduled and sent emails (powered by Elasticsearch).
  - Connect/Disconnect their Slack workspace.
- **Scalable Worker**: BullMQ processes jobs gracefully with idempotency baked in.
- **Zero Mocks**: All features implement real services (Google OAuth, Slack OAuth, Elasticsearch, SMTP, PostgreSQL).
