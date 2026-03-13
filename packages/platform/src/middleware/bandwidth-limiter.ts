import type { Request, Response, NextFunction } from "express"
import { getRedisClient } from "@mavibase/database/config/redis"
import { logger } from "../utils/logger"

/**
 * Bandwidth-based rate limiting middleware
 * 
 * Unlike request-count rate limiting, this tracks bytes transferred per time window.
 * Prevents attackers from consuming resources with large payloads while staying
 * under request count limits.
 */

interface BandwidthConfig {
  /** Maximum bytes allowed per window (default: 50MB) */
  maxBytesPerWindow: number
  /** Window size in seconds (default: 60) */
  windowSeconds: number
  /** Redis key prefix */
  keyPrefix: string
  /** Whether to include response size in bandwidth calculation */
  includeResponse: boolean
  /** Spike threshold - reject single requests larger than this (default: 10MB) */
  maxSingleRequestBytes: number
  /** Skip paths (health checks, etc.) */
  skipPaths: string[]
}

const defaultConfig: BandwidthConfig = {
  maxBytesPerWindow: parseInt(process.env.BANDWIDTH_LIMIT_BYTES || "52428800", 10), // 50MB
  windowSeconds: parseInt(process.env.BANDWIDTH_WINDOW_SECONDS || "60", 10),
  keyPrefix: process.env.BANDWIDTH_KEY_PREFIX || "bw",
  includeResponse: process.env.BANDWIDTH_INCLUDE_RESPONSE === "true",
  maxSingleRequestBytes: parseInt(process.env.MAX_SINGLE_REQUEST_BYTES || "10485760", 10), // 10MB
  skipPaths: ["/health", "/live", "/ready", "/metrics"],
}

/**
 * Get the bandwidth key for a given identifier
 */
function getBandwidthKey(prefix: string, identifier: string, windowSeconds: number): string {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds
  return `${prefix}:${identifier}:${windowStart}`
}

/**
 * Extract identifier for bandwidth tracking
 * Priority: Project ID > User ID > IP Address
 */
function getIdentifier(req: Request): string {
  const projectId = req.headers["x-project-id"] as string
  if (projectId) return `proj:${projectId}`
  
  const userId = (req as any).user?.id
  if (userId) return `user:${userId}`
  
  const ip = (req as any).clientIp || req.ip || "unknown"
  return `ip:${ip}`
}

/**
 * Calculate request body size in bytes
 */
function getRequestSize(req: Request): number {
  // Content-Length header is most reliable
  const contentLength = req.headers["content-length"]
  if (contentLength) {
    return parseInt(contentLength, 10) || 0
  }
  
  // Fallback: calculate from body if already parsed
  if (req.body) {
    try {
      return Buffer.byteLength(JSON.stringify(req.body), "utf8")
    } catch {
      return 0
    }
  }
  
  return 0
}

/**
 * Bandwidth limiter middleware factory
 */
export function createBandwidthLimiter(config: Partial<BandwidthConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config }
  let redisAvailable = false
  let redis: ReturnType<typeof getRedisClient> | null = null

  // Initialize Redis connection
  const initRedis = async () => {
    try {
      redis = getRedisClient()
      await redis.ping()
      redisAvailable = true
      logger.info("Bandwidth limiter: Redis connected")
    } catch (error) {
      redisAvailable = false
      logger.warn("Bandwidth limiter: Redis unavailable, falling back to per-request size check only")
    }
  }

  // Initialize on first use
  initRedis()

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip non-body methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next()
    }

    // Skip configured paths
    if (finalConfig.skipPaths.some(path => req.path.startsWith(path))) {
      return next()
    }

    const requestSize = getRequestSize(req)

    // Check 1: Single request spike detection (works without Redis)
    if (requestSize > finalConfig.maxSingleRequestBytes) {
      logger.warn("Request size spike detected", {
        path: req.path,
        method: req.method,
        requestSize,
        maxAllowed: finalConfig.maxSingleRequestBytes,
        identifier: getIdentifier(req),
      })

      return res.status(413).json({
        error: {
          code: "REQUEST_TOO_LARGE",
          message: `Request body exceeds maximum allowed size of ${Math.round(finalConfig.maxSingleRequestBytes / 1024 / 1024)}MB`,
          received: `${Math.round(requestSize / 1024 / 1024 * 100) / 100}MB`,
          limit: `${Math.round(finalConfig.maxSingleRequestBytes / 1024 / 1024)}MB`,
        },
      })
    }

    // Check 2: Bandwidth-based rate limiting (requires Redis)
    if (!redisAvailable || !redis) {
      // Without Redis, we can only do per-request size check (already done above)
      return next()
    }

    const identifier = getIdentifier(req)
    const key = getBandwidthKey(finalConfig.keyPrefix, identifier, finalConfig.windowSeconds)

    try {
      // Increment bandwidth counter
      const currentBytes = await redis.incrby(key, requestSize)
      
      // Set expiry on first increment
      if (currentBytes === requestSize) {
        await redis.expire(key, finalConfig.windowSeconds)
      }

      // Set headers for client visibility
      res.setHeader("X-Bandwidth-Limit", finalConfig.maxBytesPerWindow)
      res.setHeader("X-Bandwidth-Used", currentBytes)
      res.setHeader("X-Bandwidth-Remaining", Math.max(0, finalConfig.maxBytesPerWindow - currentBytes))

      // Check if limit exceeded
      if (currentBytes > finalConfig.maxBytesPerWindow) {
        const ttl = await redis.ttl(key)
        
        logger.warn("Bandwidth limit exceeded", {
          identifier,
          currentBytes,
          maxBytes: finalConfig.maxBytesPerWindow,
          windowSeconds: finalConfig.windowSeconds,
          resetIn: ttl,
        })

        res.setHeader("Retry-After", ttl > 0 ? ttl : finalConfig.windowSeconds)

        return res.status(429).json({
          error: {
            code: "BANDWIDTH_LIMIT_EXCEEDED",
            message: `Bandwidth limit of ${Math.round(finalConfig.maxBytesPerWindow / 1024 / 1024)}MB per ${finalConfig.windowSeconds} seconds exceeded`,
            used: `${Math.round(currentBytes / 1024 / 1024 * 100) / 100}MB`,
            limit: `${Math.round(finalConfig.maxBytesPerWindow / 1024 / 1024)}MB`,
            retryAfter: ttl > 0 ? ttl : finalConfig.windowSeconds,
          },
        })
      }

      // Optionally track response size
      if (finalConfig.includeResponse) {
        const originalJson = res.json.bind(res)
        res.json = function(data: any) {
          try {
            const responseSize = Buffer.byteLength(JSON.stringify(data), "utf8")
            redis?.incrby(key, responseSize).catch(() => {
              // Ignore Redis errors for response tracking
            })
          } catch {
            // Ignore serialization errors
          }
          return originalJson(data)
        }
      }

      next()
    } catch (error) {
      // On Redis error, allow request but log warning
      logger.error("Bandwidth limiter Redis error", { error, identifier })
      next()
    }
  }
}

/**
 * Default bandwidth limiter instance
 */
export const bandwidthLimiter = createBandwidthLimiter()

/**
 * Strict bandwidth limiter for sensitive endpoints
 */
export const strictBandwidthLimiter = createBandwidthLimiter({
  maxBytesPerWindow: 10 * 1024 * 1024, // 10MB per window
  maxSingleRequestBytes: 1 * 1024 * 1024, // 1MB per request
  windowSeconds: 60,
})
