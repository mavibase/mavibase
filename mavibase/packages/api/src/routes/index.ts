import { type Express, Router } from "express"
import { identityMiddleware } from "@mavibase/platform"
import { enrichIdentityMiddleware } from "../middleware/enrich-identity"
import { databaseRoutes } from "./v1/databases"
import { collectionRoutes } from "./v1/collections"
import { documentRoutes } from "./v1/documents"
import { indexRoutes } from "./v1/indexes"
import { versionRoutes } from "./v1/versions"
import { roleRoutes } from "./v1/roles"
import transactionRoutes from "./v1/transactions"
import { HealthController } from "../controllers/v1/health/HealthController"
import { slowQueryRoutes } from "./v1/slow-queries"

const healthController = new HealthController()

export const setupRoutes = (app: Express) => {
  const apiRouter = Router()

  // Health check endpoints don't require authentication
  app.get("/api/v1/db/health", healthController.health)
  app.get("/api/v1/db/ready", healthController.ready)
  app.get("/api/v1/db/live", healthController.live)
  app.get("/api/v1/db/config", healthController.config)

  // Apply identity middleware to all database routes
  apiRouter.use(identityMiddleware)

  // Enrich identity with DB-side project roles and permissions
  apiRouter.use(enrichIdentityMiddleware)

  // Mount routes (all protected by identity middleware)
  apiRouter.use("/databases", databaseRoutes)
  apiRouter.use("/databases/:databaseId/collections", collectionRoutes)
  apiRouter.use("/databases/:databaseId/collections/:collectionId/documents", documentRoutes)
  apiRouter.use("/databases/:databaseId/collections/:collectionId/indexes", indexRoutes)
  apiRouter.use("/databases/:databaseId/collections/:collectionId/documents/:documentId/versions", versionRoutes)
  apiRouter.use("/databases/:databaseId/transactions", transactionRoutes)
  apiRouter.use("/databases/:databaseId/roles", roleRoutes)
  apiRouter.use("/databases/:databaseId/slow-queries", slowQueryRoutes)

  // Mount API router
  app.use("/api/v1/db", apiRouter)
}
