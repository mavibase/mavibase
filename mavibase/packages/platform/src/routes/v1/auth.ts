import { Router } from "express"
import {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  refreshToken,
  verifyToken,
} from "../../controllers"
import { authRateLimiter } from "../../middleware/rate-limiter"
import { requireAuth } from "../../middleware/auth-middleware"

const router = Router()

// Registration & Login
router.post("/register", authRateLimiter, register)
router.post("/login", authRateLimiter, login)
router.post("/logout", requireAuth, logout)

// Email Verification
router.get("/verify-email", verifyEmail)
router.post("/resend-verification", authRateLimiter, resendVerification)

// Password Reset
router.post("/password-reset/request", authRateLimiter, requestPasswordReset)
router.post("/password-reset/confirm", authRateLimiter, resetPassword)

// Token Refresh
router.post("/refresh-token", refreshToken)
router.get("/verify-token", verifyToken) // support both endpoints
export default router
