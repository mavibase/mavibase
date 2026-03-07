import { pool } from "../config/database"
import { verifyPassword } from "./password-service"
import crypto from "crypto"

// TOTP implementation using crypto module
const base32Encode = (buffer: Buffer): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  let output = ""

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

const base32Decode = (input: string): Buffer => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < input.length; i++) {
    const idx = alphabet.indexOf(input[i].toUpperCase())
    if (idx === -1) continue

    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

const generateTOTP = (secret: string, window = 0): string => {
  const time = Math.floor(Date.now() / 1000 / 30) + window
  const buffer = Buffer.alloc(8)
  buffer.writeBigInt64BE(BigInt(time))

  const secretBuffer = base32Decode(secret)
  const hmac = crypto.createHmac("sha1", secretBuffer)
  hmac.update(buffer)
  const hash = hmac.digest()

  const offset = hash[hash.length - 1] & 0xf
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  return (code % 1000000).toString().padStart(6, "0")
}

const verifyTOTP = (token: string, secret: string): boolean => {
  // Check current window and 1 window before/after for clock skew
  for (let window = -1; window <= 1; window++) {
    if (generateTOTP(secret, window) === token) {
      return true
    }
  }
  return false
}

export const generateMFASecret = async (userId: string) => {
  const secret = base32Encode(crypto.randomBytes(20))
  const user = await pool.query("SELECT email FROM platform_users WHERE id = $1", [userId])

  if (user.rows.length === 0) {
    throw new Error("User not found")
  }

  const otpauth = `otpauth://totp/Mavibase:${encodeURIComponent(user.rows[0].email)}?secret=${secret}&issuer=Mavibase`
  
  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString("hex"))

  // Store the secret temporarily (not enabled yet)
  await pool.query(
    `INSERT INTO mfa_secrets (user_id, secret, backup_codes, enabled) 
     VALUES ($1, $2, $3, false)
     ON CONFLICT (user_id) 
     DO UPDATE SET secret = $2, backup_codes = $3, enabled = false`,
    [userId, secret, JSON.stringify(backupCodes)],
  )

  return { secret, otpauth, backupCodes }
}

export const verifyAndEnableMFA = async (userId: string, token: string) => {
  const result = await pool.query("SELECT secret FROM mfa_secrets WHERE user_id = $1", [userId])

  if (result.rows.length === 0) {
    throw {
      statusCode: 400,
      code: "MFA_NOT_SETUP",
      message: "MFA has not been set up",
    }
  }

  const secret = result.rows[0].secret
  const isValid = verifyTOTP(token, secret)

  if (!isValid) {
    throw {
      statusCode: 400,
      code: "INVALID_TOKEN",
      message: "Invalid MFA token",
    }
  }

  // Enable MFA
  await pool.query("UPDATE mfa_secrets SET enabled = true WHERE user_id = $1", [userId])
  await pool.query("UPDATE platform_users SET mfa_enabled = true WHERE id = $1", [userId])
}

export const disableMFA = async (userId: string, password: string) => {
  const userResult = await pool.query("SELECT password_hash FROM platform_users WHERE id = $1", [userId])

  if (userResult.rows.length === 0) {
    throw new Error("User not found")
  }

  const isValid = await verifyPassword(password, userResult.rows[0].password_hash)

  if (!isValid) {
    throw {
      statusCode: 401,
      code: "INVALID_PASSWORD",
      message: "Invalid password",
    }
  }

  await pool.query("UPDATE mfa_secrets SET enabled = false WHERE user_id = $1", [userId])
  await pool.query("UPDATE platform_users SET mfa_enabled = false WHERE id = $1", [userId])
}

export const verifyMFAToken = async (userId: string, token: string): Promise<boolean> => {
  const result = await pool.query("SELECT secret, enabled FROM mfa_secrets WHERE user_id = $1", [userId])

  if (result.rows.length === 0 || !result.rows[0].enabled) {
    return false
  }

  const secret = result.rows[0].secret
  return verifyTOTP(token, secret)
}

export const generateRecoveryCodes = async (userId: string): Promise<string[]> => {
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString("hex"))

  await pool.query("UPDATE mfa_secrets SET backup_codes = $1 WHERE user_id = $2", [JSON.stringify(codes), userId])

  return codes
}

export const verifyRecoveryCode = async (userId: string, code: string): Promise<boolean> => {
  const result = await pool.query("SELECT backup_codes FROM mfa_secrets WHERE user_id = $1 AND enabled = true", [
    userId,
  ])

  if (result.rows.length === 0) {
    return false
  }

  const backupCodes = JSON.parse(result.rows[0].backup_codes || "[]")
  const index = backupCodes.indexOf(code)

  if (index === -1) {
    return false
  }

  // Remove used code
  backupCodes.splice(index, 1)
  await pool.query("UPDATE mfa_secrets SET backup_codes = $1 WHERE user_id = $2", [JSON.stringify(backupCodes), userId])

  return true
}
