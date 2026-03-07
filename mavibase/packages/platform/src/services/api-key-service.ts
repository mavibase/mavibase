import { pool } from "../config/database"
import crypto from "crypto"
import { nanoid } from "nanoid"

const SERVER_PEPPER = process.env.API_KEY_PEPPER || "CHANGE_ME_IN_PRODUCTION"

if (SERVER_PEPPER === "CHANGE_ME_IN_PRODUCTION" && process.env.NODE_ENV === "production") {
  console.error("FATAL: API_KEY_PEPPER environment variable must be set in production")
  process.exit(1)
}

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
    `UPDATE api_keys SET ${fields.join(", ")} 
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
