import { Router } from "express"
import { SlowQueryController } from "@mavibase/api/controllers/v1/slow-queries/SlowQueryController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new SlowQueryController()

router.get("/", requireScopes(["databases:read"]), controller.list)
router.get("/stats", requireScopes(["databases:read"]), controller.stats)
router.delete("/", requireScopes(["databases:delete"]), controller.clear)

export { router as slowQueryRoutes }
