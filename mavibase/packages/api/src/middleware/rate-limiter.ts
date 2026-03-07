import rateLimit from "express-rate-limit"
import { getRedisClient } from "@mavibase/database/config/redis"
import { logger } from "@mavibase/database/utils/logger"

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000")
const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100")

// Try to initialize Redis client
let redisClient: ReturnType<typeof getRedisClient> | null = null
try {
  redisClient = getRedisClient()
  logger.info("Redis client initialized for rate limiting")
} catch (error: any) {
  logger.warn("Redis not available, using memory store for rate limiting", { error: error.message })
}

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
  skip: (req) => process.env.NODE_ENV === "development",
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { ip: req.ip, path: req.path })
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Try again later.",
      },
    })
  },
  // Using in-memory store by default - Redis store can be added later if needed
})
