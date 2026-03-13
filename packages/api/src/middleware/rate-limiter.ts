import rateLimit from "express-rate-limit"
import RedisStore from "rate-limit-redis"
import { getRedisClient } from "@mavibase/database/config/redis"
import { logger } from "@mavibase/database/utils/logger"

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000")
const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100")
const isProduction = process.env.NODE_ENV === "production"

// Initialize Redis client for distributed rate limiting
let redisClient: ReturnType<typeof getRedisClient> | null = null
let redisStore: RedisStore | null = null

try {
  redisClient = getRedisClient()
  
  // Create Redis store for distributed rate limiting
  redisStore = new RedisStore({
    // @ts-expect-error - ioredis is compatible with rate-limit-redis
    sendCommand: (...args: string[]) => redisClient!.call(...args),
    prefix: "rl:api:",
  })
  
  logger.info("Redis store initialized for distributed rate limiting")
} catch (error: any) {
  logger.warn("Redis not available for rate limiting", { error: error.message })
  
  // SECURITY: In production, Redis is REQUIRED for distributed rate limiting
  // Without it, attackers can bypass rate limits by distributing requests across instances
  if (isProduction) {
    throw new Error(
      "FATAL: Redis is required for rate limiting in production. " +
      "Without distributed rate limiting, attackers can bypass limits. " +
      "Set REDIS_URL environment variable or disable rate limiting explicitly."
    )
  }
}

/**
 * Rate limiter with per-project scoping and distributed Redis store
 * 
 * SECURITY FEATURES:
 * - Uses Redis store for distributed rate limiting across multiple instances
 * - Rate limits are scoped per project_id, not global
 * - Prevents one project from exhausting quota for all others
 * - Falls back to IP-based limiting for unauthenticated requests
 * - REQUIRES Redis in production to prevent bypass attacks
 */
export const rateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store for distributed rate limiting (required in production)
  store: redisStore ?? undefined,
  // Generate rate limit key per project, not globally
  keyGenerator: (req: any) => {
    const projectId = req.identity?.project_id || req.ip
    return `${projectId}`
  },
  skip: (req) => {
    // Only skip rate limiting in development mode
    if (process.env.NODE_ENV === "development") {
      return true
    }
    return false
  },
  handler: (req, res) => {
    const projectId = (req as any).identity?.project_id || (req as any).ip
    logger.warn("Rate limit exceeded", { 
      projectId, 
      path: req.path,
      store: redisStore ? "redis" : "memory"
    })
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Try again later.",
      },
    })
  },
})

/**
 * Check if rate limiting is using distributed Redis store
 * Useful for health checks and monitoring
 */
export const isDistributedRateLimiting = (): boolean => {
  return redisStore !== null
}
