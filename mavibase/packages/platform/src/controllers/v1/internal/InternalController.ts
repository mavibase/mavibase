import type { Request, Response } from "express"
import * as identityService from "@mavibase/platform/services/identity-service"
import { pool } from "@mavibase/platform/config/database"

/**
 * Internal endpoint for service-to-service identity validation
 * This endpoint is called by database-service to validate API keys and JWTs
 */
export const validateIdentity = async (req: Request, res: Response) => {
  try {
    const { authorization } = req.body

    if (!authorization) {
      return res.status(400).json({
        valid: false,
        error: {
          code: "MISSING_AUTHORIZATION",
          message: "Authorization header value is required",
        },
      })
    }

    // Validate the identity (JWT or API key)
    const context = await identityService.validateIdentity(authorization)

    if (!context) {
      return res.status(401).json({
        valid: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid or expired credentials",
        },
      })
    }

    // Return identity context
    res.json({
      valid: true,
      context,
    })
  } catch (error: any) {
    console.error("[Internal] Identity validation error:", error)

    res.status(500).json({
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Failed to validate identity",
      },
    })
  }
}

/**
 * Validate project and get details
 * Called by database-service to check if project exists and service is enabled
 *
 * POST /internal/platform-auth/validate-project
 * Body: { project_id: string, service: "database" | "auth" | "storage" }
 */
export const validateProject = async (req: Request, res: Response) => {
  try {
    const { project_id, service } = req.body

    if (!project_id) {
      return res.status(400).json({
        valid: false,
        error: {
          code: "MISSING_PROJECT_ID",
          message: "project_id is required",
        },
      })
    }

    // Get project details
    const projectResult = await pool.query(
      `SELECT 
        p.id,
        p.team_id,
        p.name,
        p.status,
        p.region,
        p.created_at
       FROM projects p
       WHERE p.id = $1
       AND p.status != 'deleted'`,
      [project_id],
    )

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        valid: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Project ${project_id} not found`,
        },
      })
    }

    const project = projectResult.rows[0]

    // Check if project is active
    if (project.status !== "active") {
      return res.status(403).json({
        valid: false,
        error: {
          code: "PROJECT_SUSPENDED",
          message: `Project ${project_id} is ${project.status}`,
        },
      })
    }

    let serviceConfig = null
    if (service) {
      const serviceResult = await pool.query(
        `SELECT 
          enabled,
          config
         FROM project_services
         WHERE project_id = $1
         AND service_name = $2`,
        [project_id, service],
      )

      if (serviceResult.rows.length > 0) {
        serviceConfig = {
          enabled: serviceResult.rows[0].enabled,
          config: serviceResult.rows[0].config || {},
        }
      } else {
        // Service not configured, default to disabled
        serviceConfig = {
          enabled: false,
          config: {},
        }
      }
    }

    const quotasResult = await pool.query(
      `SELECT 
        quota_projects,
        quota_api_requests_monthly,
        quota_storage_gb,
        quota_bandwidth_gb,
        current_storage_gb,
        current_database_gb,
        current_monthly_active_users
       FROM teams
       WHERE id = $1`,
      [project.team_id],
    )

    const quotas = quotasResult.rows[0] || {}

    // Return project validation response
    res.json({
      valid: true,
      project: {
        id: project.id,
        team_id: project.team_id,
        name: project.name,
        status: project.status,
        region: project.region || "us-east-1",
      },
      service_config: serviceConfig,
      quotas: {
        max_projects: quotas.quota_projects || 3,
        storage_quota_gb: quotas.quota_storage_gb || 10,
        bandwidth_quota_gb: quotas.quota_bandwidth_gb || 100,
        api_requests_monthly: quotas.quota_api_requests_monthly || 1000000,
        // Current usage from migration 019
        current_storage_gb: quotas.current_storage_gb || 0,
        current_database_gb: quotas.current_database_gb || 0,
        current_monthly_active_users: quotas.current_monthly_active_users || 0,
      },
    })
  } catch (error: any) {
    console.error("[Internal] Project validation error:", error)

    res.status(500).json({
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Failed to validate project",
      },
    })
  }
}

/**
 * Get project details by ID
 * Called by database-service backfill script to get team_id for projects
 *
 * GET /internal/projects/:projectId
 */
export const getProjectDetails = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const result = await pool.query(
      `SELECT 
        id as project_id,
        team_id,
        name,
        status,
        region,
        created_at,
        updated_at
       FROM projects
       WHERE id = $1
       `,
      [projectId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Project ${projectId} not found`,
        },
      })
    }

    const project = result.rows[0]

    res.json({
      project_id: project.project_id,
      team_id: project.team_id,
      name: project.name,
      status: project.status,
      region: project.region || "us-east-1",
      created_at: project.created_at,
      updated_at: project.updated_at,
    })
  } catch (error: any) {
    console.error("[Internal] Get project error:", error)

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get project details",
      },
    })
  }
}

