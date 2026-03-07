import { pool } from "../config/database"
import { nanoid } from "nanoid"
import { checkTeamQuota } from "./team-service"
import type { PoolClient } from "pg"

interface CreateProjectParams {
  teamId: string
  name: string
  environment: "production" | "staging" | "development" // Fixed environment type
  description?: string
  metadata?: any
}

interface Project {
  id: string
  team_id: string
  name: string
  slug: string
  environment: "production" | "staging" | "development"
  status: "active" | "disabled"
  description: string | null
  settings: Record<string, any>
  created_at: Date
  updated_at: Date
}

export const createProject = async (params: CreateProjectParams): Promise<Project> => {
  const { teamId, name, environment, description, metadata } = params

  await checkTeamQuota(teamId)

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const slug = `${baseSlug}-${nanoid(6)}`

  const result = await pool.query(
    `INSERT INTO projects (team_id, name, slug, environment, description, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING *`,
    [teamId, name, slug, environment, description || null],
  )

  return result.rows[0]
}

export const createPersonalProject = async (teamId: string, teamName: string, client?: PoolClient) => {
  const projectName = `${teamName}-project`
  const dbClient = client || pool

  const baseSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const slug = `${baseSlug}-${nanoid(6)}`

  const result = await dbClient.query(
    `INSERT INTO projects (team_id, name, slug, environment, description, status)
     VALUES ($1, $2, $3, 'production', 'Default project', 'active')
     RETURNING *`,
    [teamId, projectName, slug],
  )

  return result.rows[0]
}

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  const result = await pool.query(`SELECT * FROM projects WHERE id = $1 AND status != 'deleted'`, [projectId])

  return result.rows[0] || null
}

export const getProjectsByTeamId = async (teamId: string): Promise<Project[]> => {
  const result = await pool.query(
    `SELECT * FROM projects WHERE team_id = $1 AND status != 'deleted' ORDER BY created_at DESC`,
    [teamId],
  )

  return result.rows
}

export const updateProject = async (
  projectId: string,
  updates: Partial<Pick<Project, "name" | "description" | "status" | "settings" | "environment">> & { metadata?: any },
): Promise<Project> => {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++
  }

  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex}`)
    values.push(updates.description)
    paramIndex++
  }

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex}`)
    values.push(updates.status)
    paramIndex++
  }

  if (updates.settings !== undefined) {
    fields.push(`settings = $${paramIndex}`)
    values.push(JSON.stringify(updates.settings))
    paramIndex++
  }

  if (updates.environment !== undefined) {
    fields.push(`environment = $${paramIndex}`)
    values.push(updates.environment)
    paramIndex++
  }

  if (fields.length === 0) {
    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error("Project not found")
    }
    return project
  }

  fields.push(`updated_at = NOW()`)
  values.push(projectId)

  const result = await pool.query(
    `UPDATE projects SET ${fields.join(", ")} WHERE id = $${paramIndex} AND status != 'deleted' RETURNING *`,
    values,
  )

  if (result.rows.length === 0) {
    throw new Error("Project not found")
  }

  return result.rows[0]
}

export const deleteProject = async (projectId: string): Promise<void> => {
  await pool.query(`UPDATE projects SET status = 'deleted', updated_at = NOW() WHERE id = $1`, [projectId])
}

export const verifyProjectAccess = async (projectId: string, userId: string): Promise<boolean> => {
  const result = await pool.query(
    `SELECT p.id 
     FROM projects p
     JOIN teams t ON p.team_id = t.id
     JOIN team_members tm ON t.id = tm.team_id
     WHERE p.id = $1 AND tm.user_id = $2 AND p.status != 'deleted'`,
    [projectId, userId],
  )

  return result.rows.length > 0
}

export const getProjectStats = async (projectId: string) => {
  const statsResult = await pool.query(
    `SELECT 
      p.id,
      p.name,
      p.environment,
      p.status,
      p.created_at,
      (SELECT COUNT(*) FROM api_keys WHERE project_id = p.id AND revoked_at IS NULL) as api_keys_count
     FROM projects p
     WHERE p.id = $1`,
    [projectId],
  )

  return statsResult.rows[0]
}

export const getProjectUsage = async (projectId: string) => {
  const usageResult = await pool.query(
    `SELECT 
       metric,
       value,
       quota_limit,
       updated_at,
       reset_at
     FROM project_usage
     WHERE project_id = $1
     ORDER BY metric`,
    [projectId],
  )

  return usageResult.rows.reduce((acc: any, row: any) => {
    acc[row.metric] = {
      value: row.value,
      limit: row.quota_limit,
      updated_at: row.updated_at,
      reset_at: row.reset_at,
    }
    return acc
  }, {})
}


