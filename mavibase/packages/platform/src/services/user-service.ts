import { pool } from "../config/database"
import crypto from "crypto"
import { nanoid } from "nanoid"
import { hashPassword, verifyPassword } from "./password-service"

const SERVER_PEPPER = process.env.API_KEY_PEPPER || "CHANGE_ME_IN_PRODUCTION"

if (SERVER_PEPPER === "CHANGE_ME_IN_PRODUCTION" && process.env.NODE_ENV === "production") {
  console.error("FATAL: API_KEY_PEPPER environment variable must be set in production")
  process.exit(1)
}

// User management functions
export const updateUser = async (userId: string, updates: { username?: string; metadata?: any; name?: string }) => {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.username !== undefined) {
    fields.push(`username = $${paramIndex}`)
    values.push(updates.username)
    paramIndex++
  }

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++
  }

  if (updates.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex}`)
    values.push(JSON.stringify(updates.metadata))
    paramIndex++
  }

  if (fields.length === 0) {
    const error: any = new Error("No fields to update")
    error.statusCode = 400
    error.code = "NO_UPDATES"
    throw error
  }

  values.push(userId)

  const result = await pool.query(
    `UPDATE platform_users 
     SET ${fields.join(", ")}, updated_at = NOW() 
     WHERE id = $${paramIndex}
     RETURNING id, email, name, username, email_verified, status, created_at`,
    values,
  )

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  return result.rows[0]
}

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const result = await pool.query("SELECT password_hash FROM platform_users WHERE id = $1", [userId])

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  const isValid = await verifyPassword(currentPassword, result.rows[0].password_hash)

  if (!isValid) {
    const error: any = new Error("Current password is incorrect")
    error.statusCode = 401
    error.code = "INVALID_PASSWORD"
    throw error
  }

  const hashedPassword = await hashPassword(newPassword)

  await pool.query("UPDATE platform_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    hashedPassword,
    userId,
  ])
}

export const changeEmail = async (userId: string, newEmail: string, password: string) => {
  const result = await pool.query("SELECT password_hash, email FROM platform_users WHERE id = $1", [userId])

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  const isValid = await verifyPassword(password, result.rows[0].password_hash)

  if (!isValid) {
    const error: any = new Error("Password is incorrect")
    error.statusCode = 401
    error.code = "INVALID_PASSWORD"
    throw error
  }

  // Check if new email is already taken
  const emailCheck = await pool.query("SELECT id FROM platform_users WHERE email = $1 AND id != $2", [newEmail, userId])

  if (emailCheck.rows.length > 0) {
    const error: any = new Error("Email is already in use")
    error.statusCode = 400
    error.code = "EMAIL_IN_USE"
    throw error
  }

  await pool.query("UPDATE platform_users SET email = $1, email_verified = false, updated_at = NOW() WHERE id = $2", [
    newEmail,
    userId,
  ])
}

export const deleteAccount = async (userId: string, password: string) => {
  const result = await pool.query("SELECT password_hash FROM platform_users WHERE id = $1", [userId])

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  const isValid = await verifyPassword(password, result.rows[0].password_hash)

  if (!isValid) {
    const error: any = new Error("Password is incorrect")
    error.statusCode = 401
    error.code = "INVALID_PASSWORD"
    throw error
  }

  // Soft delete
  await pool.query("UPDATE platform_users SET status = 'deleted', updated_at = NOW() WHERE id = $1", [userId])
}

export const listUsers = async (limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT id, email, name, username, email_verified, status, created_at, last_login_at
     FROM platform_users
     WHERE status != 'deleted'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )

  const countResult = await pool.query("SELECT COUNT(*) FROM platform_users WHERE status != 'deleted'")

  return {
    users: result.rows,
    total: Number.parseInt(countResult.rows[0].count),
    limit,
    offset,
  }
}

export const suspendUser = async (userId: string, reason?: string) => {
  const result = await pool.query(
    `UPDATE platform_users 
     SET status = 'suspended', updated_at = NOW()
     WHERE id = $1 AND status != 'deleted'`,
    [userId],
  )

  if (result.rowCount === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }
}

export const adminDeleteUser = async (userId: string) => {
  const result = await pool.query(
    `UPDATE platform_users 
     SET status = 'deleted', updated_at = NOW()
     WHERE id = $1`,
    [userId],
  )

  if (result.rowCount === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }
}

export const searchUsers = async (query: string, limit = 50, offset = 0) => {
  const searchPattern = `%${query}%`
  const result = await pool.query(
    `SELECT id, email, name, username, email_verified, status, created_at, last_login_at
     FROM platform_users
     WHERE status != 'deleted' 
     AND (email ILIKE $1 OR name ILIKE $1 OR username ILIKE $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [searchPattern, limit, offset],
  )

  const countResult = await pool.query(
    `SELECT COUNT(*) 
     FROM platform_users 
     WHERE status != 'deleted' 
     AND (email ILIKE $1 OR name ILIKE $1 OR username ILIKE $1)`,
    [searchPattern],
  )

  return {
    users: result.rows,
    total: Number.parseInt(countResult.rows[0].count),
    limit,
    offset,
  }
}