/**
 * Check quota for an operation
 * Called by database-service before expensive operations
 *
 * POST /internal/platform-auth/quotas/check
 * Body: { team_id: string, metric: string, amount: number }
 */
export const checkQuota = async (req: Request, res: Response) => {
  try {
    const { team_id, metric, amount } = req.body

    if (!team_id || !metric) {
      return res.status(400).json({
        allowed: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "team_id and metric are required",
        },
      })
    }

    // Get team quotas and current usage
    const result = await pool.query(
      `SELECT 
        -- Quotas (from migration 008)
        quota_storage_gb,
        quota_bandwidth_gb,
        quota_api_requests_monthly,
        
        -- Current usage (from migration 019)
        current_storage_gb,
        current_database_gb,
        current_monthly_active_users,
        current_api_requests
       FROM teams
       WHERE id = $1`,
      [team_id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        allowed: false,
        error: {
          code: "TEAM_NOT_FOUND",
          message: `Team ${team_id} not found`,
        },
      })
    }

    const team = result.rows[0]

    // Map metric to quota and current usage
    const metricMap: Record<string, { quota: number; current: number }> = {
      storage_bytes: {
        quota: (team.quota_storage_gb || 10) * 1024 * 1024 * 1024, // Convert GB to bytes
        current: (team.current_storage_gb || 0) * 1024 * 1024 * 1024,
      },
      database_bytes: {
        quota: (team.quota_storage_gb || 10) * 1024 * 1024 * 1024, // Use storage quota for DB
        current: (team.current_database_gb || 0) * 1024 * 1024 * 1024,
      },
      documents: {
        quota: 1000000, // 1 million documents default
        current: 0, // Would need to track this separately
      },
      monthly_active_users: {
        quota: 10000, // Default MAU quota
        current: team.current_monthly_active_users || 0,
      },
      api_requests: {
        quota: team.quota_api_requests_monthly || 1000000,
        current: team.current_api_requests || 0,
      },
    }

    const metricData = metricMap[metric]

    if (!metricData) {
      return res.status(400).json({
        allowed: false,
        error: {
          code: "INVALID_METRIC",
          message: `Unknown metric: ${metric}`,
        },
      })
    }

    const newUsage = metricData.current + (amount || 0)
    const allowed = newUsage <= metricData.quota

    // Allow 10% grace period before hard blocking
    const gracePeriodAllowed = newUsage <= metricData.quota * 1.1

    res.json({
      allowed,
      grace_period: gracePeriodAllowed && !allowed,
      current: metricData.current,
      limit: metricData.quota,
      after_operation: newUsage,
      usage_percentage: (newUsage / metricData.quota) * 100,
    })
  } catch (error: any) {
    console.error("[Internal] Quota check error:", error)

    res.status(500).json({
      allowed: false,
      error: {
        code: "QUOTA_CHECK_ERROR",
        message: "Failed to check quota",
      },
    })
  }
}

/**
 * Report usage from services
 * Called by database-service to report usage metrics for resource monitoring
 *
 * POST /internal/platform-auth/usage/report
 * Body: { project_id: string, service: string, metrics: {...} }
 */
