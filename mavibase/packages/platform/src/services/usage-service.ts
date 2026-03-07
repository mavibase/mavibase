import { pool } from "../config/database"

export const incrementUsage = async (projectId: string, metric: string, delta: bigint): Promise<bigint> => {
  // Record the usage event for resource monitoring and analytics
  await pool.query(
    `INSERT INTO usage_events (project_id, metric, delta)
     VALUES ($1, $2, $3)`,
    [projectId, metric, delta.toString()],
  )

  // Update the aggregated usage counter
  const result = await pool.query(`SELECT increment_project_usage($1, $2, $3) as new_value`, [
    projectId,
    metric,
    delta.toString(),
  ])

  return BigInt(result.rows[0].new_value)
}

export const getUsage = async (projectId: string, metric: string): Promise<{ value: bigint; quota: bigint | null }> => {
  const result = await pool.query(
    `SELECT value, quota_limit FROM project_usage WHERE project_id = $1 AND metric = $2`,
    [projectId, metric],
  )

  if (result.rows.length === 0) {
    return { value: BigInt(0), quota: null }
  }

  return {
    value: BigInt(result.rows[0].value),
    quota: result.rows[0].quota_limit ? BigInt(result.rows[0].quota_limit) : null,
  }
}

export const checkQuota = async (projectId: string, metric: string): Promise<boolean> => {
  const { value, quota } = await getUsage(projectId, metric)
  if (quota === null) return true // No quota = unlimited
  return value < quota
}

export const setQuota = async (projectId: string, metric: string, quota: bigint): Promise<void> => {
  await pool.query(
    `INSERT INTO project_usage (project_id, metric, quota_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, metric) DO UPDATE SET quota_limit = $3`,
    [projectId, metric, quota.toString()],
  )
}

export const getAllProjectUsage = async (
  projectId: string,
): Promise<Array<{ metric: string; value: bigint; quota: bigint | null }>> => {
  const result = await pool.query(`SELECT metric, value, quota_limit FROM project_usage WHERE project_id = $1`, [
    projectId,
  ])

  return result.rows.map((row) => ({
    metric: row.metric,
    value: BigInt(row.value),
    quota: row.quota_limit ? BigInt(row.quota_limit) : null,
  }))
}