// API Key management functions
interface CreateAPIKeyParams {
  projectId: string
  userId: string
  name: string
  keyType?: "public" | "secret" | "service"
  scopes?: string[]
  expiresAt?: Date
}

interface APIKey {
  id: string
  project_id: string
  name: string
  key_prefix: string
  key_type: string
  scopes: string[]
  last_used_at: Date | null
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Date
  created_by: string
}

export const createAPIKey = async (params: CreateAPIKeyParams) => {
  const { projectId, userId, name, keyType = "secret", scopes, expiresAt } = params

  // Generate API key in format: {type}_{env}_{random}
  const keyId = nanoid(32)
  const prefix = keyType === "public" ? "pk" : keyType === "service" ? "svk" : "sk"
  const env = process.env.NODE_ENV === "production" ? "live" : "test"
  const rawKey = `${prefix}_${env}_${keyId}`

  // Extract prefix for identification (first 15 characters)
  const keyPrefix = rawKey.substring(0, 15)

  // This prevents offline brute-force attacks even if the database leaks
  const keyHash = crypto.createHmac("sha256", SERVER_PEPPER).update(rawKey).digest("hex")

  const result = await pool.query(
    `INSERT INTO api_keys (project_id, name, key_prefix, key_hash, key_type, scopes, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, project_id, name, key_prefix, key_type, scopes, last_used_at, expires_at, revoked_at, created_at`,
    [projectId, name, keyPrefix, keyHash, keyType, scopes || [], expiresAt || null, userId],
  )

  const apiKey = result.rows[0]

  // Return the full key only once
  return {
    ...apiKey,
    key: rawKey, // Only shown at creation
  }
}

export const listProjectAPIKeys = async (projectId: string): Promise<APIKey[]> => {
  const result = await pool.query(
    `SELECT id, project_id, name, key_prefix, key_type, scopes, last_used_at, expires_at, revoked_at, created_at
     FROM api_keys
     WHERE project_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [projectId],
  )

  return result.rows
}

export const getAPIKeyByPrefix = async (keyPrefix: string): Promise<APIKey | null> => {
  const result = await pool.query(
    `SELECT id, project_id, name, key_prefix, key_hash, key_type, scopes, last_used_at, expires_at, revoked_at, created_at
     FROM api_keys
     WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [keyPrefix],
  )

  return result.rows[0] || null
}

export const verifyAPIKey = async (
  rawKey: string,
): Promise<{ valid: boolean; apiKey?: APIKey & { key_hash: string } }> => {
  // Extract prefix
  const keyPrefix = rawKey.substring(0, 15)

  // Get API key from database
  const apiKey = await getAPIKeyByPrefix(keyPrefix)

  if (!apiKey) {
    return { valid: false }
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false }
  }

  const providedHash = crypto.createHmac("sha256", SERVER_PEPPER).update(rawKey).digest("hex")
  const storedHash = (apiKey as any).key_hash

  if (providedHash !== storedHash) {
    return { valid: false }
  }

  // Update last used timestamp
  await pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [apiKey.id])

  return { valid: true, apiKey: apiKey as any }
}