export const reportUsage = async (req: Request, res: Response) => {
  try {
    const { project_id, service, metrics } = req.body

    if (!project_id || !service || !metrics) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "project_id, service, and metrics are required",
        },
      })
    }

    // Get team_id from project
    const projectResult = await pool.query(`SELECT team_id FROM projects WHERE id = $1`, [project_id])

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Project ${project_id} not found`,
        },
      })
    }

    const team_id = projectResult.rows[0].team_id

    await pool.query(
      `INSERT INTO usage_metrics (
        team_id,
        project_id,
        service,
        metrics,
        reported_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [team_id, project_id, service, JSON.stringify(metrics)],
    )

    if (service === "database") {
      await pool.query(
        `UPDATE teams
         SET 
           current_database_gb = $1,
           current_api_requests = current_api_requests + $2,
           updated_at = NOW()
         WHERE id = $3`,
        [
          (metrics.total_storage_bytes || 0) / (1024 * 1024 * 1024), // Bytes to GB
          metrics.api_requests || 0,
          team_id,
        ],
      )
    } else if (service === "storage") {
      await pool.query(
        `UPDATE teams
         SET 
           current_storage_gb = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [(metrics.total_storage_bytes || 0) / (1024 * 1024 * 1024), team_id],
      )
    } else if (service === "auth") {
      await pool.query(
        `UPDATE teams
         SET 
           current_monthly_active_users = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [metrics.monthly_active_users || 0, team_id],
      )
    }

    res.json({
      success: true,
      message: "Usage metrics recorded",
      team_id,
    })
  } catch (error: any) {
    console.error("[Internal] Usage report error:", error)

    res.status(500).json({
      success: false,
      error: {
        code: "USAGE_REPORT_ERROR",
        message: "Failed to report usage",
      },
    })
  }
}

/**
 * Validate user's access to a specific project
 * Used by database-service when user switches projects in the UI
 *
 * POST /internal/validate-user-project-access
 * Body: { user_id: string, project_id: string }
 */
export const validateUserProjectAccess = async (req: Request, res: Response) => {
  try {
    const { user_id, project_id } = req.body


    if (!user_id || !project_id) {

      return res.status(400).json({
        has_access: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "user_id and project_id are required",
        },
      })
    }

    // Check if the user is a member of the team that owns this project
    const result = await pool.query(
      `SELECT 
        p.id as project_id,
        p.team_id,
        p.status,
        tm.user_id,
        tm.role
       FROM projects p
       JOIN team_members tm ON p.team_id = tm.team_id
       WHERE p.id = $1
       AND tm.user_id = $2
       AND p.status != 'deleted'`,
      [project_id, user_id],
    )
    


    if (result.rows.length === 0) {

      return res.json({
        has_access: false,
        error: {
          code: "NO_ACCESS",
          message: "User does not have access to this project",
        },
      })
    }
    
    const row = result.rows[0]
    


    res.json({
      has_access: true,
      project_id: row.project_id,
      team_id: row.team_id,
      role: row.role,
    })
  } catch (error: any) {
    console.error("[Internal] User project access validation error:", error)

    res.status(500).json({
      has_access: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Failed to validate user project access",
      },
    })
  }
}

/**
 * Validate API key and get full context
 * Alternative endpoint with more detailed response
 *
 * POST /internal/platform-auth/validate-api-key
 * Body: { api_key: string, required_scopes?: string[] }
 */
export const validateAPIKey = async (req: Request, res: Response) => {
  try {
    const { api_key, required_scopes } = req.body

    if (!api_key) {
      return res.status(400).json({
        valid: false,
        error: {
          code: "MISSING_API_KEY",
          message: "api_key is required",
        },
      })
    }

    // Validate the API key
    const context = await identityService.validateServiceIdentity(api_key)

    if (!context) {
      return res.status(401).json({
        valid: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid or expired API key",
        },
      })
    }

    // Check required scopes if specified
    if (required_scopes && Array.isArray(required_scopes)) {
      const hasRequiredScopes = required_scopes.every(
        (scope) => context.scopes.includes(scope) || context.scopes.includes("*"),
      )

      if (!hasRequiredScopes) {
        return res.status(403).json({
          valid: false,
          error: {
            code: "INSUFFICIENT_SCOPES",
            message: "API key does not have required scopes",
            required: required_scopes,
            available: context.scopes,
          },
        })
      }
    }

    res.json({
      valid: true,
      project_id: context.project_id,
      team_id: context.team_id,
      scopes: context.scopes,
    })
  } catch (error: any) {
    console.error("[Internal] API key validation error:", error)

    res.status(500).json({
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Failed to validate API key",
      },
    })
  }
}
