import { pool } from "@mavibase/database/config/database"
import { getRedisClient } from "@mavibase/database/config/redis"

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
    memory: HealthCheck
  }
}

export interface HealthCheck {
  status: "up" | "down" | "degraded"
  responseTime?: number
  error?: string
  details?: any
}

export class HealthChecker {
  private startTime = Date.now()

  async getHealth(): Promise<HealthStatus> {
    const checks = await Promise.all([this.checkDatabase(), this.checkRedis(), this.checkMemory()])

    const [database, redis, memory] = checks

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy"

    if (database.status === "down") {
      status = "unhealthy"
    } else if (redis.status === "down" || memory.status === "degraded") {
      status = "degraded"
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        database,
        redis,
        memory,
      },
    }
  }

  async checkReadiness(): Promise<boolean> {
    const dbCheck = await this.checkDatabase()
    return dbCheck.status === "up"
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now()

    try {
      await pool.query("SELECT 1")
      const responseTime = Date.now() - start

      return {
        status: responseTime < 1000 ? "up" : "degraded",
        responseTime,
        details: {
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingRequests: pool.waitingCount,
        },
      }
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now()

    try {
      const client = await getRedisClient()

      if (!client) {
        return {
          status: "down",
          details: { message: "Redis not configured" },
        }
      }

      await client.ping()
      const responseTime = Date.now() - start

      return {
        status: responseTime < 500 ? "up" : "degraded",
        responseTime,
      }
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const memUsage = process.memoryUsage()
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100

    return {
      status: heapUsedPercent < 90 ? "up" : "degraded",
      details: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
    }
  }
}
