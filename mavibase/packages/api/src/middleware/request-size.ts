import type { Request, Response, NextFunction } from "express"
import { AppError } from "@mavibase/api/middleware/error-handler"

const MAX_DOCUMENT_SIZE = Number.parseInt(process.env.MAX_DOCUMENT_SIZE_KB || "256") * 1024
const MAX_DEPTH = 10

const calculateDepth = (obj: any, currentDepth = 0): number => {
  if (currentDepth > MAX_DEPTH) {
    return currentDepth
  }

  if (typeof obj !== "object" || obj === null) {
    return currentDepth
  }

  let maxDepth = currentDepth
  for (const key in obj) {
    const depth = calculateDepth(obj[key], currentDepth + 1)
    maxDepth = Math.max(maxDepth, depth)
  }

  return maxDepth
}

export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    const bodySize = JSON.stringify(req.body).length

    if (bodySize > MAX_DOCUMENT_SIZE) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds maximum size of ${MAX_DOCUMENT_SIZE / 1024}KB`)
    }

    const depth = calculateDepth(req.body)
    if (depth > MAX_DEPTH) {
      throw new AppError(400, "INVALID_REQUEST", `JSON depth exceeds maximum depth of ${MAX_DEPTH}`)
    }
  }

  next()
}
