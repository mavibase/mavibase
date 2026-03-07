import { pool } from "../config/database"
import * as tokenService from "./token-service"
import * as apiKeyService from "./api-key-service"
import type { IdentityContext } from "../types/identity"

/**
 * Options for identity resolution — pass the X-Project-Id / X-Team-Id
 * headers so the backend resolves context for the correct project.
 */
export interface IdentityOptions {
  requestedProjectId?: string
  requestedTeamId?: string
}

/**
 * Build the unified roles[] and permissions[] arrays from
 * the team-member role and the custom project_roles.
 */
function buildRolesAndPermissions(
  teamRole: string | undefined,
  projectRoles: string[],
  rolePermissions: Record<string, string[]>,
): { roles: string[]; permissions: string[] } {
  const roles: string[] = []
  if (teamRole) roles.push(teamRole)
  roles.push(...projectRoles)

  const permSet = new Set<string>()
  for (const roleName of projectRoles) {
    const perms = rolePermissions[roleName]
    if (perms) {
      for (const p of perms) permSet.add(p)
    }
  }

  return { roles, permissions: Array.from(permSet) }
}

/**
 * Load the permission strings for every active project_role the user has.
 * Returns a map of roleName -> permissions[].
 */
async function loadRolePermissions(
  projectId: string,
  roleNames: string[],
): Promise<Record<string, string[]>> {
  if (roleNames.length === 0) return {}

  const result = await pool.query(
    `SELECT name, permissions
     FROM project_roles
     WHERE project_id = $1
       AND name = ANY($2::text[])
       AND deleted_at IS NULL`,
    [projectId, roleNames],
  )

  const map: Record<string, string[]> = {}
  for (const row of result.rows) {
    map[row.name] = Array.isArray(row.permissions) ? row.permissions : []
  }
  return map
}

/**
 * Validates JWT token and returns user identity context.
 * When requestedTeamId / requestedProjectId are supplied the function
 * validates that the user is actually a member of that team and has
 * access to that project, instead of blindly picking the first match.
 */
export const validateUserIdentity = async (
  token: string,
  options?: IdentityOptions,
): Promise<IdentityContext | null> => {
  // Verify JWT
  const decoded = await tokenService.verifyAccessToken(token)

  if (!decoded || decoded.type !== "access") {
    return null
  }

  const userId = decoded.userId
  const { requestedProjectId, requestedTeamId } = options || {}

  // ── When the caller specified a team + project, resolve exactly that ──
  if (requestedTeamId && requestedProjectId) {
    const result = await pool.query(
      `SELECT 
        tm.team_id,
        tm.role,
        tm.user_id,
        p.id   AS project_id
       FROM team_members tm
       JOIN projects p
         ON p.team_id  = tm.team_id
        AND p.id        = $2
        AND p.status   != 'deleted'
       WHERE tm.user_id = $1
         AND tm.team_id = $3`,
      [userId, requestedProjectId, requestedTeamId],
    )

    if (result.rows.length === 0) {
      // User is NOT a member of the requested team/project — throw 403, not null
      const error: any = new Error("You do not have access to this team or project")
      error.statusCode = 403
      error.code = "TEAM_ACCESS_DENIED"
      throw error
    }

    const row = result.rows[0]

    // Get custom project roles
    let projectRoles: string[] = []
    const rolesResult = await pool.query(
      `SELECT role_name
       FROM user_project_roles
       WHERE user_id = $1
       AND project_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, requestedProjectId],
    )
    projectRoles = rolesResult.rows.map((r: any) => r.role_name)

    const rolePermissions = await loadRolePermissions(requestedProjectId, projectRoles)
    const { roles, permissions } = buildRolesAndPermissions(row.role, projectRoles, rolePermissions)

    return {
      type: "user",
      user_id: userId,
      team_id: row.team_id,
      project_id: row.project_id,
      role: row.role,
      scopes: ["*"],
      project_roles: projectRoles.length > 0 ? projectRoles : undefined,
      roles,
      permissions: permissions.length > 0 ? permissions : undefined,
    }
  }

  // ── When only a team is specified, pick the first project in that team ──
  if (requestedTeamId) {
    const result = await pool.query(
      `SELECT 
        tm.team_id,
        tm.role,
        tm.user_id,
        p.id AS project_id
       FROM team_members tm
       LEFT JOIN projects p
         ON p.team_id  = tm.team_id
        AND p.status   != 'deleted'
       WHERE tm.user_id = $1
         AND tm.team_id = $2
       ORDER BY p.created_at ASC
       LIMIT 1`,
      [userId, requestedTeamId],
    )

    if (result.rows.length === 0) {
      const error: any = new Error("You do not have access to this team")
      error.statusCode = 403
      error.code = "TEAM_ACCESS_DENIED"
      throw error
    }

    const row = result.rows[0]
    let projectRoles: string[] = []
    if (row.project_id) {
      const rolesResult = await pool.query(
        `SELECT role_name FROM user_project_roles
         WHERE user_id = $1 AND project_id = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId, row.project_id],
      )
      projectRoles = rolesResult.rows.map((r: any) => r.role_name)
    }

    const rolePermissions = row.project_id ? await loadRolePermissions(row.project_id, projectRoles) : {}
    const { roles, permissions } = buildRolesAndPermissions(row.role, projectRoles, rolePermissions)

    return {
      type: "user",
      user_id: userId,
      team_id: row.team_id,
      project_id: row.project_id,
      role: row.role,
      scopes: ["*"],
      project_roles: projectRoles.length > 0 ? projectRoles : undefined,
      roles,
      permissions: permissions.length > 0 ? permissions : undefined,
    }
  }

  // ── Fallback: no headers — pick the first team/project (original behaviour) ──
  const result = await pool.query(
    `SELECT 
      tm.team_id,
      tm.role,
      tm.user_id,
      t.id as team_id,
      p.id as project_id,
      ak.scopes as api_key_scopes
     FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     LEFT JOIN projects p ON p.team_id = t.id AND p.status != 'deleted'
     LEFT JOIN api_keys ak ON ak.project_id = p.id
     WHERE tm.user_id = $1
     ORDER BY tm.joined_at DESC
     LIMIT 1`,
    [userId],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]

  // Get custom project roles for this user
  let projectRoles: string[] = []
  if (row.project_id) {
    const rolesResult = await pool.query(
      `SELECT role_name
       FROM user_project_roles
       WHERE user_id = $1
       AND project_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, row.project_id],
    )
    projectRoles = rolesResult.rows.map((r: any) => r.role_name)
  }

  const rolePermissions = row.project_id ? await loadRolePermissions(row.project_id, projectRoles) : {}
  const { roles, permissions } = buildRolesAndPermissions(row.role, projectRoles, rolePermissions)

  return {
    type: "user",
    user_id: userId,
    team_id: row.team_id,
    project_id: row.project_id,
    role: row.role,
    scopes: row.api_key_scopes || ["*"],
    project_roles: projectRoles.length > 0 ? projectRoles : undefined,
    roles,
    permissions: permissions.length > 0 ? permissions : undefined,
  }
}

/**
 * Validates API key and returns service identity context
 */
export const validateServiceIdentity = async (apiKey: string): Promise<IdentityContext | null> => {
  // Verify API key
  const verification = await apiKeyService.verifyAPIKey(apiKey)

  if (!verification.valid || !verification.apiKey) {
    return null
  }

  const apiKeyRecord = verification.apiKey

  // Get project and team info
  const result = await pool.query(
    `SELECT 
      p.id as project_id,
      p.team_id,
      p.region,
      ak.id as api_key_id,
      ak.scopes
     FROM api_keys ak
     JOIN projects p ON ak.project_id = p.id
     WHERE ak.id = $1
     AND ak.status = 'active'
     AND p.status != 'deleted'`,
    [apiKeyRecord.id],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]

  return {
    type: "service",
    api_key_id: row.api_key_id,
    project_id: row.project_id,
    team_id: row.team_id,
    scopes: row.scopes || [],
    // Service accounts don't have roles or project_roles
  }
}

/**
 * Main validation function that handles both JWT and API key
 */
export const validateIdentity = async (
  authorization: string | undefined,
  options?: IdentityOptions,
): Promise<IdentityContext | null> => {
  if (!authorization) {
    return null
  }

  // Check if it's a Bearer token (JWT)
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.substring(7)
    return validateUserIdentity(token, options)
  }

  // Otherwise treat as API key (API keys already have project scope baked in)
  return validateServiceIdentity(authorization)
}

/**
 * Get user's project roles
 * Used when user context needs custom project role information
 */
export const getUserProjectRoles = async (userId: string, projectId: string): Promise<string[]> => {
  const result = await pool.query(
    `SELECT role_name
     FROM user_project_roles
     WHERE user_id = $1
     AND project_id = $2
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, projectId],
  )

  return result.rows.map((r) => r.role_name)
}

