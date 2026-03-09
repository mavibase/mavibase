import type { Request, Response, NextFunction } from "express"
import { trackEgress, calculateResponseSize, isEgressLimitExceeded, getEgressLimitGB } from "../services/egress-service"

/**
 * Middleware to track egress (outbound data) for API-key authenticated requests only.
 * Console/JWT authenticated requests are NOT tracked.
 * 
 * This middleware:
 * 1. Checks if the project has exceeded its egress limit (blocks request if exceeded)
 * 2. Intercepts responses and measures the response body size
 * 3. Records egress for billing and monitoring purposes
 */
export const egressTracker = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get identity from request (set by identityMiddleware)
    const identity = (req as any).identity

    // Only track egress for API-key (service) authenticated requests
    // Skip tracking for console users (JWT auth)
    if (!identity || identity.type !== "service") {
      return next()
    }

    const projectId = identity.project_id

    // Check egress limit before processing request
    if (projectId) {
      try {
        const limitExceeded = await isEgressLimitExceeded(projectId)
        if (limitExceeded) {
          return res.status(429).json({
            success: false,
            error: {
              code: "EGRESS_LIMIT",
              message: `Egress limit of ${getEgressLimitGB()}GB has been reached for this billing period. Please upgrade your plan or wait for the limit to reset.`
            }
          })
        }
      } catch (error) {
        // On error, allow request to proceed (don't block on egress check failure)
        console.error("[EgressTracker] Failed to check egress limit:", error)
      }
    }

    // Store original json and send methods
    const originalJson = res.json.bind(res)
    const originalSend = res.send.bind(res)

    // Get request metadata for tracking
    const apiKeyId = identity.api_key_id || null
    const endpoint = req.route?.path || req.path
    const method = req.method

    // Override res.json to intercept JSON responses
    res.json = function (body: any) {
      // Calculate response size
      const bytes = calculateResponseSize(body)

      // Track egress asynchronously (don't block response)
      if (bytes > 0 && projectId) {
        setImmediate(() => {
          trackEgress({
            projectId,
            apiKeyId,
            bytes,
            endpoint,
            method,
          }).catch(err => {
            console.error("[EgressTracker] Failed to track egress:", err)
          })
        })
      }

      return originalJson(body)
    }

    // Override res.send for non-JSON responses
    res.send = function (body: any) {
      // Only track if it's not already tracked via json()
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        const bytes = calculateResponseSize(body)

        if (bytes > 0 && projectId) {
          setImmediate(() => {
            trackEgress({
              projectId,
              apiKeyId,
              bytes,
              endpoint,
              method,
            }).catch(err => {
              console.error("[EgressTracker] Failed to track egress:", err)
            })
          })
        }
      }

      return originalSend(body)
    }

    next()
  }
}
