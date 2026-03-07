import { pool } from '../config/database';
import { getRedisClient } from '../config/redis';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}

export class HealthChecker {
  async getHealth(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = database.status === 'up' && redis.status === 'up';
    const anyDown = database.status === 'down' || redis.status === 'down';

    const status = anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };
  }

  async checkReadiness(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status !== 'unhealthy';
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await pool.query('SELECT 1');
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const redis = getRedisClient();
      await redis.ping();
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }
}
