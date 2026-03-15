import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

// Patterns that may contain sensitive data
const SENSITIVE_PATTERNS = [
  /password[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /secret[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /token[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /api[_-]?key[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /authorization[=:]\s*['"]?[^'"\s]+['"]?/gi,
]

// Sanitize error messages to remove sensitive data
const sanitizeMessage = (message: string | undefined): string => {
  if (!message) return "Unknown error"
  
  let sanitized = message
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]")
  }
  return sanitized
}

// Sanitize stack traces in production
const sanitizeStack = (stack: string | undefined): string | undefined => {
  if (!stack) return undefined
  if (process.env.NODE_ENV === "production") {
    return undefined // Don't log stack traces in production
  }
  return sanitizeMessage(stack)
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error occurred", {
    requestId: req.requestId,
    error: sanitizeMessage(err.message),
    stack: sanitizeStack(err.stack),
    path: req.path,
    method: req.method,
  })

  const statusCode = err.statusCode || 500
  const errorCode = err.code || "INTERNAL_SERVER_ERROR"

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.message || "An unexpected error occurred",
      details: err.details || {},
      requestId: req.requestId,
    },
  })
}
