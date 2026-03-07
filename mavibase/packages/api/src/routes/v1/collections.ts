import { Router } from "express"
import { CollectionController } from "@mavibase/api/controllers/v1/collections/CollectionController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new CollectionController()

router.post("/", requireScopes(["databases:write"]), controller.create)
router.get("/", requireScopes(["databases:read"]), controller.list)
router.get("/:collectionId", requireScopes(["databases:read"]), controller.get)
router.patch("/:collectionId", requireScopes(["databases:write"]), controller.update)
router.delete("/:collectionId", requireScopes(["databases:delete"]), controller.delete)

// Schema routes
router.get("/:collectionId/schema", requireScopes(["databases:read"]), controller.getSchema)

// Usage routes
router.get("/:collectionId/usage", requireScopes(["databases:read"]), controller.getUsage)

// Attribute routes
router.get("/:collectionId/attributes", requireScopes(["databases:read"]), controller.getAttributes)
router.post("/:collectionId/attributes", requireScopes(["databases:write"]), controller.createAttribute)
router.patch("/:collectionId/attributes/:attributeKey", requireScopes(["databases:write"]), controller.updateAttribute)
router.delete("/:collectionId/attributes/:attributeKey", requireScopes(["databases:delete"]), controller.deleteAttribute)

// Relationship routes
router.get("/:collectionId/relationships", requireScopes(["databases:read"]), controller.getRelationships)

export { router as collectionRoutes }
