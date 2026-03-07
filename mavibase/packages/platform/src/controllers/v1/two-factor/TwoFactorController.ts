import type { Request, Response } from "express"
import * as twoFactorService from "@mavibase/platform/services/two-factor-service"
import { getUserById } from "@mavibase/platform/services/auth-service"
import * as passwordService from "@mavibase/platform/services/password-service"

export const setup2FA = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.userId!)

    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })
    }

    // Check if already enabled
    const isEnabled = await twoFactorService.is2FAEnabled(req.userId!)
    if (isEnabled) {
      return res.status(400).json({
        error: {
          code: "2FA_ALREADY_ENABLED",
          message: "Two-factor authentication is already enabled",
        },
      })
    }

    // Send setup code
    await twoFactorService.send2FACode(req.userId!, user.email, user.name, "setup")

    res.json({
      success: true,
      message: "2FA setup code sent to your email. Please verify to enable 2FA.",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "2FA_SETUP_FAILED",
        message: error.message,
      },
    })
  }
}

export const verify2FASetup = async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Verification code is required",
        },
      })
    }

    const isValid = await twoFactorService.verify2FACode(req.userId!, code, "setup")

    if (!isValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CODE",
          message: "Invalid or expired verification code",
        },
      })
    }

    // Enable 2FA
    await twoFactorService.enable2FA(req.userId!)

    res.json({
      success: true,
      message: "Two-factor authentication enabled successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "2FA_VERIFICATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const disable2FA = async (req: Request, res: Response) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Password is required to disable 2FA",
        },
      })
    }

    // Verify password
    const user = await getUserById(req.userId!)
    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })
    }

    const isPasswordValid = await passwordService.verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_PASSWORD",
          message: "Invalid password",
        },
      })
    }

    // Send disable confirmation code
    await twoFactorService.send2FACode(req.userId!, user.email, user.name, "disable")

    res.json({
      success: true,
      message: "Verification code sent to your email. Please verify to disable 2FA.",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "2FA_DISABLE_FAILED",
        message: error.message,
      },
    })
  }
}

export const confirm2FADisable = async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Verification code is required",
        },
      })
    }

    const isValid = await twoFactorService.verify2FACode(req.userId!, code, "disable")

    if (!isValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CODE",
          message: "Invalid or expired verification code",
        },
      })
    }

    // Disable 2FA
    await twoFactorService.disable2FA(req.userId!)

    res.json({
      success: true,
      message: "Two-factor authentication disabled successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "2FA_DISABLE_FAILED",
        message: error.message,
      },
    })
  }
}

export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { userId, code } = req.body

    if (!userId || !code) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "User ID and verification code are required",
        },
      })
    }

    const isValid = await twoFactorService.verify2FACode(userId, code, "login")

    if (!isValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CODE",
          message: "Invalid or expired verification code",
        },
      })
    }

    res.json({
      success: true,
      message: "2FA verification successful",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "2FA_VERIFICATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const resend2FACode = async (req: Request, res: Response) => {
  try {
    const { userId, purpose = "login" } = req.body

    if (!userId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "User ID is required",
        },
      })
    }

    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })
    }

    await twoFactorService.send2FACode(userId, user.email, user.name, purpose)

    res.json({
      success: true,
      message: "Verification code resent to your email",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "RESEND_FAILED",
        message: error.message,
      },
    })
  }
}