/**
 * Assign project role to user
 * Used by project admins to grant custom roles
 */
export const assignProjectRole = async (
  userId: string,
  projectId: string,
  roleName: string,
  assignedBy: string,
  expiresAt?: Date,
): Promise<boolean> => {
  try {
    // Check if role exists for this project
    const roleResult = await pool.query(
      `SELECT id FROM project_roles 
       WHERE project_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [projectId, roleName],
    )

    if (roleResult.rows.length === 0) {
      throw new Error(`Role ${roleName} does not exist in project ${projectId}`)
    }

    // Assign role to user
    await pool.query(
      `INSERT INTO user_project_roles (user_id, project_id, role_name, assigned_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, project_id, role_name) 
       DO UPDATE SET 
         assigned_by = EXCLUDED.assigned_by,
         expires_at = EXCLUDED.expires_at,
         assigned_at = NOW()`,
      [userId, projectId, roleName, assignedBy, expiresAt || null],
    )

    return true
  } catch (error) {
    console.error("Error assigning project role:", error)
    return false
  }
}

/**
 * Remove project role from user
 */
export const removeProjectRole = async (userId: string, projectId: string, roleName: string): Promise<boolean> => {
  try {
    const result = await pool.query(
      `DELETE FROM user_project_roles
       WHERE user_id = $1 AND project_id = $2 AND role_name = $3`,
      [userId, projectId, roleName],
    )

    return result.rowCount > 0
  } catch (error) {
    console.error("Error removing project role:", error)
    return false
  }
}

/**
 * Create custom project role
 */
export const createProjectRole = async (
  projectId: string,
  name: string,
  description?: string,
  permissions?: string[],
): Promise<string | null> => {
  try {
    const result = await pool.query(
      `INSERT INTO project_roles (project_id, name, description, permissions, is_system)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id`,
      [projectId, name, description || null, permissions || []],
    )

    return result.rows[0].id
  } catch (error) {
    console.error("Error creating project role:", error)
    return null
  }
}

/**
 * Get all roles for a project
 */
export const getProjectRoles = async (projectId: string): Promise<any[]> => {
  const result = await pool.query(
    `SELECT 
      id,
      name,
      description,
      permissions,
      is_system,
      created_at
     FROM project_roles
     WHERE project_id = $1
     AND deleted_at IS NULL
     ORDER BY is_system DESC, name ASC`,
    [projectId],
  )

  return result.rows
}
