import { Router } from "express"
import { DatabaseController } from "@mavibase/api/controllers/v1/databases/DatabaseController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router()
const controller = new DatabaseController()

router.post("/", requireScopes(["databases:write"]), controller.create)
router.get("/", requireScopes(["databases:read"]), controller.list)
router.get("/:databaseId", requireScopes(["databases:read"]), controller.get)
router.get("/:databaseId/export", requireScopes(["databases:read"]), controller.getFull)
router.get("/:databaseId/stats", requireScopes(["databases:read"]), controller.getStats)
router.get("/:databaseId/schema", requireScopes(["databases:read"]), controller.getSchema)
router.patch("/:databaseId", requireScopes(["databases:write"]), controller.update)
router.delete("/:databaseId", requireScopes(["databases:delete"]), controller.delete)

export { router as databaseRoutes }
