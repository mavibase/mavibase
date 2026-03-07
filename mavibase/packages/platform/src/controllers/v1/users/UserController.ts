import type { Request, Response } from "express"
import * as userService from "@mavibase/platform/services/user-service"
import { getUserById as getAuthUserById } from "@mavibase/platform/services/auth-service"

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await getAuthUserById(req.userId!)

    res.json({
      success: true,
      data: { user },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "FETCH_PROFILE_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { username, metadata } = req.body

    const user = await userService.updateUser(req.userId!, {
      username,
      metadata,
    })

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "UPDATE_PROFILE_FAILED",
        message: error.message,
      },
    })
  }
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Current password and new password are required",
        },
      })
    }

    await userService.changePassword(req.userId!, currentPassword, newPassword)

    res.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "PASSWORD_CHANGE_FAILED",
        message: error.message,
      },
    })
  }
}

export const changeEmail = async (req: Request, res: Response) => {
  try {
    const { newEmail, password } = req.body

    if (!newEmail || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "New email and password are required",
        },
      })
    }

    await userService.changeEmail(req.userId!, newEmail, password)

    res.json({
      success: true,
      message: "Email change initiated. Please verify your new email.",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "EMAIL_CHANGE_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Password is required to delete account",
        },
      })
    }

    await userService.deleteAccount(req.userId!, password)

    res.json({
      success: true,
      message: "Account deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "ACCOUNT_DELETION_FAILED",
        message: error.message,
      },
    })
  }
}

export const listUsers = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query

    const result = await userService.listUsers(Number.parseInt(limit as string), Number.parseInt(offset as string))

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LIST_USERS_FAILED",
        message: error.message,
      },
    })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const userRecord = await getAuthUserById(userId)

    if (!userRecord) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })
    }

    res.json({
      success: true,
      data: { user: userRecord },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "FETCH_USER_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const updates = req.body

    const user = await userService.updateUser(userId, updates)

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "UPDATE_USER_FAILED",
        message: error.message,
      },
    })
  }
}

export const suspendUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { reason } = req.body

    await userService.suspendUser(userId, reason)

    res.json({
      success: true,
      message: "User suspended successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "SUSPEND_USER_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    await userService.adminDeleteUser(userId)

    res.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "DELETE_USER_FAILED",
        message: error.message,
      },
    })
  }
}

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query, limit = 50, offset = 0 } = req.query

    if (!query) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Search query is required",
        },
      })
    }

    const result = await userService.searchUsers(
      query as string,
      Number.parseInt(limit as string),
      Number.parseInt(offset as string),
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "SEARCH_USERS_FAILED",
        message: error.message,
      },
    })
  }
}

export const getUserActivity = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { limit = "50", offset = "0" } = req.query

    const activity = await userService.getUserActivity(
      userId,
      Number.parseInt(limit as string),
      Number.parseInt(offset as string),
    )

    res.json({
      success: true,
      data: { activity },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_USER_ACTIVITY_FAILED",
        message: error.message,
      },
    })
  }
}

export const selectTeam = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.body

    if (!teamId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Team ID is required",
        },
      })
    }

    const user = await userService.selectTeam(req.userId!, teamId)

    res.json({
      success: true,
      message: "Team selected successfully",
      data: { user },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "SELECT_TEAM_FAILED",
        message: error.message,
      },
    })
  }
}

export const selectProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    const user = await userService.selectProject(req.userId!, projectId)

    res.json({
      success: true,
      message: "Project selected successfully",
      data: { user },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "SELECT_PROJECT_FAILED",
        message: error.message,
      },
    })
  }
}
