import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../services/token-service"
import { getUserById } from "../services/auth-service"
import { getSessionByAccessToken } from "../services/session-service"
import { AuditLogService } from "../services/audit-log-service"

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken

    if (!token) {
      void AuditLogService.log({
        scope: "system",
        actorId: null,
        targetId: null,
        action: "security.unauthorized",
        metadata: {
          actorType: "SYSTEM",
          message: `Unauthorized request (missing access token) to ${req.method} ${req.path}`,
          reason: "MISSING_ACCESS_TOKEN",
          method: req.method,
          path: req.path,
          ip: (req as any).clientIp,
          userAgent: req.get("user-agent"),
        },
      })
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
      void AuditLogService.log({
        scope: "system",
        actorId: null,
        targetId: null,
        action: "security.unauthorized",
        metadata: {
          actorType: "SYSTEM",
          message: `Unauthorized request (invalid token) to ${req.method} ${req.path}`,
          reason: "INVALID_TOKEN",
          method: req.method,
          path: req.path,
          ip: (req as any).clientIp,
          userAgent: req.get("user-agent"),
        },
      })
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "Token is invalid or expired",
        },
      })
    }

    const user = await getUserById(decoded.userId)

    if (!user || user.status === "suspended") {
      void AuditLogService.log({
        scope: "system",
        actorId: decoded.userId,
        targetId: decoded.userId,
        action: "security.unauthorized",
        metadata: {
          actorType: "SYSTEM",
          message: `Unauthorized request (user suspended) to ${req.method} ${req.path}`,
          reason: "USER_SUSPENDED",
          userId: decoded.userId,
          method: req.method,
          path: req.path,
          ip: (req as any).clientIp,
          userAgent: req.get("user-agent"),
        },
      })
      return res.status(401).json({
        error: {
          code: "USER_SUSPENDED",
          message: "User account is suspended",
        },
      })
    }

    req.user = user
    req.userId = user.id

    // Attach current session ID for session management
    const session = await getSessionByAccessToken(token)
    if (session) {
      req.sessionId = session.id
    }

    next()
  } catch (error: any) {
    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "security.unauthorized",
      metadata: {
        actorType: "SYSTEM",
        message: `Authentication failed for ${req.method} ${req.path}`,
        reason: "AUTHENTICATION_FAILED",
        method: req.method,
        path: req.path,
        ip: (req as any).clientIp,
        userAgent: req.get("user-agent"),
        error: error?.message,
      },
    })
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
      void AuditLogService.log({
        scope: "system",
        actorId: null,
        targetId: null,
        action: "security.unauthorized",
        metadata: {
          actorType: "SYSTEM",
          message: `Unauthorized request (no user) to ${req.method} ${req.path}`,
          reason: "NO_USER",
          method: req.method,
          path: req.path,
          ip: (req as any).clientIp,
          userAgent: req.get("user-agent"),
        },
      })
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })
    }

    if (!roles.includes(req.user.role)) {
      void AuditLogService.log({
        scope: "system",
        actorId: req.user.id,
        targetId: req.user.id,
        action: "security.forbidden",
        metadata: {
          actorType: "SYSTEM",
          message: `Forbidden request by user ${req.user.id} to ${req.method} ${req.path}`,
          reason: "INSUFFICIENT_PERMISSIONS",
          method: req.method,
          path: req.path,
          requiredRoles: roles,
          currentRole: req.user.role,
          ip: (req as any).clientIp,
          userAgent: req.get("user-agent"),
        },
      })
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
