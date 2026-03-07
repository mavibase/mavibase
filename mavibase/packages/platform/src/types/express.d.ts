import "express"

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      userId?: string
      clientIp?: string
    }
  }
}
