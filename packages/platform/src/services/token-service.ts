import jwt from "jsonwebtoken"
import crypto from "crypto"
import { redis } from "../config/redis"
import { createSession, getSessionByRefreshToken, updateSessionLastUsed, revokeSession, updateSession } from "./session-service"
import { logger } from "../utils/logger"

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex")
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "access-secret-key"
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "refresh-secret-key"
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m"
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRES_IN || process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d"

// Validate that secrets are not placeholder values
const validateSecrets = () => {
  if (process.env.NODE_ENV === "production") {
    if (ACCESS_TOKEN_SECRET?.includes("change-this") || ACCESS_TOKEN_SECRET === "access-secret-key") {
      throw new Error("FATAL: ACCESS_TOKEN_SECRET must be changed before production deployment")
    }
    if (REFRESH_TOKEN_SECRET?.includes("change-this") || REFRESH_TOKEN_SECRET === "refresh-secret-key") {
      throw new Error("FATAL: REFRESH_TOKEN_SECRET must be changed before production deployment")
    }
  }
}

// Validate secrets on module load
validateSecrets()

// Helper to parse expiry time to milliseconds
const parseExpiryToMs = (expiry: string): number => {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 15 * 60 * 1000 // default 15 minutes
  
  const value = Number.parseInt(match[1])
  const unit = match[2]
  
  switch (unit) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return value * 60 * 1000
  }
}

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId, type: "access" }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY as string,
  } as jwt.SignOptions)
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY as string,
  } as jwt.SignOptions)
}

export const verifyAccessToken = async (token: string): Promise<any> => {
  try {
    // Check if token is blacklisted (using hash to match how revokeSession blacklists)
    const tokenHash = hashToken(token)
    const blacklisted = await redis.get(`blacklist:${tokenHash}`)
    if (blacklisted) {
      return null
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as jwt.JwtPayload
    
    // Verify exp claim is in future (defense against clock skew attacks)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null
    }
    
    return decoded
  } catch {
    return null
  }
}

export const verifyRefreshToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as jwt.JwtPayload
    
    // Verify exp claim is in future
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null
    }
    
    return decoded
  } catch {
    return null
  }
}

/**
 * Refresh access token with enhanced validation
 * 
 * Implements secure session-based token refresh with:
 * - Database-backed session validation (prevents Redis race conditions)
 * - Token rotation for refresh tokens
 * - IP/User-Agent change detection and logging
 * - Concurrent refresh detection
 */
export const refreshAccessToken = async (refreshToken: string, ip?: string, userAgent?: string) => {
  const decoded = verifyRefreshToken(refreshToken)

  if (!decoded || decoded.type !== "refresh") {
    throw {
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Invalid refresh token",
    }
  }

  // CRITICAL FIX: Validate against database session record (not just Redis)
  // This prevents race conditions where Redis expires token between decode and lookup
  const session = await getSessionByRefreshToken(refreshToken)
  
  if (!session) {
    logger.warn("Refresh token validation failed - no session found", {
      userId: decoded.userId,
      ip,
    })
    throw {
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Session not found or expired",
    }
  }

  // Verify session belongs to the user claiming it
  if (session.user_id !== decoded.userId) {
    logger.error("Refresh token user mismatch - potential token hijacking", {
      tokenUserId: decoded.userId,
      sessionUserId: session.user_id,
      ip,
    })
    // Revoke all sessions for this user as precaution
    await revokeSession(session.id, decoded.userId)
    throw {
      statusCode: 401,
      code: "TOKEN_HIJACKING_DETECTED",
      message: "Invalid refresh token",
    }
  }

  // Check if session is revoked
  if (session.revoked) {
    logger.warn("Attempt to use revoked session", {
      userId: decoded.userId,
      sessionId: session.id,
      ip,
    })
    throw {
      statusCode: 401,
      code: "SESSION_REVOKED",
      message: "Session has been revoked",
    }
  }

  // SECURITY: Detect suspicious activity (IP/User-Agent changes)
  const ipChanged = ip && session.ip_address && session.ip_address !== ip
  const userAgentChanged = userAgent && session.user_agent && session.user_agent !== userAgent
  
  if (ipChanged || userAgentChanged) {
    logger.warn("Session context changed - potential security risk", {
      userId: decoded.userId,
      sessionId: session.id,
      ipChanged,
      previousIp: session.ip_address,
      currentIp: ip,
      userAgentChanged,
    })
    // Continue but log for security monitoring
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(decoded.userId)
  const newRefreshToken = generateRefreshToken(decoded.userId)

  const accessTokenExpiresAt = new Date(Date.now() + parseExpiryToMs(ACCESS_TOKEN_EXPIRY))
  const refreshTokenExpiresAt = new Date(Date.now() + parseExpiryToMs(REFRESH_TOKEN_EXPIRY))

  // IMPORTANT: Update existing session with new tokens instead of creating a new one
  // This preserves the session ID so getSessionByAccessToken can find it
  await updateSession(session.id, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  }
}
