import jwt from "jsonwebtoken"
import { redis } from "../config/redis"
import { createSession } from "./session-service"

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "access-secret-key"
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "refresh-secret-key"
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m"
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRES_IN || process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d"

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
    // Check if token is blacklisted
    const blacklisted = await redis.get(`blacklist:${token}`)
    if (blacklisted) {
      return null
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET)
    return decoded
  } catch {
    return null
  }
}

export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET)
  } catch {
    return null
  }
}

export const refreshAccessToken = async (refreshToken: string, ip?: string, userAgent?: string) => {
  const decoded = verifyRefreshToken(refreshToken)

  if (!decoded || decoded.type !== "refresh") {
    throw {
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Invalid refresh token",
    }
  }

  // Verify refresh token exists in Redis
  const storedToken = await redis.get(`refresh_token:${decoded.userId}`)
  if (storedToken !== refreshToken) {
    throw {
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token not found or expired",
    }
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(decoded.userId)
  const newRefreshToken = generateRefreshToken(decoded.userId)

  const accessTokenExpiresAt = new Date(Date.now() + parseExpiryToMs(ACCESS_TOKEN_EXPIRY))
  const refreshTokenExpiresAt = new Date(Date.now() + parseExpiryToMs(REFRESH_TOKEN_EXPIRY))

  await createSession({
    userId: decoded.userId,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    ipAddress: ip,
    userAgent,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  })

  // Store new refresh token
  await redis.set(`refresh_token:${decoded.userId}`, newRefreshToken, {
    EX: Math.floor(parseExpiryToMs(REFRESH_TOKEN_EXPIRY) / 1000),
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  }
}
