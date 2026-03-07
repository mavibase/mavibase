import { Router } from "express"
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  rotateAPIKey,
  updateAPIKey,
} from "../../controllers"
import { requireAuth } from "../../middleware/auth-middleware"

const router = Router()

router.post("/", requireAuth, createAPIKey)
router.get("/project/:projectId", requireAuth, listAPIKeys)
router.post("/:keyId/revoke", requireAuth, revokeAPIKey)
router.post("/:keyId/rotate", requireAuth, rotateAPIKey)
router.put("/:keyId", requireAuth, updateAPIKey)
router.delete("/:keyId", requireAuth, deleteAPIKey)

export default router
