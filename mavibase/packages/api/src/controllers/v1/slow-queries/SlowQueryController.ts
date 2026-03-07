import type { Request, Response, NextFunction } from "express"
import { pool } from "@mavibase/database/config/database"
import { AppError } from "@mavibase/api/middleware/error-handler"

export class SlowQueryController {
  /**
   * GET /databases/:databaseId/slow-queries
   * List slow query logs for a database with pagination and filtering
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const projectId = req.identity!.project_id

      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const limit = Math.min(Number.parseInt(req.query.limit as string) || 50, 200)
      const offset = Number.parseInt(req.query.offset as string) || 0
      const operation = req.query.operation as string | undefined
      const minDuration = Number.parseInt(req.query.min_duration as string) || 0
      const sortBy = (req.query.sort_by as string) === "duration" ? "duration_ms" : "created_at"
      const sortOrder = (req.query.sort_order as string) === "asc" ? "ASC" : "DESC"

      let whereClauses = ["(database_id = $1 OR database_id IS NULL)"]
      let params: any[] = [databaseId]
      let paramIndex = 2

      if (operation) {
        whereClauses.push(`operation = $${paramIndex}`)
        params.push(operation.toUpperCase())
        paramIndex++
      }

      if (minDuration > 0) {
        whereClauses.push(`duration_ms >= $${paramIndex}`)
        params.push(minDuration)
        paramIndex++
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM slow_query_logs ${whereStr}`,
        params
      )
      const total = parseInt(countResult.rows[0].total, 10)

      // Get paginated results
      params.push(limit, offset)
      const result = await pool.query(
        `SELECT * FROM slow_query_logs ${whereStr}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      )

      res.json({
        success: true,
        message: `Retrieved ${result.rows.length} slow query log(s)`,
        data: result.rows,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + result.rows.length < total,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /databases/:databaseId/slow-queries/stats
   * Get aggregated slow query statistics
   */
  stats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const projectId = req.identity!.project_id

      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_slow_queries,
          COALESCE(AVG(duration_ms), 0)::INTEGER as avg_duration_ms,
          COALESCE(MAX(duration_ms), 0) as max_duration_ms,
          COALESCE(MIN(duration_ms), 0) as min_duration_ms,
          COUNT(CASE WHEN duration_ms > 5000 THEN 1 END) as critical_count,
          COUNT(CASE WHEN duration_ms BETWEEN 1000 AND 5000 THEN 1 END) as warning_count,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d
        FROM slow_query_logs
        WHERE database_id = $1 OR database_id IS NULL`,
        [databaseId]
      )

      // Top operations breakdown
      const operationBreakdown = await pool.query(
        `SELECT operation, COUNT(*) as count, AVG(duration_ms)::INTEGER as avg_duration
         FROM slow_query_logs
         WHERE database_id = $1 OR database_id IS NULL
         GROUP BY operation
         ORDER BY count DESC`,
        [databaseId]
      )

      // Hourly trend for last 24 hours
      const hourlyTrend = await pool.query(
        `SELECT 
          date_trunc('hour', created_at) as hour,
          COUNT(*) as count,
          AVG(duration_ms)::INTEGER as avg_duration
        FROM slow_query_logs
        WHERE (database_id = $1 OR database_id IS NULL)
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', created_at)
        ORDER BY hour ASC`,
        [databaseId]
      )

      res.json({
        success: true,
        data: {
          summary: result.rows[0],
          operationBreakdown: operationBreakdown.rows,
          hourlyTrend: hourlyTrend.rows,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /databases/:databaseId/slow-queries
   * Clear slow query logs for a database
   */
  clear = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const projectId = req.identity!.project_id

      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const result = await pool.query(
        `DELETE FROM slow_query_logs WHERE database_id = $1 OR database_id IS NULL`,
        [databaseId]
      )

      res.json({
        success: true,
        message: `Cleared ${result.rowCount} slow query log(s)`,
        data: { deleted: result.rowCount },
      })
    } catch (error) {
      next(error)
    }
  }
}
