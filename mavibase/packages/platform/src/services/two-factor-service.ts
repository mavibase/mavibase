import { pool } from "../config/database"
import { hashPassword, verifyPassword } from "./password-service"
import { send2FACodeEmail } from "./email-service"
import crypto from "crypto"

const CODE_LENGTH = Number.parseInt(process.env.TWO_FA_CODE_LENGTH || "6")
const CODE_EXPIRY_MINUTES = Number.parseInt(process.env.TWO_FA_CODE_EXPIRY_MINUTES || "10")

export const generate2FACode = (): string => {
  // Generate code with configurable length
  const min = Math.pow(10, CODE_LENGTH - 1)
  const max = Math.pow(10, CODE_LENGTH) - 1
  return crypto.randomInt(min, max).toString()
}

export const send2FACode = async (
  userId: string,
  email: string,
  userName: string,
  purpose: "login" | "setup" | "disable" = "login",
): Promise<void> => {
  const code = generate2FACode()
  const codeHash = await hashPassword(code)

  // Invalidate any existing unused codes for this user and purpose
  await pool.query(
    `UPDATE two_factor_codes 
     SET used_at = NOW() 
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()`,
    [userId, purpose],
  )

  // Store new code (expires based on configuration)
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

  await pool.query(
    `INSERT INTO two_factor_codes (user_id, code, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, code, codeHash, purpose, expiresAt],
  )

  // Send email
  await send2FACodeEmail(email, code, userName)
}

export const verify2FACode = async (
  userId: string,
  code: string,
  purpose: "login" | "setup" | "disable" = "login",
): Promise<boolean> => {
  // Get the most recent unused code for this user and purpose
  const result = await pool.query(
    `SELECT id, code_hash, attempts, max_attempts, expires_at
     FROM two_factor_codes
     WHERE user_id = $1 
       AND purpose = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose],
  )

  if (result.rows.length === 0) {
    return false
  }

  const record = result.rows[0]

  // Check if max attempts exceeded
  if (record.attempts >= record.max_attempts) {
    return false
  }

  // Increment attempts
  await pool.query(`UPDATE two_factor_codes SET attempts = attempts + 1 WHERE id = $1`, [record.id])

  // Verify code
  const isValid = await verifyPassword(code, record.code_hash)

  if (isValid) {
    // Mark as used
    await pool.query(`UPDATE two_factor_codes SET used_at = NOW() WHERE id = $1`, [record.id])
    return true
  }

  return false
}

export const enable2FA = async (userId: string): Promise<void> => {
  await pool.query(
    `UPDATE platform_users 
     SET two_factor_enabled = true, updated_at = NOW() 
     WHERE id = $1`,
    [userId],
  )
}

export const disable2FA = async (userId: string): Promise<void> => {
  await pool.query(
    `UPDATE platform_users 
     SET two_factor_enabled = false, updated_at = NOW() 
     WHERE id = $1`,
    [userId],
  )
}

export const is2FAEnabled = async (userId: string): Promise<boolean> => {
  const result = await pool.query(`SELECT two_factor_enabled FROM platform_users WHERE id = $1`, [userId])

  return result.rows[0]?.two_factor_enabled || false
}

// Cleanup expired codes (should be run as a cron job)
export const cleanupExpired2FACodes = async (): Promise<number> => {
  const result = await pool.query(
    `DELETE FROM two_factor_codes 
     WHERE expires_at < NOW() OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours')`,
  )

  return result.rowCount || 0
}
