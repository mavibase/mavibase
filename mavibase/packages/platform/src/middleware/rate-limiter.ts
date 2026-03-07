import rateLimit from "express-rate-limit"
import type { Request, Response } from "express"
import { logger } from "../utils/logger"

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000") // 15 minutes default
const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000")

export const rateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development",
  handler: (req: Request, res: Response) => {
    logger.warn("Rate limit exceeded", { ip: req.ip, path: req.path })
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
        details: {
          retryAfter: `${Math.ceil(windowMs / 60000)} minutes`,
        },
      },
    })
  },
})

// Stricter rate limit for sensitive endpoints (auth)
const maxLoginAttempts = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5")
const lockoutDuration = Number.parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || "15")

export const authRateLimiter = rateLimit({
  windowMs: lockoutDuration * 60 * 1000,
  max: maxLoginAttempts,
  skipSuccessfulRequests: true,
  skip: (req) => process.env.NODE_ENV === "development",
  message: {
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later",
    },
  },
  handler: (req: Request, res: Response) => {
    logger.warn("Auth rate limit exceeded", { ip: req.ip, path: req.path })
    res.status(429).json({
      error: {
        code: "AUTH_RATE_LIMIT_EXCEEDED",
        message: "Too many authentication attempts, please try again later",
        details: {
          retryAfter: `${lockoutDuration} minutes`,
        },
      },
    })
  },
})
