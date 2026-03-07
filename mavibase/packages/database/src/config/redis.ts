import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

import Redis from 'ioredis';
import { logger } from "@mavibase/database/utils/logger";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  return redisClient;
};

export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
