import { Router } from "express"
import { IndexController } from "@mavibase/api/controllers/v1/indexes/IndexController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new IndexController()

router.get("/", requireScopes(["databases:read"]), controller.list)
router.post("/", requireScopes(["databases:write"]), controller.create)
router.delete("/:indexId", requireScopes(["databases:delete"]), controller.delete)

export { router as indexRoutes }
