import { Router } from "express"
import { requireAuth } from "../../middleware/auth-middleware"
import {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  assignRole,
  removeRole,
  getRoleAssignments,
} from "../../controllers"

const router = Router()

// All role routes require authentication
router.use(requireAuth)

// Role assignments (specific routes first)
router.get("/:projectId/roles/assignments", getRoleAssignments)
router.post("/:projectId/roles/assign", assignRole)
router.post("/:projectId/roles/remove", removeRole)

// Role CRUD (parameterized routes last)
router.post("/:projectId/roles", createRole)
router.get("/:projectId/roles", getRoles)
router.get("/:projectId/roles/:roleId", getRole)
router.patch("/:projectId/roles/:roleId", updateRole)
router.delete("/:projectId/roles/:roleId", deleteRole)

export default router
