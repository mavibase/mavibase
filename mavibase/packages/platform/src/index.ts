// Platform package exports
export { setupRoutes } from './routes';
export { setupMiddleware } from './middleware';
export { identityMiddleware, optionalIdentityMiddleware } from './middleware/identity-middleware';
export { pool, query, testConnection } from './config/database';
export { connectRedis, redis, redisClient } from './config/redis';
export { errorHandler } from './middleware/error-handler';
