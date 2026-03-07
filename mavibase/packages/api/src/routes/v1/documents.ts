import { Router } from "express"
import { DocumentController } from "@mavibase/api/controllers/v1/documents/DocumentController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new DocumentController()

// IMPORTANT: Bulk routes MUST come before parameterized routes
// Otherwise Express will match "/bulk" as a documentId parameter
router.post("/bulk", requireScopes(["databases:write"]), controller.bulkCreate)
router.patch("/bulk", requireScopes(["databases:write"]), controller.bulkUpdate)
router.delete("/bulk", requireScopes(["databases:delete"]), controller.bulkDelete)

// Regular CRUD routes with parameters
router.post("/", requireScopes(["databases:write"]), controller.create)
router.get("/", requireScopes(["databases:read"]), controller.list)
router.get("/:documentId", requireScopes(["databases:read"]), controller.get)
router.put("/:documentId", requireScopes(["databases:write"]), controller.update)
router.patch("/:documentId", requireScopes(["databases:write"]), controller.patch)
router.delete("/:documentId", requireScopes(["databases:delete"]), controller.delete)

export { router as documentRoutes }
