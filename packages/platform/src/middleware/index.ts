import type { Express } from "express"
import express from "express"
import helmet from "helmet"
import cors from "cors"
import { rateLimiter } from "./rate-limiter"
import { requestLogger } from "./request-logger"
import { requestId } from "./request-id"
import cookieParser from "cookie-parser"
import { attachClientIp } from "./ip-middleware"
import { httpsEnforcement, securityHeaders, contentSecurityPolicy } from "./security-headers"
import { contentTypeValidator } from "./content-type-validator"
import { idempotencyMiddleware } from "./idempotency"
import { bandwidthLimiter } from "./bandwidth-limiter"

/**
 * Unified middleware setup for both platform and database services
 * Handles CORS, security headers, body parsing, and cookies
 */
export const setupMiddleware = (app: Express) => {
  // HTTPS enforcement (must be first - redirects HTTP to HTTPS in production)
  app.use(httpsEnforcement)
  
  app.use(requestId)
  app.use(attachClientIp)
  app.use(requestLogger)
  
  // Parse ALLOWED_ORIGINS into an array if it contains commas
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ["http://localhost:3000"]
  
  // CORS configuration - apply to all routes
  // maxAge: Browser caches preflight response for 24 hours (reduces OPTIONS requests)
  const corsMaxAge = parseInt(process.env.CORS_MAX_AGE || "86400", 10)
  
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Project-Id", "X-Request-Id", "X-API-Key", "X-Team-Id", "Idempotency-Key"],
      exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
      maxAge: corsMaxAge, // Preflight cache duration in seconds (default: 24 hours)
    }),
  )

  // Security headers (helmet + custom HSTS/CSP)
  app.use(helmet())
  app.use(securityHeaders)
  app.use(contentSecurityPolicy)

  // Content-Type validation (before body parsing to reject invalid types early)
  app.use(contentTypeValidator)

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }))
  app.use(express.urlencoded({ extended: true }))

  // Cookie parser for session-based authentication
  app.use(cookieParser())

  // Rate limiting (request count based)
  app.use(rateLimiter)

  // Bandwidth limiting (bytes based - prevents large payload attacks)
  app.use(bandwidthLimiter)

  // Idempotency middleware for request deduplication
  // Must be after rate limiting to prevent caching rate-limited responses
  app.use(idempotencyMiddleware)
}
