import { pool } from "../config/database"
import { hashPassword, verifyPassword } from "./password-service"
import { generateAccessToken, generateRefreshToken } from "./token-service"
import { createSession, revokeSessionByRefreshToken } from "./session-service"
import { v4 as uuidv4 } from "uuid"
import { sendVerificationEmail, sendPasswordResetEmail } from "./email-service"
import { redis } from "../config/redis"
import { createPersonalTeam } from "./team-service"
import { createPersonalProject } from "./project-service"
import crypto from "crypto"

// Default avatar URLs for new users
const AVATAR_URLS = [
  "https://api.dicebear.com/9.x/glass/svg?seed=Kane",
  "https://api.dicebear.com/9.x/glass/svg?seed=Alejandrin",
  "https://api.dicebear.com/9.x/glass/svg?seed=Derek",
  "https://api.dicebear.com/9.x/glass/svg?seed=Zoie",
  "https://api.dicebear.com/9.x/glass/svg?seed=Amie",
  "https://api.dicebear.com/9.x/glass/svg?seed=Yesenia",
]

const getRandomAvatarUrl = () => AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)]

export const getUserById = async (userId: string) => {
  const result = await pool.query(
    `SELECT id, email, name, email_verified, status, default_team_id, selected_team_id, selected_project_id, avatar_url, created_at, last_login_at 
     FROM platform_users 
     WHERE id = $1`,
    [userId],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found",
    }
  }

  return result.rows[0]
}

export const registerUser = async (data: {
  email: string
  password: string
  username?: string
  metadata?: any
  ip?: string
  userAgent?: string
  firstname?: string
  lastname?: string
}) => {
  const { email, password, username, metadata, ip, userAgent, firstname, lastname } = data

  // Check if user already exists
  const existingUser = await pool.query("SELECT id FROM platform_users WHERE email = $1", [email])

  if (existingUser.rows.length > 0) {
    throw {
      statusCode: 400,
      code: "USER_ALREADY_EXISTS",
      message: "User with this email already exists",
    }
  }

  const hashedPassword = await hashPassword(password)
  const userId = uuidv4()
  const teamName = username || email.split("@")[0]

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Create user
    const name = [firstname, lastname].filter(Boolean).join(" ").trim() || teamName
    
    // Auto-verify email if email service is disabled
    const emailServiceEnabled = process.env.ENABLE_EMAIL_SERVICE === "true"
    const emailVerified = !emailServiceEnabled
    
    // Assign a random avatar
    const avatarUrl = getRandomAvatarUrl()

    const userResult = await client.query(
      `INSERT INTO platform_users (
      id, email, password_hash, name, username, firstname, lastname, email_verified, status, avatar_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING id, email, name, username, firstname, lastname, email_verified, status, avatar_url, created_at`,
      [userId, email, hashedPassword, name, username || null, firstname || null, lastname || null, emailVerified, avatarUrl],
    )

    const user = userResult.rows[0]

    const personalTeam = await createPersonalTeam(userId, teamName, client)

    // User will manually create their first project
    await client.query(
      `UPDATE platform_users SET default_team_id = $1, selected_team_id = $1, selected_project_id = NULL WHERE id = $2`,
      [personalTeam.id, userId],
    )

    await client.query("COMMIT")

    // Send verification email only if email service is enabled
    if (emailServiceEnabled) {
      await sendVerificationEmail(email, user.id)
    }

    // Generate tokens
    const accessToken = generateAccessToken(userId)
    const refreshToken = generateRefreshToken(userId)

    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await createSession({
      userId,
      accessToken,
      refreshToken,
      ipAddress: ip,
      userAgent,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })

    await redis.set(`refresh_token:${userId}`, refreshToken, { EX: 7 * 24 * 60 * 60 })

    return {
      user: {
        ...user,
        default_team_id: personalTeam.id,
        selected_team_id: personalTeam.id,
        selected_project_id: null,
      },
      team: personalTeam,
      accessToken,
      refreshToken,
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export const loginUser = async (data: {
  email?: string
  username?: string
  password: string
  ip?: string
  userAgent?: string
}) => {
  const { email, username, password, ip, userAgent } = data

  const query = "SELECT * FROM platform_users WHERE email = $1"
  const value = email

  const result = await pool.query(query, [value])

  if (result.rows.length === 0) {
    throw {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    }
  }

  const user = result.rows[0]

  if (user.status === "suspended") {
    throw {
      statusCode: 403,
      code: "USER_SUSPENDED",
      message: "Your account has been suspended",
    }
  }

  const isValid = await verifyPassword(password, user.password_hash)

  if (!isValid) {
    throw {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    }
  }

  // Update last login
  await pool.query("UPDATE platform_users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2", [ip, user.id])

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)

  const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await createSession({
    userId: user.id,
    accessToken,
    refreshToken,
    ipAddress: ip,
    userAgent,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  })

  await redis.set(`refresh_token:${user.id}`, refreshToken, { EX: 7 * 24 * 60 * 60 })

  delete user.password_hash

  return {
    user,
    accessToken,
    refreshToken,
    requiresMFA: user.mfa_enabled || false,
  }
}

export const logoutUser = async (refreshToken: string, userId: string) => {
  await revokeSessionByRefreshToken(refreshToken)
  await redis.del(`refresh_token:${userId}`)
}

export const requestPasswordReset = async (email: string) => {
  const result = await pool.query("SELECT id FROM platform_users WHERE email = $1", [email])

  if (result.rows.length === 0) {
    return
  }

  const userId = result.rows[0].id
  const resetToken = uuidv4()
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex")

  await pool.query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
    [userId, tokenHash],
  )

  await sendPasswordResetEmail(email, resetToken)
}

export const resetPassword = async (token: string, newPassword: string) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  
  const result = await pool.query(
    "SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL",
    [tokenHash],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 400,
      code: "INVALID_TOKEN",
      message: "Invalid or expired reset token",
    }
  }

  const userId = result.rows[0].user_id
  const hashedPassword = await hashPassword(newPassword)

  await pool.query("UPDATE platform_users SET password_hash = $1 WHERE id = $2", [hashedPassword, userId])

  await pool.query("UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1", [tokenHash])
}

export const verifyEmail = async (token: string) => {


  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")


  const checkToken = await pool.query(
    "SELECT user_id, expires_at, verified_at FROM email_verifications WHERE token_hash = $1",
    [tokenHash],
  )


  if (checkToken.rows.length > 0) {
    console.log("Token details:", {
      userId: checkToken.rows[0].user_id,
      expiresAt: checkToken.rows[0].expires_at,
      verifiedAt: checkToken.rows[0].verified_at,
      isExpired: new Date(checkToken.rows[0].expires_at) < new Date(),
      alreadyVerified: checkToken.rows[0].verified_at !== null,
    })
  }

  const result = await pool.query(
    "UPDATE email_verifications SET verified_at = NOW() WHERE token_hash = $1 AND expires_at > NOW() AND verified_at IS NULL RETURNING user_id",
    [tokenHash],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 400,
      code: "INVALID_TOKEN",
      message: "Invalid verification token",
    }
  }

  const userId = result.rows[0].user_id

  await pool.query("UPDATE platform_users SET email_verified = true WHERE id = $1", [userId])

}

export const resendVerificationEmail = async (email: string) => {
  const result = await pool.query("SELECT id FROM platform_users WHERE email = $1 AND email_verified = false", [email])

  if (result.rows.length === 0) {
    return
  }

  const userId = result.rows[0].id
  await sendVerificationEmail(email, userId)
}
