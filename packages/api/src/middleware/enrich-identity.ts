import type { Request, Response, NextFunction } from "express"
import { query } from "@mavibase/database/config/database"
import { getRedisClient } from "@mavibase/database/config/redis"
import { logger } from "@mavibase/database/utils/logger"

// Cache TTL for role data (5 minutes by default)
const ROLE_CACHE_TTL_SECONDS = Number.parseInt(process.env.ROLE_CACHE_TTL_SECONDS || "300")
const CACHE_PREFIX = "identity:roles:"

// Get Redis client (may be null if Redis is unavailable)
let redisClient: ReturnType<typeof getRedisClient> | null = null
try {
  redisClient = getRedisClient()
} catch (error) {
  logger.warn("[enrich-identity] Redis not available, role caching disabled")
}

// Generate cache key for user+project role lookup
const getCacheKey = (userId: string, projectId: string): string => {
  return `${CACHE_PREFIX}${userId}:${projectId}`
}

// Try to get cached roles from Redis
const getCachedRoles = async (userId: string, projectId: string): Promise<{ roles: string[]; permissions: string[] } | null> => {
  if (!redisClient) return null
  
  try {
    const cached = await redisClient.get(getCacheKey(userId, projectId))
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    logger.warn("[enrich-identity] Redis cache read failed", { error })
  }
  return null
}

// Cache roles in Redis
const setCachedRoles = async (userId: string, projectId: string, roles: string[], permissions: string[]): Promise<void> => {
  if (!redisClient) return
  
  try {
    await redisClient.setex(
      getCacheKey(userId, projectId),
      ROLE_CACHE_TTL_SECONDS,
      JSON.stringify({ roles, permissions })
    )
  } catch (error) {
    logger.warn("[enrich-identity] Redis cache write failed", { error })
  }
}

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
 * 
 * Roles are cached in Redis to reduce database load (configurable via ROLE_CACHE_TTL_SECONDS).
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

    // Try to get roles from cache first
    const cached = await getCachedRoles(identity.user_id, identity.project_id)
    if (cached) {
      // Use cached roles
      const existingProjectRoles = identity.project_roles || []
      const existingPermissions = identity.permissions || []
      const existingRoles = identity.roles || []

      identity.project_roles = Array.from(new Set([...existingProjectRoles, ...cached.roles])) || undefined
      identity.permissions = Array.from(new Set([...existingPermissions, ...cached.permissions])) || undefined
      identity.roles = Array.from(new Set([...existingRoles, ...cached.roles])) || undefined

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

    // Merge DB-side roles into identity
    const dbProjectRoles: string[] = rolesResult.rows.map((r: any) => r.role_name)
    const dbPermissions = new Set<string>()
    for (const row of rolesResult.rows) {
      const perms = Array.isArray(row.permissions) ? row.permissions : []
      for (const p of perms) dbPermissions.add(p)
    }

    const dbPermissionsArray = Array.from(dbPermissions)

    // Cache the roles for future requests (even if empty)
    await setCachedRoles(identity.user_id, identity.project_id, dbProjectRoles, dbPermissionsArray)

    if (rolesResult.rows.length === 0) {
      // No DB-side roles — keep identity as-is
      return next()
    }

    // Merge with existing platform-resolved values (avoid duplicates)
    const existingProjectRoles = identity.project_roles || []
    const existingPermissions = identity.permissions || []
    const existingRoles = identity.roles || []

    const mergedProjectRoles = Array.from(
      new Set([...existingProjectRoles, ...dbProjectRoles]),
    )
    const mergedPermissions = Array.from(
      new Set([...existingPermissions, ...dbPermissionsArray]),
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
