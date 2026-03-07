import { Router } from "express"
import {
  getProfile,
  updateProfile,
  changePassword,
  changeEmail,
  deleteAccount,
  listUsers,
  getUserById,
  updateUser,
  suspendUser,
  deleteUser,
  searchUsers,
  getUserActivity,
  selectTeam,
  selectProject,
} from "../../controllers"
import { requireAuth, requireRole } from "../../middleware/auth-middleware"

const router = Router()

// Current user
router.get("/me", requireAuth, getProfile)
router.put("/me", requireAuth, updateProfile)
router.post("/me/change-password", requireAuth, changePassword)
router.post("/me/change-email", requireAuth, changeEmail)
router.delete("/me", requireAuth, deleteAccount)

router.post("/me/select-team", requireAuth, selectTeam)
router.post("/me/select-project", requireAuth, selectProject)

// Admin operations
router.get("/", requireAuth, requireRole("admin"), listUsers)
router.get("/search", requireAuth, requireRole("admin"), searchUsers)
router.get("/:userId", requireAuth, requireRole("admin"), getUserById)
router.get("/:userId/activity", requireAuth, requireRole("admin"), getUserActivity)
router.put("/:userId", requireAuth, requireRole("admin"), updateUser)
router.post("/:userId/suspend", requireAuth, requireRole("admin"), suspendUser)
router.delete("/:userId", requireAuth, requireRole("admin"), deleteUser)

export default router
