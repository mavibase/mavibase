import type { Request, Response, NextFunction } from "express"
import { requestContext } from "@mavibase/database/config/database"

/**
 * Middleware that wraps the request in a slow query tracking context.
 * Only external API key requests will have their slow queries logged.
 * 
 * Uses AsyncLocalStorage.enterWith() to ensure the context persists
 * throughout the entire async request lifecycle.
 */
export const slowQueryContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const identityType = req.identity?.type
  const databaseId = req.params?.databaseId

  // enterWith() sets the context for all subsequent async operations in this execution
  requestContext.enterWith({
    identityType,
    databaseId,
  })

  next()
}
