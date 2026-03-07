import type { Express } from "express"
import express from "express"
import helmet from "helmet"
import cors from "cors"
import { rateLimiter } from "./rate-limiter"
import { requestLogger } from "./request-logger"
import { requestId } from "./request-id"
import cookieParser from "cookie-parser"
import { attachClientIp } from "./ip-middleware"

/**
 * Unified middleware setup for both platform and database services
 * Handles CORS, security headers, body parsing, and cookies
 */
export const setupMiddleware = (app: Express) => {
  app.use(requestId)
  app.use(attachClientIp)
  app.use(requestLogger)
  
  // Parse ALLOWED_ORIGINS into an array if it contains commas
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ["http://localhost:3000"]
  
  // CORS configuration - apply to all routes
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }),
  )

  // Security headers
  app.use(helmet())

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }))
  app.use(express.urlencoded({ extended: true }))

  // Cookie parser for session-based authentication
  app.use(cookieParser())

  // Rate limiting
  app.use(rateLimiter)
}
