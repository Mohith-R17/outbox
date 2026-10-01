import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const getHealth = async (req: Request, res: Response) => {
  const health: any = {
    status: 'ok',
    services: {
      postgres: 'unknown',
      redis: 'unknown',
      elasticsearch: 'unknown',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.postgres = 'ok';
  } catch (error) {
    health.services.postgres = 'error';
    health.status = 'degraded';
  }

  try {
    await redis.ping();
    health.services.redis = 'ok';
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }

  try {
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const esRes = await fetch(esUrl);
    if (esRes.ok) {
      health.services.elasticsearch = 'ok';
    } else {
      health.services.elasticsearch = 'error';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.elasticsearch = 'error';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
};
