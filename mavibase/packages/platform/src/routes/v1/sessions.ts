import { Router } from "express"
import { listSessions, revokeSession, revokeAllSessions } from "../../controllers"
import { requireAuth } from "../../middleware/auth-middleware"

const router = Router()

router.get("/", requireAuth, listSessions)
router.delete("/:sessionId", requireAuth, revokeSession)
router.delete("/", requireAuth, revokeAllSessions)

export default router
