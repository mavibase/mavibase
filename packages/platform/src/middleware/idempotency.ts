import type { Request, Response, NextFunction } from "express"
import { getRedisClient } from "@mavibase/database/config/redis"
import { logger } from "@mavibase/database/utils/logger"

/**
 * Idempotency middleware for request deduplication
 * 
 * Prevents duplicate submissions when users click buttons multiple times
 * or when network retries cause duplicate requests.
 * 
 * Usage:
 * - Client sends `Idempotency-Key` header with a unique UUID
 * - If the same key is seen again within TTL, returns cached response
 * - If key is new, processes request and caches response
 * 
 * Environment Variables:
 * - IDEMPOTENCY_ENABLED: Enable/disable idempotency (default: true)
 * - IDEMPOTENCY_TTL: Cache TTL in seconds (default: 3600 = 1 hour)
 * - IDEMPOTENCY_KEY_PREFIX: Redis key prefix (default: idempotency)
 */

interface CachedResponse {
  statusCode: number
  body: any
  headers: Record<string, string>
  createdAt: string
}

interface IdempotencyState {
  status: "processing" | "completed"
  response?: CachedResponse
  lockedAt?: string
}

// Configuration
const IDEMPOTENCY_ENABLED = process.env.IDEMPOTENCY_ENABLED !== "false"
const IDEMPOTENCY_TTL = parseInt(process.env.IDEMPOTENCY_TTL || "3600", 10) // 1 hour default
const IDEMPOTENCY_KEY_PREFIX = process.env.IDEMPOTENCY_KEY_PREFIX || "idempotency"
const LOCK_TTL = 30 // 30 seconds lock for in-flight requests

// Validate Idempotency-Key format (UUID v4)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let redisClient: ReturnType<typeof getRedisClient> | null = null

/**
 * Initialize Redis client for idempotency
 */
const initRedis = () => {
  if (!redisClient) {
    try {
      redisClient = getRedisClient()
    } catch (error) {
      logger.warn("Redis not available for idempotency middleware", { error })
    }
  }
  return redisClient
}

/**
 * Build Redis key for idempotency
 */
const buildKey = (projectId: string, idempotencyKey: string): string => {
  return `${IDEMPOTENCY_KEY_PREFIX}:${projectId}:${idempotencyKey}`
}

/**
 * Main idempotency middleware
 */
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if disabled
  if (!IDEMPOTENCY_ENABLED) {
    return next()
  }

  // Only apply to mutating methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next()
  }

  // Get idempotency key from header
  const idempotencyKey = req.get("Idempotency-Key")
  
  // If no key provided, proceed without deduplication (backward compatible)
  if (!idempotencyKey) {
    return next()
  }

  // Validate key format
  if (!UUID_REGEX.test(idempotencyKey)) {
    res.status(400).json({
      error: {
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a valid UUID v4",
        received: idempotencyKey,
      },
    })
    return
  }

  // Initialize Redis
  const redis = initRedis()
  if (!redis) {
    // Without Redis, skip idempotency (log warning)
    logger.warn("Idempotency check skipped - Redis not available")
    return next()
  }

  // Get project ID for scoping (prevents cross-project key collisions)
  const projectId = (req as any).identity?.project_id || (req as any).user?.id || "anonymous"
  const key = buildKey(projectId, idempotencyKey)

  try {
    // Check for existing key
    const existing = await redis.get(key)

    if (existing) {
      const state: IdempotencyState = JSON.parse(existing)

      if (state.status === "completed" && state.response) {
        // Return cached response
        logger.info("Returning cached idempotent response", {
          idempotencyKey,
          projectId,
          originalCreatedAt: state.response.createdAt,
        })

        // Restore original headers
        Object.entries(state.response.headers).forEach(([name, value]) => {
          res.setHeader(name, value)
        })

        res.setHeader("Idempotency-Replayed", "true")
        res.status(state.response.statusCode).json(state.response.body)
        return
      }

      if (state.status === "processing") {
        // Another request is in progress with this key
        res.status(409).json({
          error: {
            code: "IDEMPOTENCY_KEY_IN_USE",
            message: "A request with this Idempotency-Key is currently being processed",
            retryAfter: LOCK_TTL,
          },
        })
        return
      }
    }

    // Lock the key while processing
    const lockState: IdempotencyState = {
      status: "processing",
      lockedAt: new Date().toISOString(),
    }
    await redis.set(key, JSON.stringify(lockState), "EX", LOCK_TTL)

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res)
    const originalSend = res.send.bind(res)

    // Track response headers we want to cache
    const headersToCache = ["X-Request-Id", "X-RateLimit-Remaining"]
    
    // Intercept res.json()
    res.json = function (body: any) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cachedHeaders: Record<string, string> = {}
        headersToCache.forEach((header) => {
          const value = res.getHeader(header)
          if (value) {
            cachedHeaders[header] = String(value)
          }
        })

        const completedState: IdempotencyState = {
          status: "completed",
          response: {
            statusCode: res.statusCode,
            body,
            headers: cachedHeaders,
            createdAt: new Date().toISOString(),
          },
        }

        // Store with full TTL
        redis.set(key, JSON.stringify(completedState), "EX", IDEMPOTENCY_TTL).catch((err) => {
          logger.error("Failed to cache idempotent response", { error: err, idempotencyKey })
        })
      } else {
        // For non-2xx responses, remove the lock so client can retry
        redis.del(key).catch((err) => {
          logger.error("Failed to remove idempotency lock", { error: err, idempotencyKey })
        })
      }

      return originalJson(body)
    }

    // Also intercept res.send() for non-JSON responses
    res.send = function (body: any) {
      // Remove lock for non-JSON responses (we only cache JSON)
      redis.del(key).catch((err) => {
        logger.error("Failed to remove idempotency lock for non-JSON", { error: err, idempotencyKey })
      })
      return originalSend(body)
    }

    // Proceed with request
    next()
  } catch (error) {
    logger.error("Idempotency middleware error", { error, idempotencyKey })
    // On error, proceed without idempotency
    next()
  }
}

/**
 * Check if idempotency is enabled and Redis is available
 */
export const isIdempotencyEnabled = (): boolean => {
  return IDEMPOTENCY_ENABLED && redisClient !== null
}
