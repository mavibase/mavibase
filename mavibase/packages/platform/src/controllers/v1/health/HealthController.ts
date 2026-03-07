import type { Request, Response } from "express"
import { pool } from "@mavibase/platform/config/database"
import { redis } from "@mavibase/platform/config/redis"

export class HealthController {
  health = async (req: Request, res: Response) => {
    return healthCheck(req, res)
  }

  ready = async (req: Request, res: Response) => {
    return readinessCheck(req, res)
  }

  live = async (req: Request, res: Response) => {
    return livenessCheck(req, res)
  }
}

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now()

    // Check database
    const dbStart = Date.now()
    await pool.query("SELECT 1")
    const dbResponseTime = Date.now() - dbStart

    // Check Redis
    let redisResponseTime = 0
    let redisStatus = "down"
    try {
      if (redis.isOpen) {
        const redisStart = Date.now()
        await redis.ping()
        redisResponseTime = Date.now() - redisStart
        redisStatus = "up"
      }
    } catch (redisError) {
      // Redis not connected, but don't fail health check
    }

    // Memory usage
    const memUsage = process.memoryUsage()

    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000,
      checks: {
        database: {
          status: "up",
          responseTime: dbResponseTime,
          details: {
            totalConnections: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingRequests: pool.waitingCount,
          },
        },
        redis: {
          status: redisStatus,
          responseTime: redisResponseTime,
        },
        memory: {
          status: "up",
          details: {
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsedPercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
          },
        },
      },
      responseTime: Date.now() - startTime,
    })
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message,
    })
  }
}

export const readinessCheck = async (req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1")
    if (redis.isOpen) {
      await redis.ping()
    }

    res.status(200).json({ status: "ready" })
  } catch (error) {
    res.status(503).json({ status: "not ready" })
  }
}

export const livenessCheck = async (req: Request, res: Response) => {
  res.status(200).json({ status: "alive" })
}
