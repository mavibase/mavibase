import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupRoutes as setupDatabaseRoutes } from '@mavibase/api/routes/index';
import { setupRoutes as setupPlatformRoutes, setupMiddleware } from '@mavibase/platform';
import { pool as databasePool } from '@mavibase/database/config/database';
import { pool as platformPool, testConnection as testPlatformConnection } from '@mavibase/platform/config/database';
import { connectRedis as connectPlatformRedis } from '@mavibase/platform/config/redis';
import { startAuditLogRetentionJob } from '@mavibase/platform/services/audit-retention';
import { logger } from '@mavibase/database/utils/logger';
import { errorHandler as platformErrorHandler } from '@mavibase/platform/middleware/error-handler';

const app = express();
const PORT = process.env.PORT || 3000;


app.set('trust proxy', 1);

// Setup unified middleware for both services FIRST - applies to all routes
setupMiddleware(app);  // Unified middleware (CORS, security, body parsing)

// Root health check - gives overview of all services (after middleware so CORS applies)
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  const checks: Record<string, any> = {
    server: { status: 'up' },
    database_pool: { status: 'unknown' },
    platform_pool: { status: 'unknown' },
  };

  // Check database package pool
  try {
    const dbStart = Date.now();
    await databasePool.query('SELECT 1');
    checks.database_pool = { 
      status: 'up', 
      responseTime: Date.now() - dbStart,
      connections: {
        total: databasePool.totalCount,
        idle: databasePool.idleCount,
        waiting: databasePool.waitingCount,
      }
    };
  } catch (error: any) {
    checks.database_pool = { status: 'down', error: error.message };
  }

  // Check platform package pool
  try {
    const platformStart = Date.now();
    await platformPool.query('SELECT 1');
    checks.platform_pool = { 
      status: 'up', 
      responseTime: Date.now() - platformStart,
      connections: {
        total: platformPool.totalCount,
        idle: platformPool.idleCount,
        waiting: platformPool.waitingCount,
      }
    };
  } catch (error: any) {
    checks.platform_pool = { status: 'down', error: error.message };
  }

  const allUp = Object.values(checks).every((c: any) => c.status === 'up');
  const anyDown = Object.values(checks).some((c: any) => c.status === 'down');
  const status = anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded';

  res.status(anyDown ? 503 : 200).json({
    success: !anyDown,
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
    responseTime: Date.now() - startTime,
    checks,
    endpoints: {
      database: {
        health: '/api/v1/db/health',
        ready: '/api/v1/db/ready',
        live: '/api/v1/db/live',
      },
      platform: {
        health: '/api/v1/platform/health',
        ready: '/api/v1/platform/ready',
        live: '/api/v1/platform/live',
      },
    },
  });
});

// Setup routes for both services
setupDatabaseRoutes(app); // Database service routes
setupPlatformRoutes(app); // Platform service routes

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handlers
app.use(platformErrorHandler);

// Validate required environment variables at startup
function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check JWT secrets in production
  if (isProduction) {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    
    if (!accessSecret || accessSecret.includes("change-this") || accessSecret === "access-secret-key") {
      errors.push("ACCESS_TOKEN_SECRET must be set to a strong secret in production");
    }
    if (!refreshSecret || refreshSecret.includes("change-this") || refreshSecret === "refresh-secret-key") {
      errors.push("REFRESH_TOKEN_SECRET must be set to a strong secret in production");
    }
  }
  
  // Log warnings
  warnings.forEach(w => logger.warn(`ENV WARNING: ${w}`));
  
  // Log errors and exit if critical
  if (errors.length > 0) {
    errors.forEach(e => logger.error(`ENV ERROR: ${e}`));
    logger.error("Server cannot start due to missing/invalid environment variables");
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Validate environment before starting
    validateEnvironment();
    
    // Test platform database connection
    const platformDbConnected = await testPlatformConnection();
    if (!platformDbConnected) {
      logger.error('Failed to connect to platform database');
      process.exit(1);
    }

    // Connect to Redis for platform
    const redisConnected = await connectPlatformRedis();
    if (!redisConnected) {
      logger.warn('Failed to connect to Redis - some features may not work');
    }

    // Start best-effort audit log retention/rotation
    startAuditLogRetentionJob();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
      });
    });

    // Graceful Shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        logger.info('HTTP server closed');
        await databasePool.end();
        await platformPool.end();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
