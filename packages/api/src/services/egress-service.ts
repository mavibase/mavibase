import { pool } from "@mavibase/platform/config/database"
import { logger } from "@mavibase/platform/utils/logger"

// Egress limit from environment variable
const EGRESS_LIMIT_GB = parseInt(process.env.EGRESS_LIMIT_PER_PROJECT || "100", 10)
const EGRESS_LIMIT_BYTES = BigInt(EGRESS_LIMIT_GB) * BigInt(1024 * 1024 * 1024)

interface TrackEgressParams {
  projectId: string
  apiKeyId: string
  bytes: number
  endpoint: string
  method: string
}

/**
 * Track egress (bandwidth) for a project
 * Uses simple INSERT/UPDATE queries - no PostgreSQL functions needed
 */
export async function trackEgress({
  projectId,
  apiKeyId,
  bytes,
  endpoint,
  method,
}: TrackEgressParams): Promise<void> {
  try {
    // Get team_id from project
    const projectResult = await pool.query(
      `SELECT team_id FROM projects WHERE id = $1`,
      [projectId]
    )
    
    if (projectResult.rows.length === 0) {
      logger.warn("[EgressService] Project not found for egress tracking", { projectId })
      return
    }
    
    const teamId = projectResult.rows[0].team_id

    // Insert egress event
    await pool.query(
      `INSERT INTO egress_events (project_id, api_key_id, bytes, endpoint, method)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, apiKeyId, bytes, endpoint, method]
    )

    // Update project_usage for egress_bytes metric
    await pool.query(
      `INSERT INTO project_usage (project_id, metric, value)
       VALUES ($1, 'egress_bytes', $2)
       ON CONFLICT (project_id, metric)
       DO UPDATE SET 
         value = project_usage.value + $2,
         updated_at = CURRENT_TIMESTAMP`,
      [projectId, bytes]
    )

    // Update team's current egress
    await pool.query(
      `UPDATE teams
       SET current_egress_bytes = current_egress_bytes + $1, updated_at = NOW()
       WHERE id = $2`,
      [bytes, teamId]
    )

    logger.debug("[EgressService] Tracked egress", {
      projectId,
      bytes,
      endpoint,
      method,
    })
  } catch (error) {
    // Log but don't fail the request - egress tracking is non-critical
    logger.error("[EgressService] Failed to track egress", {
      projectId,
      bytes,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Check if a project has exceeded its egress limit
 */
export async function isEgressLimitExceeded(projectId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT value FROM project_usage WHERE project_id = $1 AND metric = 'egress_bytes'`,
      [projectId]
    )

    if (result.rows.length === 0) {
      return false
    }

    const currentEgress = BigInt(result.rows[0].value || 0)
    return currentEgress >= EGRESS_LIMIT_BYTES
  } catch (error) {
    logger.error("[EgressService] Failed to check egress limit", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false // Don't block on error
  }
}

/**
 * Get current egress usage for a project
 */
export async function getProjectEgress(projectId: string): Promise<{
  current: bigint
  limit: bigint
  percentage: number
}> {
  try {
    const result = await pool.query(
      `SELECT value FROM project_usage WHERE project_id = $1 AND metric = 'egress_bytes'`,
      [projectId]
    )

    const current = BigInt(result.rows[0]?.value || 0)
    const limit = EGRESS_LIMIT_BYTES
    const percentage = Number((current * BigInt(100)) / limit)

    return { current, limit, percentage }
  } catch (error) {
    logger.error("[EgressService] Failed to get project egress", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { current: BigInt(0), limit: EGRESS_LIMIT_BYTES, percentage: 0 }
  }
}

/**
 * Get egress limit in bytes
 */
export function getEgressLimitBytes(): bigint {
  return EGRESS_LIMIT_BYTES
}

/**
 * Get egress limit in GB
 */
export function getEgressLimitGB(): number {
  return EGRESS_LIMIT_GB
}

/**
 * Get egress breakdown by endpoint for a project
 */
export async function getEgressBreakdown(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ endpoint: string; method: string; bytes: number; count: number }[]> {
  try {
    const start = startDate || new Date(new Date().setDate(1)) // First of current month
    const end = endDate || new Date()

    const result = await pool.query(
      `SELECT 
         endpoint,
         method,
         SUM(bytes)::bigint as bytes,
         COUNT(*)::int as count
       FROM egress_events
       WHERE project_id = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY endpoint, method
       ORDER BY bytes DESC`,
      [projectId, start, end]
    )

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      method: row.method,
      bytes: Number(row.bytes),
      count: row.count,
    }))
  } catch (error) {
    logger.error("[EgressService] Failed to get egress breakdown", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * Get daily egress for a project
 */
export async function getDailyEgress(
  projectId: string,
  days: number = 30
): Promise<{ date: string; bytes: number }[]> {
  try {
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         SUM(bytes)::bigint as bytes
       FROM egress_events
       WHERE project_id = $1
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [projectId]
    )

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      bytes: Number(row.bytes),
    }))
  } catch (error) {
    logger.error("[EgressService] Failed to get daily egress", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * Calculate response size in bytes
 */
export function calculateResponseSize(data: unknown): number {
  if (data === null || data === undefined) return 0
  if (typeof data === 'string') return Buffer.byteLength(data, 'utf8')
  if (Buffer.isBuffer(data)) return data.length
  return Buffer.byteLength(JSON.stringify(data), 'utf8')
}
