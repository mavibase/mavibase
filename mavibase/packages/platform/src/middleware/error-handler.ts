import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error occurred", {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  const statusCode = err.statusCode || 500
  const errorCode = err.code || "INTERNAL_SERVER_ERROR"

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.message || "An unexpected error occurred",
      details: err.details || {},
      requestId: req.requestId,
    },
  })
}
