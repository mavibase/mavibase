import type { Request, Response, NextFunction } from "express"
import * as identityService from "../services/identity-service"
import type { IdentityContext } from "../types/identity"

// Extend Express Request to include identity context
declare global {
  namespace Express {
    interface Request {
      identity?: IdentityContext
    }
  }
}

/**
 * Middleware to extract and validate identity from Authorization header OR cookies
 * Supports both JWT tokens (Bearer <token>) and API keys
 * Sets req.identity with the authenticated context
 */
export const identityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let authorization = req.get("Authorization")

    // Fallback to cookies if Authorization header is not present
    if (!authorization && req.cookies?.accessToken) {
      authorization = `Bearer ${req.cookies.accessToken}`
    }

    if (!authorization) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization header required. Provide JWT token or API key via: Authorization: Bearer <token|apikey>",
        },
      })
    }

    // Read optional project/team context from headers
    const requestedProjectId = req.get("X-Project-Id") || undefined
    const requestedTeamId = req.get("X-Team-Id") || undefined

    // Validate identity (handles both JWT and API keys)
    const identity = await identityService.validateIdentity(authorization, {
      requestedProjectId,
      requestedTeamId,
    })

    if (!identity) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid or expired credentials",
        },
      })
    }

    // Attach identity context to request
    req.identity = identity

    next()
  } catch (error: any) {
    // Handle explicit 403 from identity service (authenticated but not authorized for team/project)
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: {
          code: error.code || "FORBIDDEN",
          message: error.message || "You do not have access to this resource",
        },
      })
    }

    console.error("Identity middleware error:", error)
    res.status(500).json({
      success: false,
      error: {
        code: "IDENTITY_VALIDATION_FAILED",
        message: error.message || "Failed to validate identity",
      },
    })
  }
}

/**
 * Optional identity middleware - doesn't fail if no auth provided
 * Useful for endpoints that work with or without authentication
 */
export const optionalIdentityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorization = req.get("Authorization")

    if (authorization) {
      const identity = await identityService.validateIdentity(authorization)
      if (identity) {
        req.identity = identity
      }
    }

    next()
  } catch (error: any) {
    // Don't fail on optional middleware errors

    next()
  }
}
