import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - start
    logger.info("HTTP Request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.clientIp || req.ip,
      userAgent: req.get("user-agent"),
    })
  })

  next()
}
