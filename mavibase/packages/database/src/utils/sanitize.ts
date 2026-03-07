/**
 * Utility functions for input sanitization
 */

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "")
}

export const sanitizeKey = (key: string): string => {
  return key.toLowerCase().replace(/[^a-z0-9-_]/g, "")
}

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
