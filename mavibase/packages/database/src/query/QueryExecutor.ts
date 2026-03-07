import { Pool, PoolClient, QueryResult } from "pg"
import { logger } from "@mavibase/database/utils/logger"

/**
 * Query Executor
 * Handles query execution with:
 * - Automatic query timeouts
 * - Slow query detection and logging
 * - Query performance tracking
 */
export class QueryExecutor {
  private static readonly QUERY_TIMEOUT_MS = 30000 // 30 seconds
  private static readonly SLOW_QUERY_THRESHOLD_MS = 1000 // 1 second

  /**
   * Execute a query with timeout and slow query detection
   */
  static async execute<T = any>(
    poolOrClient: Pool | PoolClient,
    sql: string,
    params: any[] = [],
    context?: {
      projectId?: string
      operation?: string
      resource?: string
    },
  ): Promise<QueryResult<T>> {
    const startTime = Date.now()
    let client: PoolClient | null = null
    const isPool = "connect" in poolOrClient

    try {
      // Get client from pool if needed
      if (isPool) {
        client = await (poolOrClient as Pool).connect()
      } else {
        client = poolOrClient as PoolClient
      }

      // Set statement timeout to prevent long-running queries
      await client.query(`SET statement_timeout = ${this.QUERY_TIMEOUT_MS}`)

      // Execute the actual query
      const result = await client.query<T>(sql, params)

      // Calculate duration
      const duration = Date.now() - startTime

      // Log slow queries
      if (duration > this.SLOW_QUERY_THRESHOLD_MS) {
        this.logSlowQuery(sql, params, duration, context)
      }

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      // Check if it was a timeout error
      if (error.message?.includes("statement timeout") || error.code === "57014") {
        logger.error("Query timeout exceeded", {
          duration,
          timeout: this.QUERY_TIMEOUT_MS,
          sql: this.sanitizeQuery(sql),
          params: this.sanitizeParams(params),
          ...context,
        })

        throw new Error(
          `Query timeout: Query exceeded ${this.QUERY_TIMEOUT_MS}ms limit. Please optimize your query or contact support.`,
        )
      }

      // Log other errors
      logger.error("Query execution error", {
        error: error.message,
        duration,
        sql: this.sanitizeQuery(sql),
        params: this.sanitizeParams(params),
        ...context,
      })

      throw error
    } finally {
      // Release client back to pool if we acquired it
      if (isPool && client) {
        client.release()
      }
    }
  }

  /**
   * Execute query within a transaction
   */
  static async executeInTransaction<T = any>(
    client: PoolClient,
    sql: string,
    params: any[] = [],
    context?: {
      projectId?: string
      operation?: string
      resource?: string
    },
  ): Promise<QueryResult<T>> {
    // Don't set timeout again if already in transaction
    // The timeout is set when transaction begins
    const startTime = Date.now()

    try {
      const result = await client.query<T>(sql, params)
      const duration = Date.now() - startTime

      if (duration > this.SLOW_QUERY_THRESHOLD_MS) {
        this.logSlowQuery(sql, params, duration, { ...context, inTransaction: true })
      }

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      logger.error("Transaction query error", {
        error: error.message,
        duration,
        sql: this.sanitizeQuery(sql),
        params: this.sanitizeParams(params),
        ...context,
      })

      throw error
    }
  }

  /**
   * Log slow query with details.
   * Note: Persistence to slow_query_logs is handled automatically by the
   * instrumented pool in config/database.ts - no need to duplicate here.
   */
  private static logSlowQuery(
    sql: string,
    params: any[],
    duration: number,
    context?: any,
  ): void {
    logger.warn("Slow query detected", {
      duration,
      threshold: this.SLOW_QUERY_THRESHOLD_MS,
      sql: this.sanitizeQuery(sql),
      params: this.sanitizeParams(params),
      suggestion: this.generateOptimizationSuggestion(sql, duration),
      ...context,
    })
  }

  /**
   * Sanitize query for logging (remove sensitive data, truncate)
   */
  private static sanitizeQuery(sql: string): string {
    // Remove extra whitespace
    let sanitized = sql.replace(/\s+/g, " ").trim()

    // Truncate if too long
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + "... [truncated]"
    }

