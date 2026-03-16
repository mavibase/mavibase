import type { Request, Response } from "express"
import * as authService from "@mavibase/platform/services/auth-service"
import * as tokenService from "@mavibase/platform/services/token-service"
import crypto from "crypto"
import { AuditLogService } from "@mavibase/platform/services/audit-log-service"

// Helper to determine if we're actually on HTTPS (not just production mode)
const isSecureContext = (req: Request): boolean => {
  const isProduction = process.env.NODE_ENV === "production"
  const host = req.hostname || req.headers.host || ""
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1")
  // Only set secure cookies if production AND not localhost
  return isProduction && !isLocalhost
}

const getCookieOptions = (req: Request, maxAge: number) => ({
  httpOnly: true,
  secure: isSecureContext(req),
  sameSite: isSecureContext(req) ? "none" as const : "lax" as const,
  maxAge,
})

export const register = async (req: Request, res: Response) => {
  try {
    let { email, password, username, metadata, firstname, lastname } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
        },
      })
    }

    // Autogenerate username if not provided
    if (!username) {
      const emailPrefix = email.split("@")[0]
      const randomNumbers = crypto.randomInt(100000, 1000000) // 6 digits
      username = `${emailPrefix}${randomNumbers}`
    }

    const result = await authService.registerUser({
      email,
      password,
      username,
      metadata,
      firstname,
      lastname,
      ip: req.clientIp,
      userAgent: req.get("user-agent"),
    })

    res.cookie("accessToken", result.accessToken, getCookieOptions(req, 15 * 60 * 1000)) // 15 minutes
    res.cookie("refreshToken", result.refreshToken, getCookieOptions(req, 7 * 24 * 60 * 60 * 1000)) // 7 days

    void AuditLogService.log({
      scope: "user",
      actorId: result.user?.id,
      targetId: result.user?.id,
      action: "auth.register",
      metadata: {
        actorType: "USER",
        message: `User ${result.user?.id} registered with email ${email}`,
        userId: result.user?.id,
        email,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email.",
      data: {
        user: result.user,
      },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "REGISTRATION_FAILED",
        message: error.message,
        details: error.details,
      },
    })
  }
}

