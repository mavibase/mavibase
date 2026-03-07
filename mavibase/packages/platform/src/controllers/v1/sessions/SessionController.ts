import type { Request, Response } from "express"
import * as sessionService from "@mavibase/platform/services/session-service"

export const listSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await sessionService.getUserSessions(req.userId!)

    res.json({
      success: true,
      data: { sessions },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LIST_SESSIONS_FAILED",
        message: error.message,
      },
    })
  }
}

export const revokeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params

    await sessionService.revokeSession(sessionId, req.userId!)

    res.json({
      success: true,
      message: "Session revoked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "REVOKE_SESSION_FAILED",
        message: error.message,
      },
    })
  }
}

export const revokeAllSessions = async (req: Request, res: Response) => {
  try {
    await sessionService.revokeAllUserSessions(req.userId!)

    res.json({
      success: true,
      message: "All sessions revoked successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "REVOKE_ALL_SESSIONS_FAILED",
        message: error.message,
      },
    })
  }
}
