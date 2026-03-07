import type { Request, Response, NextFunction } from "express"
import { logger } from "@mavibase/database/utils/logger"

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - start
    logger.info("Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    })
  })

  next()
}