export const login = async (req: Request, res: Response) => {
  let email: string | undefined
  let username: string | undefined
  try {
    const body = req.body || {}
    email = body.email
    username = body.username
    const password = body.password

    if ((!email && !username) || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email/username and password are required",
        },
      })
    }

    const result = await authService.loginUser({
      email,
      username,
      password,
      ip: req.clientIp,
      userAgent: req.get("user-agent"),
    })

    res.cookie("accessToken", result.accessToken, getCookieOptions(req, 15 * 60 * 1000)) // 15 minutes
    res.cookie("refreshToken", result.refreshToken, getCookieOptions(req, 7 * 24 * 60 * 60 * 1000)) // 7 days

    void AuditLogService.log({
      scope: "user",
      actorId: result.user?.id,
      targetId: result.user?.id,
      action: "auth.login",
      metadata: {
        actorType: "USER",
        message: `User ${result.user?.id} logged in`,
        userId: result.user?.id,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        requiresMFA: result.requiresMFA,
      },
    })
  } catch (error: any) {
    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.login.failed",
      metadata: {
        actorType: "SYSTEM",
        message: `Failed login attempt for ${email || username || "unknown"} from ${req.clientIp || "unknown ip"}`,
        email,
        username,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
        error: error?.code || error?.message,
      },
    })
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "LOGIN_FAILED",
        message: error.message,
        details: error.details,
      },
    })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken

    if (refreshToken) {
      await authService.logoutUser(refreshToken, req.userId!)
    }

    res.clearCookie("accessToken")
    res.clearCookie("refreshToken")

    void AuditLogService.log({
      scope: "user",
      actorId: req.userId!,
      targetId: req.userId!,
      action: "auth.logout",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} logged out`,
        userId: req.userId!,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Logout successful",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LOGOUT_FAILED",
        message: error.message,
      },
    })
  }
}

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Refresh token is required",
        },
      })
    }

    const result = await tokenService.refreshAccessToken(refreshToken, req.clientIp, req.get("user-agent"))

    res.cookie("accessToken", result.accessToken, getCookieOptions(req, 15 * 60 * 1000)) // 15 minutes
    res.cookie("refreshToken", result.refreshToken, getCookieOptions(req, 7 * 24 * 60 * 60 * 1000)) // 7 days

    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.token.refresh",
      metadata: {
        actorType: "SYSTEM",
        message: `Access token refreshed`,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Token refreshed successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 401).json({
      error: {
        code: error.code || "TOKEN_REFRESH_FAILED",
        message: error.message,
      },
    })
  }
}

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required",
        },
      })
    }

    await authService.requestPasswordReset(email)

    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.password_reset.request",
      metadata: {
        actorType: "SYSTEM",
        message: `Password reset requested for ${email}`,
        email,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "If the email exists, a password reset link has been sent",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "PASSWORD_RESET_FAILED",
        message: error.message,
      },
    })
  }
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Token and password are required",
        },
      })
    }

    await authService.resetPassword(token, password)

    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.password_reset.complete",
      metadata: {
        actorType: "SYSTEM",
        message: `Password reset completed`,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Password reset successful",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "PASSWORD_RESET_FAILED",
        message: error.message,
      },
    })
  }
}

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query

    if (!token) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Verification token is required",
        },
      })
    }

    await authService.verifyEmail(token as string)

    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.email.verify",
      metadata: {
        actorType: "SYSTEM",
        message: `Email verified`,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Email verified successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "EMAIL_VERIFICATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required",
        },
      })
    }

    await authService.resendVerificationEmail(email)

    void AuditLogService.log({
      scope: "system",
      actorId: null,
      targetId: null,
      action: "auth.email.verification.resend",
      metadata: {
        actorType: "SYSTEM",
        message: `Verification email resent to ${email}`,
        email,
        ip: req.clientIp,
        userAgent: req.get("user-agent"),
      },
    })

    res.json({
      success: true,
      message: "Verification email sent",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "RESEND_VERIFICATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies.accessToken
    const refreshToken = req.cookies.refreshToken

    if (accessToken) {
      try {
        const decoded = await tokenService.verifyAccessToken(accessToken)
        
        // Check if token verification returned null (invalid/blacklisted token)
        if (!decoded || !decoded.userId) {
          // Fall through to refresh logic below
          throw new Error("Invalid access token")
        }
        
        const user = await authService.getUserById(decoded.userId)

        if (!user) {
          return res.status(401).json({
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
          })
        }

        return res.json({
          success: true,
          data: {
            user,
          },
        })
      } catch (error) {
        // AccessToken is invalid/expired, fall through to refresh logic below
      }
    }

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: "NO_TOKEN",
          message: "No valid tokens found",
        },
      })
    }

    // Attempt to refresh the token
    try {
      const result = await tokenService.refreshAccessToken(refreshToken, req.clientIp, req.get("user-agent"))

      // Set new cookies
      res.cookie("accessToken", result.accessToken, getCookieOptions(req, 15 * 60 * 1000)) // 15 minutes
      res.cookie("refreshToken", result.refreshToken, getCookieOptions(req, 7 * 24 * 60 * 60 * 1000)) // 7 days

      // Get user data with the refreshed token
      const decoded = await tokenService.verifyAccessToken(result.accessToken)
      
      // Verify the freshly generated token is valid
      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "TOKEN_GENERATION_FAILED",
            message: "Failed to generate valid access token",
          },
        })
      }
      
      const user = await authService.getUserById(decoded.userId)

      return res.json({
        success: true,
        data: {
          user,
        },
      })
    } catch (refreshError: any) {
      // RefreshToken is also invalid
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "All tokens are invalid or expired",
        },
      })
    }
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: error.code || "TOKEN_INVALID",
        message: error.message || "Invalid or expired token",
      },
    })
  }
}
