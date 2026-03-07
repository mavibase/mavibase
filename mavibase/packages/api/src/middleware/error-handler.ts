import type { Request, Response, NextFunction } from "express"
import { logger } from "@mavibase/database/utils/logger"
import type { ErrorResponse } from "@mavibase/api/types"
import { AppError } from "@mavibase/core"

// Re-export AppError for backwards compatibility
export { AppError }

export const errorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error occurred", {
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  })

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    }
    return res.status(err.statusCode).json(response)
  }

  // Default error
  const response: ErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
    },
  }

  res.status(500).json(response)
}
