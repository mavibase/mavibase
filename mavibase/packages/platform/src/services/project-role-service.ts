import { pool } from "../config/database"

export interface ProjectRole {
  id: string
  project_id: string
  name: string
  description?: string
  permissions: string[]
  is_system: boolean
  created_at: Date
  updated_at: Date
}

export interface UserProjectRole {
  user_id: string
  project_id: string
  role_name: string
  assigned_at: Date
  assigned_by?: string
  expires_at?: Date
}

/**
 * Create a custom project role
 */
export const createProjectRole = async (data: {
  project_id: string
  name: string
  description?: string
  permissions: string[]
}): Promise<ProjectRole> => {
  const { project_id, name, description, permissions } = data

  const result = await pool.query(
    `INSERT INTO project_roles (project_id, name, description, permissions, is_system)
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [project_id, name, description, permissions],
  )

  return result.rows[0]
}

/**
 * Get all roles for a project
 */
export const getProjectRoles = async (projectId: string): Promise<ProjectRole[]> => {
  const result = await pool.query(
    `SELECT * FROM project_roles
     WHERE project_id = $1
     AND deleted_at IS NULL
     ORDER BY is_system DESC, name ASC`,
    [projectId],
  )

  return result.rows
}

/**
 * Get a single project role by ID
 */
export const getProjectRoleById = async (roleId: string): Promise<ProjectRole | null> => {
  const result = await pool.query(
    `SELECT * FROM project_roles
     WHERE id = $1
     AND deleted_at IS NULL`,
    [roleId],
  )

  return result.rows[0] || null
}

/**
 * Update a project role
 */
export const updateProjectRole = async (
  roleId: string,
  data: {
    name?: string
    description?: string
    permissions?: string[]
  },
): Promise<ProjectRole> => {
  const updates: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`)
    values.push(data.name)
  }

  if (data.description !== undefined) {
    updates.push(`description = $${paramCount++}`)
    values.push(data.description)
  }

  if (data.permissions !== undefined) {
    updates.push(`permissions = $${paramCount++}`)
    values.push(data.permissions)
  }

  updates.push(`updated_at = NOW()`)
  values.push(roleId)

  const result = await pool.query(
    `UPDATE project_roles
     SET ${updates.join(", ")}
     WHERE id = $${paramCount}
     AND deleted_at IS NULL
     RETURNING *`,
    values,
  )

  return result.rows[0]
}

/**
 * Delete a project role (soft delete)
 */
export const deleteProjectRole = async (roleId: string): Promise<void> => {
  await pool.query(
    `UPDATE project_roles
     SET deleted_at = NOW()
     WHERE id = $1`,
    [roleId],
  )

  // Also remove all user assignments for this role
  await pool.query(
    `DELETE FROM user_project_roles
     WHERE project_id = (SELECT project_id FROM project_roles WHERE id = $1)
     AND role_name = (SELECT name FROM project_roles WHERE id = $1)`,
    [roleId],
  )
}

/**
 * Assign a role to a user
 */
export const assignRoleToUser = async (data: {
  user_id: string
  project_id: string
  role_name: string
  assigned_by?: string
  expires_at?: Date
}): Promise<UserProjectRole> => {
  const { user_id, project_id, role_name, assigned_by, expires_at } = data

  const result = await pool.query(
    `INSERT INTO user_project_roles (user_id, project_id, role_name, assigned_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, project_id, role_name) 
     DO UPDATE SET 
       assigned_at = NOW(),
       assigned_by = EXCLUDED.assigned_by,
       expires_at = EXCLUDED.expires_at
     RETURNING *`,
    [user_id, project_id, role_name, assigned_by, expires_at],
  )

  return result.rows[0]
}

/**
 * Remove a role from a user
 */
export const removeRoleFromUser = async (userId: string, projectId: string, roleName: string): Promise<void> => {
  await pool.query(
    `DELETE FROM user_project_roles
     WHERE user_id = $1
     AND project_id = $2
     AND role_name = $3`,
    [userId, projectId, roleName],
  )
}

/**
 * Get all role assignments for a project
 */
export const getProjectRoleAssignments = async (projectId: string) => {
  const result = await pool.query(
    `SELECT 
       upr.*,
       pu.email,
       pu.name
     FROM user_project_roles upr
     JOIN platform_users pu ON upr.user_id = pu.id
     WHERE upr.project_id = $1
     ORDER BY upr.assigned_at DESC`,
    [projectId],
  )

  return result.rows
}

/**
 * Get all roles for a user in a project
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

  return result.rows.map((row) => row.role_name)
}
