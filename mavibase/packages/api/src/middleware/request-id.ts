import type { Request, Response, NextFunction } from "express"
import { randomUUID } from "crypto"

// Add request ID to all requests for distributed tracing
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if request already has an ID (from load balancer/proxy)
  const requestId = (req.headers["x-request-id"] as string) || randomUUID()

  // Store in request
  req.id = requestId

  // Add to response headers for client tracking
  res.setHeader("X-Request-Id", requestId)

  next()
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string
    }
  }
}
