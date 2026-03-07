import type { Request, Response, NextFunction } from "express"
import { query } from "@mavibase/database/config/database"

/**
 * Middleware that enriches the identity context with project roles
 * and permissions from the database-package database.
 *
 * The platform identity middleware resolves roles from the platform DB,
 * but the DB API's RoleController stores role assignments in the
 * database-package DB (different Postgres instance). This middleware
 * bridges the gap by loading the DB-side roles and merging them into
 * the identity context so that AuthorizationPolicy and controller-level
 * hasRolePermission checks work correctly.
 */
export const enrichIdentityMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const identity = req.identity
    if (!identity || identity.type !== "user" || !identity.user_id || !identity.project_id) {
      return next()
    }

    // Load project roles from the DB-package database
    const rolesResult = await query(
      `SELECT upr.role_name, pr.permissions
       FROM user_project_roles upr
       JOIN project_roles pr
         ON pr.project_id = upr.project_id
        AND pr.name = upr.role_name
        AND pr.deleted_at IS NULL
       WHERE upr.user_id = $1
         AND upr.project_id = $2
         AND (upr.expires_at IS NULL OR upr.expires_at > NOW())`,
      [identity.user_id, identity.project_id],
    )

    if (rolesResult.rows.length === 0) {
      // No DB-side roles — keep identity as-is
      return next()
    }

    // Merge DB-side roles into identity
    const dbProjectRoles: string[] = rolesResult.rows.map((r: any) => r.role_name)
    const dbPermissions = new Set<string>()
    for (const row of rolesResult.rows) {
      const perms = Array.isArray(row.permissions) ? row.permissions : []
      for (const p of perms) dbPermissions.add(p)
    }

    // Merge with existing platform-resolved values (avoid duplicates)
    const existingProjectRoles = identity.project_roles || []
    const existingPermissions = identity.permissions || []
    const existingRoles = identity.roles || []

    const mergedProjectRoles = Array.from(
      new Set([...existingProjectRoles, ...dbProjectRoles]),
    )
    const mergedPermissions = Array.from(
      new Set([...existingPermissions, ...dbPermissions]),
    )
    const mergedRoles = Array.from(
      new Set([...existingRoles, ...dbProjectRoles]),
    )

    identity.project_roles = mergedProjectRoles.length > 0 ? mergedProjectRoles : undefined
    identity.permissions = mergedPermissions.length > 0 ? mergedPermissions : undefined
    identity.roles = mergedRoles.length > 0 ? mergedRoles : undefined

    next()
  } catch (error) {
    // Don't fail the request if enrichment fails — just continue
    console.error("[enrich-identity] Error enriching identity:", error)
    next()
  }
}
