import { type Express, Router } from "express"
import authRoutes from "./v1/auth"
import userRoutes from "./v1/users"
import projectRoutes from "./v1/projects"
import teamRoutes from "./v1/teams"
import sessionRoutes from "./v1/sessions"
import apiKeyRoutes from "./v1/api-keys"
import healthRoutes from "./v1/health"
import internalRoutes from "./v1/internal"
import projectRoleRoutes from "./v1/project-roles"
import twoFactorRoutes from "./v1/two-factor"
import { HealthController } from "../controllers/v1/health/HealthController"

const healthController = new HealthController()

export const setupRoutes = (app: Express) => {
  const apiRouter = Router()

  // Health endpoints at root level
  app.get("/api/v1/platform/health", healthController.health)
  app.get("/api/v1/platform/ready", healthController.ready)
  app.get("/api/v1/platform/live", healthController.live)

  // Internal endpoints (internal API key required)
  apiRouter.use("/internal", internalRoutes)

  // Auth endpoints (no auth required for registration/login)
  apiRouter.use("/auth", authRoutes)

  // User endpoints (auth required)
  apiRouter.use("/users", userRoutes)

  // Session management
  apiRouter.use("/sessions", sessionRoutes)

  // Two-factor authentication
  apiRouter.use("/2fa", twoFactorRoutes)

  // Team management
  apiRouter.use("/teams", teamRoutes)

  // Project management
  apiRouter.use("/projects", projectRoutes)
  apiRouter.use("/projects/:projectId/roles", projectRoleRoutes)

  // API key management
  apiRouter.use("/api-keys", apiKeyRoutes)

  // Mount API router
  app.use("/api/v1/platform", apiRouter)
}
