import { Router } from "express"
import {
  validateIdentity,
  validateProject,
  getProjectDetails,
  checkQuota,
  reportUsage,
  validateAPIKey,
  validateUserProjectAccess,
} from "../../controllers"

const router = Router()

/**
 * Internal API Routes
 * 
 * These endpoints are for internal service-to-service communication.
 * They should be protected by network-level security (e.g., private network, VPN)
 * or by internal authentication tokens.
 * 
 * DO NOT expose these endpoints publicly!
 */

// EXISTING: Validate identity (JWT or API key)
router.post("/validate-identity", validateIdentity)

// ADDED: Validate project and check if service is enabled
router.post("/platform-auth/validate-project", validateProject)

// ADDED: Get project details (used by backfill script)
router.get("/projects/:projectId", getProjectDetails)

// ADDED: Check quota before operation
router.post("/platform-auth/quotas/check", checkQuota)

// ADDED: Report usage metrics for resource monitoring
router.post("/platform-auth/usage/report", reportUsage)

// ADDED: Validate API key with scope checking
router.post("/platform-auth/validate-api-key", validateAPIKey)

// ADDED: Validate user's access to a specific project
router.post("/validate-user-project-access", validateUserProjectAccess)

export default router