export const revokeAPIKey = async (keyId: string, projectId: string): Promise<void> => {
  const result = await pool.query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`,
    [keyId, projectId],
  )

  if (result.rowCount === 0) {
    const error: any = new Error("API key not found or already revoked")
    error.statusCode = 404
    error.code = "API_KEY_NOT_FOUND"
    throw error
  }
}

export const deleteAPIKey = async (keyId: string, projectId: string): Promise<void> => {
  const result = await pool.query(`DELETE FROM api_keys WHERE id = $1 AND project_id = $2`, [keyId, projectId])

  if (result.rowCount === 0) {
    const error: any = new Error("API key not found")
    error.statusCode = 404
    error.code = "API_KEY_NOT_FOUND"
    throw error
  }
}

export const verifyAPIKeyScopes = (apiKey: APIKey, requiredScopes: string[]): boolean => {
  const apiKeyScopes = apiKey.scopes || []

  // Check if API key has all required scopes
  return requiredScopes.every((scope) => apiKeyScopes.includes(scope) || apiKeyScopes.includes("*"))
}

export const rotateAPIKey = async (keyId: string, projectId: string, userId: string) => {
  // Get the existing key details
  const existingKeyResult = await pool.query(
    `SELECT name, key_type, scopes, expires_at FROM api_keys WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`,
    [keyId, projectId],
  )

  if (existingKeyResult.rows.length === 0) {
    const error: any = new Error("API key not found or already revoked")
    error.statusCode = 404
    error.code = "API_KEY_NOT_FOUND"
    throw error
  }

  const existingKey = existingKeyResult.rows[0]

  // Revoke the old key
  await revokeAPIKey(keyId, projectId)

  // Create a new key with the same properties
  const newKey = await createAPIKey({
    projectId,
    userId,
    name: existingKey.name,
    keyType: existingKey.key_type,
    scopes: existingKey.scopes,
    expiresAt: existingKey.expires_at,
  })

  return newKey
}

export const updateAPIKey = async (keyId: string, projectId: string, updates: { name?: string; scopes?: string[] }) => {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++
  }

  if (updates.scopes !== undefined) {
    fields.push(`scopes = $${paramIndex}`)
    values.push(updates.scopes)
    paramIndex++
  }

  if (fields.length === 0) {
    const error: any = new Error("No fields to update")
    error.statusCode = 400
    error.code = "NO_UPDATES"
    throw error
  }

  values.push(keyId, projectId)

  const result = await pool.query(
    `UPDATE api_keys SET ${fields.join(", ")}, updated_at = NOW() 
     WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1} AND revoked_at IS NULL
     RETURNING id, project_id, name, key_prefix, key_type, scopes, last_used_at, expires_at, revoked_at, created_at`,
    values,
  )

  if (result.rows.length === 0) {
    const error: any = new Error("API key not found or already revoked")
    error.statusCode = 404
    error.code = "API_KEY_NOT_FOUND"
    throw error
  }

  return result.rows[0]
}

export const selectTeam = async (userId: string, teamId: string) => {
  // Verify user is a member of the team
  const memberCheck = await pool.query(`SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    userId,
  ])

  if (memberCheck.rows.length === 0) {
    const error: any = new Error("You are not a member of this team")
    error.statusCode = 403
    error.code = "NOT_TEAM_MEMBER"
    throw error
  }

  // Update selected_team_id and clear selected_project_id
  const result = await pool.query(
    `UPDATE platform_users 
     SET selected_team_id = $1, selected_project_id = NULL, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, name, username, selected_team_id, selected_project_id`,
    [teamId, userId],
  )

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  return result.rows[0]
}

export const selectProject = async (userId: string, projectId: string) => {
  // Get project and verify access
  const projectCheck = await pool.query(
    `SELECT p.id, p.team_id 
     FROM projects p
     INNER JOIN team_members tm ON tm.team_id = p.team_id
     WHERE p.id = $1 AND tm.user_id = $2`,
    [projectId, userId],
  )

  if (projectCheck.rows.length === 0) {
    const error: any = new Error("Project not found or you don't have access")
    error.statusCode = 403
    error.code = "PROJECT_ACCESS_DENIED"
    throw error
  }

  const project = projectCheck.rows[0]

  // Update selected_project_id and selected_team_id
  const result = await pool.query(
    `UPDATE platform_users 
     SET selected_team_id = $1, selected_project_id = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, email, name, username, selected_team_id, selected_project_id`,
    [project.team_id, projectId, userId],
  )

  if (result.rows.length === 0) {
    const error: any = new Error("User not found")
    error.statusCode = 404
    error.code = "USER_NOT_FOUND"
    throw error
  }

  return result.rows[0]
}
