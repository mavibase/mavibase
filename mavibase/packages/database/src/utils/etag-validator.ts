import { ETagGenerator } from "./EtagGenerator"

const etagGenerator = new ETagGenerator()

/**
 * Validates If-Match header against current document state
 * Returns true if validation passes (no header provided or header matches)
 * Returns false if validation fails (header provided but doesn't match)
 */
export function validateIfMatch(
  version: number,
  updatedAt: Date,
  ifMatchHeader?: string
): boolean {
  // If no If-Match header, allow the operation
  if (!ifMatchHeader) {
    return true
  }

  // Generate current ETag
  const currentEtag = etagGenerator.generate(version, updatedAt)

  // Compare (handle both quoted and unquoted ETags)
  const normalizedHeader = ifMatchHeader.replace(/"/g, "")
  const normalizedCurrent = currentEtag.replace(/"/g, "")

  return normalizedHeader === normalizedCurrent
}

/**
 * Validates If-None-Match header for conditional GET requests
 * Returns true if the resource has changed (should return full response)
 * Returns false if the resource hasn't changed (should return 304)
 */
export function validateIfNoneMatch(
  version: number,
  updatedAt: Date,
  ifNoneMatchHeader?: string
): boolean {
  // If no If-None-Match header, resource has "changed"
  if (!ifNoneMatchHeader) {
    return true
  }

  // Generate current ETag
  const currentEtag = etagGenerator.generate(version, updatedAt)

  // Compare (handle both quoted and unquoted ETags)
  const normalizedHeader = ifNoneMatchHeader.replace(/"/g, "")
  const normalizedCurrent = currentEtag.replace(/"/g, "")

  // If they match, resource hasn't changed
  return normalizedHeader !== normalizedCurrent
}
