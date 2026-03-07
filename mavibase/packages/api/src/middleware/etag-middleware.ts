import type { Request, Response, NextFunction } from "express"
import { ETagGenerator } from "../services/etag-generator"

const etagGenerator = new ETagGenerator()

/**
 * Add ETag header to responses containing document data
 */
export const addETagHeader = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res)

  res.json = (body: any) => {
    // Check if response contains a document with version info
    if (body.data && body.data.$version && body.data.$updated_at) {
      const etag = etagGenerator.generate(body.data.$version, new Date(body.data.$updated_at))
      res.setHeader("ETag", etag)
    }

    return originalJson(body)
  }

  next()
}

/**
 * Validate If-Match header for concurrency control
 * Should be used before update/delete operations
 */
export const validateIfMatch = (currentVersion: number, currentUpdatedAt: Date, ifMatchHeader?: string): boolean => {
  if (!ifMatchHeader) {
    // No If-Match header provided, allow operation
    return true
  }

  const currentETag = etagGenerator.generate(currentVersion, currentUpdatedAt)
  const providedETags = etagGenerator.parseIfMatch(ifMatchHeader)

  return etagGenerator.anyMatch(providedETags, currentETag)
}
