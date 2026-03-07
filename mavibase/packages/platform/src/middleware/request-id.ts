import type { Request, Response, NextFunction } from "express"
import { v4 as uuidv4 } from "uuid"

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers["x-request-id"] || uuidv4()
  req.requestId = id as string
  res.setHeader("X-Request-Id", id)
  next()
}
