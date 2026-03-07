import type { Request, Response } from "express"
import * as apiKeyService from "@mavibase/platform/services/api-key-service"
import * as projectService from "@mavibase/platform/services/project-service"
import * as teamService from "@mavibase/platform/services/team-service"

export const createAPIKey = async (req: Request, res: Response) => {
  try {
    const { projectId, name, scopes, expiresAt } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    if (!name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "API key name is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    const result = await apiKeyService.createAPIKey({
      projectId,
      userId: req.userId!,
      name,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    })

    res.status(201).json({
      success: true,
      message: "API key created successfully",
      data: result,
      warning: "Save this key securely - it cannot be retrieved again",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "API_KEY_CREATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const listAPIKeys = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    const keys = await apiKeyService.listProjectAPIKeys(projectId)

    // Compute status for each key based on revoked_at and expires_at
    const keysWithStatus = keys.map((key) => {
      let status = "active"
      if (key.revoked_at) {
        status = "revoked"
      } else if (key.expires_at && new Date(key.expires_at) < new Date()) {
        status = "expired"
      }
      return { ...key, status }
    })

    res.json({
      success: true,
      data: { keys: keysWithStatus },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LIST_API_KEYS_FAILED",
        message: error.message,
      },
    })
  }
}

export const revokeAPIKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params
    const { projectId } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    await apiKeyService.revokeAPIKey(keyId, projectId)

    res.json({
      success: true,
      message: "API key revoked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "REVOKE_API_KEY_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteAPIKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params
    const { projectId } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    await apiKeyService.deleteAPIKey(keyId, projectId)

    res.json({
      success: true,
      message: "API key deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "DELETE_API_KEY_FAILED",
        message: error.message,
      },
    })
  }
}

export const rotateAPIKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params
    const { projectId } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    const newKey = await apiKeyService.rotateAPIKey(keyId, projectId, req.userId!)

    res.json({
      success: true,
      message: "API key rotated successfully",
      data: newKey,
      warning: "Save the new key securely - it cannot be retrieved again. The old key has been revoked.",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "ROTATE_API_KEY_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateAPIKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params
    const { projectId, name, scopes } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID is required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage API keys",
        },
      })
    }

    const updatedKey = await apiKeyService.updateAPIKey(keyId, projectId, { name, scopes })

    res.json({
      success: true,
      message: "API key updated successfully",
      data: { key: updatedKey },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "UPDATE_API_KEY_FAILED",
        message: error.message,
      },
    })
  }
}