    return sanitized
  }

  /**
   * Sanitize parameters for logging
   */
  private static sanitizeParams(params: any[]): string {
    try {
      const sanitized = params.map((param) => {
        // Don't log large objects
        if (typeof param === "object" && param !== null) {
          return "[object]"
        }
        // Don't log potential sensitive strings
        if (typeof param === "string" && param.length > 100) {
          return `[string:${param.length}chars]`
        }
        return param
      })

      const json = JSON.stringify(sanitized)
      return json.length > 200 ? json.substring(0, 200) + "..." : json
    } catch {
      return "[unable to serialize]"
    }
  }

  /**
   * Generate optimization suggestions based on query
   */
  private static generateOptimizationSuggestion(sql: string, duration: number): string {
    const sqlLower = sql.toLowerCase()

    // Missing WHERE clause
    if (
      (sqlLower.includes("select") || sqlLower.includes("update") || sqlLower.includes("delete")) &&
      !sqlLower.includes("where")
    ) {
      return "Consider adding WHERE clause to filter results and reduce query time"
    }

    // Missing indexes
    if (sqlLower.includes("where") && duration > 2000) {
      return "Query is slow - consider adding indexes on columns used in WHERE clause"
    }

    // Large OFFSET
    if (sqlLower.includes("offset") && sqlLower.match(/offset\s+(\d+)/)?.[1]) {
      const offset = parseInt(sqlLower.match(/offset\s+(\d+)/)?.[1] || "0")
      if (offset > 1000) {
        return "Large OFFSET detected - consider using cursor-based pagination instead"
      }
    }

    // Unindexed ORDER BY
    if (sqlLower.includes("order by") && duration > 1500) {
      return "Slow ORDER BY - ensure columns used for sorting are indexed"
    }

    // JOIN without indexes
    if (sqlLower.includes("join") && duration > 2000) {
      return "Slow JOIN - ensure foreign key columns are indexed"
    }

    // Multiple JOINs
    const joinCount = (sql.match(/\bJOIN\b/gi) || []).length
    if (joinCount > 3) {
      return `Query has ${joinCount} JOINs - consider denormalization or caching`
    }

    // Full table scan (no specific suggestion)
    if (duration > 5000) {
      return "Very slow query - may be performing full table scan. Review EXPLAIN output and add appropriate indexes"
    }

    return "Consider optimizing this query or caching results"
  }

  /**
   * Get query execution plan (for debugging)
   */
  static async explain(
    poolOrClient: Pool | PoolClient,
    sql: string,
    params: any[] = [],
  ): Promise<any[]> {
    const explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${sql}`

    try {
      const result = await this.execute(poolOrClient, explainSql, params, {
        operation: "EXPLAIN",
      })

      return result.rows[0]?.["QUERY PLAN"] || []
    } catch (error) {
      logger.error("Failed to generate query plan", { error })
      return []
    }
  }

  /**
   * Check if query would benefit from an index
   */
  static async analyzeQuery(
    poolOrClient: Pool | PoolClient,
    sql: string,
    params: any[] = [],
  ): Promise<{
    isOptimal: boolean
    suggestions: string[]
    estimatedCost: number
  }> {
    try {
      const plan = await this.explain(poolOrClient, sql, params)
      const suggestions: string[] = []

      // Parse plan for optimization opportunities
      const planStr = JSON.stringify(plan).toLowerCase()

      if (planStr.includes("seq scan")) {
        suggestions.push("Sequential scan detected - consider adding index")
      }

      if (planStr.includes("sort")) {
        suggestions.push("Sort operation detected - index on ORDER BY columns may help")
      }

      // Extract estimated cost (simplified)
      const estimatedCost = parseFloat(planStr.match(/"total_cost":\s*(\d+\.?\d*)/)?.[1] || "0")

      return {
        isOptimal: suggestions.length === 0,
        suggestions,
        estimatedCost,
      }
    } catch (error) {
      return {
        isOptimal: false,
        suggestions: ["Unable to analyze query"],
        estimatedCost: 0,
      }
    }
  }
}
