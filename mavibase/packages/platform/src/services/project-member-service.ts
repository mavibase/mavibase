import { pool } from "../config/database"

export type ProjectRole = "owner" | "admin" | "developer" | "viewer"

interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  joined_at: Date
  updated_at: Date
}

export const addProjectMember = async (
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<ProjectMember> => {
  const result = await pool.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [projectId, userId, role],
  )

  return result.rows[0]
}

export const removeProjectMember = async (projectId: string, userId: string): Promise<void> => {
  try {
    await pool.query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId])
  } catch (error: any) {
    // Handle "last owner" constraint
    if (error.message.includes("last owner")) {
      const err: any = new Error("Cannot remove the last owner from a project")
      err.statusCode = 400
      err.code = "LAST_OWNER_PROTECTION"
      throw err
    }
    throw error
  }
}

export const updateProjectMemberRole = async (projectId: string, userId: string, role: ProjectRole): Promise<void> => {
  try {
    await pool.query(
      `UPDATE project_members SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE project_id = $2 AND user_id = $3`,
      [role, projectId, userId],
    )
  } catch (error: any) {
    // Handle "last owner" constraint
    if (error.message.includes("last owner")) {
      const err: any = new Error("Cannot change role of the last owner. Promote another member first.")
      err.statusCode = 400
      err.code = "LAST_OWNER_PROTECTION"
      throw err
    }
    throw error
  }
}

export const getProjectMember = async (projectId: string, userId: string): Promise<ProjectMember | null> => {
  const result = await pool.query(`SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2`, [
    projectId,
    userId,
  ])

  return result.rows[0] || null
}

export const listProjectMembers = async (projectId: string): Promise<ProjectMember[]> => {
  const result = await pool.query(
    `SELECT pm.*, pu.email, pu.name 
     FROM project_members pm
     JOIN platform_users pu ON pm.user_id = pu.id
     WHERE pm.project_id = $1
     ORDER BY pm.joined_at ASC`,
    [projectId],
  )

  return result.rows
}

export const getUserProjectRole = async (projectId: string, userId: string): Promise<ProjectRole | null> => {
  const member = await getProjectMember(projectId, userId)
  return member ? member.role : null
}

export const hasProjectPermission = async (
  projectId: string,
  userId: string,
  requiredRole: ProjectRole,
): Promise<boolean> => {
  const userRole = await getUserProjectRole(projectId, userId)
  if (!userRole) return false

  const roleHierarchy: ProjectRole[] = ["viewer", "developer", "admin", "owner"]
  const userRoleLevel = roleHierarchy.indexOf(userRole)
  const requiredRoleLevel = roleHierarchy.indexOf(requiredRole)

  return userRoleLevel >= requiredRoleLevel
}
