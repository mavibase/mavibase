import { Router } from "express"
import { VersionController } from "@mavibase/api/controllers/v1/versions/VersionController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new VersionController()

router.get("/", requireScopes(["databases:read"]), controller.listVersions)
router.get("/:version", requireScopes(["databases:read"]), controller.getVersion)
router.get("/compare/:version1/:version2", requireScopes(["databases:read"]), controller.compareVersions)
router.post("/:version/restore", requireScopes(["databases:write"]), controller.restoreVersion)

export { router as versionRoutes }
