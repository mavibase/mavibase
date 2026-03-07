import type { Request, Response, NextFunction } from "express"
import { getClientIp } from "../utils/get-client-ip"

/**
 * Middleware to attach the real client IP to req.clientIp
 * This ensures consistent IP extraction across all controllers
 */
export function attachClientIp(req: Request, res: Response, next: NextFunction) {
  // Attach the real client IP to the request object
  ;(req as any).clientIp = getClientIp(req)
  next()
}
