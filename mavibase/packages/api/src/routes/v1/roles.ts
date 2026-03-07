import { Router } from "express"
import { RoleController } from "@mavibase/api/controllers/v1/roles/RoleController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new RoleController()

// Role CRUD
router.get("/", requireScopes(["databases:read"]), controller.listRoles)
router.post("/", requireScopes(["databases:write"]), controller.createRole)
router.get("/:roleId", requireScopes(["databases:read"]), controller.getRole)
router.patch("/:roleId", requireScopes(["databases:write"]), controller.updateRole)
router.delete("/:roleId", requireScopes(["databases:delete"]), controller.deleteRole)

// Role members
router.get("/:roleId/members", requireScopes(["databases:read"]), controller.listRoleMembers)
router.post("/:roleId/members", requireScopes(["databases:write"]), controller.assignRole)
router.delete("/:roleId/members/:userId", requireScopes(["databases:delete"]), controller.removeRole)

export { router as roleRoutes }
