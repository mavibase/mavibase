import { Router } from "express"
import { TransactionController } from "@mavibase/api/controllers/v1/transactions/TransactionController"
import { requireScopes } from "@mavibase/platform/middleware/api-key-auth"

const router = Router({ mergeParams: true })
const controller = new TransactionController()

/**
 * Transaction Routes
 * Base path: /v1/databases/:databaseId/transactions
 */

// Begin transaction - requires write since transactions modify data
router.post("/", requireScopes(["databases:write"]), controller.begin)

// List active transactions
router.get("/", requireScopes(["databases:read"]), controller.list)

// Get transaction status
router.get("/:transactionId", requireScopes(["databases:read"]), controller.getStatus)

// Commit transaction
router.post("/:transactionId/commit", requireScopes(["databases:write"]), controller.commit)

// Rollback transaction
router.post("/:transactionId/rollback", requireScopes(["databases:write"]), controller.rollback)

export default router
