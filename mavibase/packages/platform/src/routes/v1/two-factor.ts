import { Router } from "express"
import { requireAuth } from "../../middleware/auth-middleware"
import * as twoFactorController from "../../controllers"

const router = Router()

router.post("/setup", requireAuth, twoFactorController.setup2FA)
router.post("/setup/verify", requireAuth, twoFactorController.verify2FASetup)
router.post("/disable", requireAuth, twoFactorController.disable2FA)
router.post("/disable/confirm", requireAuth, twoFactorController.confirm2FADisable)
router.post("/verify", twoFactorController.verify2FA)
router.post("/resend", twoFactorController.resend2FACode)

export default router
