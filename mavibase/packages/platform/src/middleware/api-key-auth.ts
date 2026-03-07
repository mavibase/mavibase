import type { Request, Response, NextFunction } from "express"
import * as apiKeyService from "../services/api-key-service"
import * as projectService from "../services/project-service"

// Extend Express Request to include API key context
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string
        project_id: string
        scopes: string[]
      }
      projectId?: string
    }
  }
}

/**
 * Middleware to authenticate API keys
 * Validates the API key and attaches project context to the request
 */
export const requireAPIKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract API key from Authorization header
    const authHeader = req.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "API key required. Provide via Authorization: Bearer <api_key>",
        },
      })
    }

    const apiKey = authHeader.substring(7) // Remove "Bearer " prefix

    // Verify API key
    const { valid, apiKey: apiKeyData } = await apiKeyService.verifyAPIKey(apiKey)

    if (!valid || !apiKeyData) {
      return res.status(401).json({
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid or expired API key",
        },
      })
    }

    // Attach API key context to request
    req.apiKey = {
      id: apiKeyData.id,
      project_id: apiKeyData.project_id,
      scopes: apiKeyData.scopes || [],
    }
    req.projectId = apiKeyData.project_id

    next()
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "API_KEY_AUTH_FAILED",
        message: error.message,
      },
    })
  }
}

/**
 * Middleware to verify identity has required scopes
 * Only enforces scopes for API key (service) access.
 * Console users (JWT auth) have full access and bypass scope checks.
 */
export const requireScopes = (requiredScopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for identity from identityMiddleware (the main auth middleware)
    const identity = (req as any).identity

    if (!identity) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })
    }

    // Console users (JWT auth) have full access - skip scope checks
    // Only API keys (service identity) need scope enforcement
    if (identity.type === "user") {
      return next()
    }

    // For service identity (API keys), enforce scopes
    const scopes = identity.scopes || []

    // Check if API key has required scopes (or wildcard "*")
    const hasScopes = apiKeyService.verifyAPIKeyScopes({ scopes } as any, requiredScopes)

    if (!hasScopes) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: `This API key does not have the required scopes: ${requiredScopes.join(", ")}`,
        },
      })
    }

    next()
  }
}

/**
 * Middleware to ensure project isolation
 * Validates that resources belong to the authenticated project
 */
export const enforceProjectIsolation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.projectId || !req.apiKey) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "API key authentication required",
        },
      })
    }

    // The project is ALWAYS determined by the API key
    const apiKeyProjectId = req.apiKey.project_id

    // If accessing a specific resource, verify it belongs to the API key's project
    const resourceProjectId = req.body.project_id || req.params.projectId

    if (resourceProjectId && resourceProjectId !== apiKeyProjectId) {
      return res.status(403).json({
        error: {
          code: "CROSS_PROJECT_ACCESS_DENIED",
          message: "Cannot access resources from a different project. The API key determines project scope.",
        },
      })
    }

    // Verify project exists and is active
    const project = await projectService.getProjectById(apiKeyProjectId)

    if (!project) {
      return res.status(404).json({
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      })
    }

    if (project.status !== "active") {
      return res.status(403).json({
        error: {
          code: "PROJECT_DISABLED",
          message: "This project is currently disabled",
        },
      })
    }

    // Set the authoritative project ID from the API key
    req.projectId = apiKeyProjectId

    next()
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "PROJECT_ISOLATION_CHECK_FAILED",
        message: error.message,
      },
    })
  }
}
