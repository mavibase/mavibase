import { pool } from "../config/database"
import { v4 as uuidv4 } from "uuid"
import crypto from "crypto"

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export const createSession = async (data: {
  userId: string
  accessToken: string
  refreshToken: string
  ipAddress?: string
  userAgent?: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}) => {
  const { userId, accessToken, refreshToken, ipAddress, userAgent, accessTokenExpiresAt, refreshTokenExpiresAt } = data

  const sessionId = uuidv4()

  const accessTokenHash = hashToken(accessToken)
  const refreshTokenHash = hashToken(refreshToken)

  const result = await pool.query(
    `INSERT INTO sessions (
      id, user_id, access_token_hash, refresh_token_hash,
      ip_address, user_agent,
      access_token_expires_at, refresh_token_expires_at,
      created_at, last_used_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id, user_id, ip_address, user_agent, access_token_expires_at, refresh_token_expires_at, created_at`,
    [
      sessionId,
      userId,
      accessTokenHash,
      refreshTokenHash,
      ipAddress,
      userAgent,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    ],
  )

  return result.rows[0]
}

export const getSessionByRefreshToken = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken)

  const result = await pool.query(
    `SELECT * FROM sessions 
     WHERE refresh_token_hash = $1 
     AND revoked = false 
     AND refresh_token_expires_at > NOW()`,
    [tokenHash],
  )

  return result.rows[0] || null
}

export const getUserSessions = async (userId: string) => {
  const result = await pool.query(
    `SELECT id, ip_address, user_agent, access_token_expires_at, refresh_token_expires_at, revoked, created_at, last_used_at
     FROM sessions 
     WHERE user_id = $1 AND revoked = false AND refresh_token_expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId],
  )

  return result.rows
}

export const revokeSession = async (sessionId: string, userId: string) => {
  const result = await pool.query(
    `UPDATE sessions 
     SET revoked = true, revoked_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [sessionId, userId],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 404,
      code: "SESSION_NOT_FOUND",
      message: "Session not found",
    }
  }

  return result.rows[0]
}

export const revokeAllUserSessions = async (userId: string, exceptSessionId?: string) => {
  let query = `UPDATE sessions 
               SET revoked = true, revoked_at = NOW()
               WHERE user_id = $1 AND revoked = false`
  const params: any[] = [userId]

  if (exceptSessionId) {
    query += ` AND id != $2`
    params.push(exceptSessionId)
  }

  await pool.query(query, params)
}

export const revokeSessionByRefreshToken = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken)

  await pool.query(
    `UPDATE sessions 
     SET revoked = true, revoked_at = NOW()
     WHERE refresh_token_hash = $1`,
    [tokenHash],
  )
}

export const cleanupExpiredSessions = async () => {
  const result = await pool.query(`DELETE FROM sessions WHERE refresh_token_expires_at < NOW() - INTERVAL '7 days'`)

  return result.rowCount || 0
}

export const updateSessionLastUsed = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken)

  await pool.query(`UPDATE sessions SET last_used_at = NOW() WHERE refresh_token_hash = $1`, [tokenHash])
}
