import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../services/token-service"
import { getUserById } from "../services/auth-service"

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken

    if (!token) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing access token",
          details: {
            hint: "Please login to continue",
          },
        },
      })
    }

    const decoded = await verifyAccessToken(token)

    if (!decoded) {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "Token is invalid or expired",
        },
      })
    }

    const user = await getUserById(decoded.userId)

    if (!user || user.status === "suspended") {
      return res.status(401).json({
        error: {
          code: "USER_SUSPENDED",
          message: "User account is suspended",
        },
      })
    }

    req.user = user
    req.userId = user.id

    next()
  } catch (error: any) {
    return res.status(401).json({
      error: {
        code: "AUTHENTICATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
          details: {
            required: roles,
            current: req.user.role,
          },
        },
      })
    }

    next()
  }
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken

    if (token) {
      const decoded = await verifyAccessToken(token)

      if (decoded) {
        const user = await getUserById(decoded.userId)
        if (user && user.status !== "suspended") {
          req.user = user
          req.userId = user.id
        }
      }
    }

    next()
  } catch (error) {
    next()
  }
}
