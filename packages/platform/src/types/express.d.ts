import "express"

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      userId?: string
      sessionId?: string
      clientIp?: string
    }
  }
}
