import type { Request, Response, NextFunction } from "express"
import { HealthChecker } from "@mavibase/database/services/health-checker"

export class HealthController {
  private healthChecker = new HealthChecker()

  // GET /health - Comprehensive health check
  health = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await this.healthChecker.getHealth()

      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503

      res.status(statusCode).json({
        success: health.status !== "unhealthy",
        ...health,
      })
    } catch (error) {
      next(error)
    }
  }

  // GET /ready - Kubernetes readiness probe
  ready = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isReady = await this.healthChecker.checkReadiness()

      if (isReady) {
        res.status(200).json({
          status: "ready",
          timestamp: new Date().toISOString(),
        })
      } else {
        res.status(503).json({
          status: "not_ready",
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      next(error)
    }
  }

  // GET /live - Kubernetes liveness probe
  live = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Simple check - if we can respond, we're alive
      res.status(200).json({
        status: "alive",
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      next(error)
    }
  }

  // GET /config - Public feature flags for the console
  config = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        success: true,
        data: {
          versioning_enabled: process.env.ENABLE_VERSIONING !== "false",
          version_limit: Number.parseInt(process.env.VERSION_LIMIT || "10"),
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
