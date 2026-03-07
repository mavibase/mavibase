import crypto from "crypto"

/**
 * Generate a unique ID using crypto.randomBytes
 * Returns a 32-character hex string (similar length to UUID without dashes)
 */
export function generateId(): string {
  return crypto.randomBytes(16).toString("hex")
}

/**
 * Generate a unique key using crypto.randomBytes
 * Returns a 64-character hex string
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Validate if a string is a valid hex ID (32 chars)
 */
export function isValidId(id: string): boolean {
  return /^[0-9a-f]{32}$/i.test(id)
}

/**
 * Validate if a string is a valid hex key (64 chars)
 */
export function isValidKey(key: string): boolean {
  return /^[0-9a-f]{64}$/i.test(key)
}
