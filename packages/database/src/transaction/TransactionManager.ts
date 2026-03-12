/**
 * TransactionManager - Centralized transaction management with explicit isolation levels
 * 
 * SECURITY FIX: Addresses "Transaction Isolation Level Not Specified" vulnerability
 * by providing explicit isolation level control for all database transactions.
 * 
 * Isolation Levels:
 * - READ_COMMITTED (default): Prevents dirty reads, suitable for most operations
 * - REPEATABLE_READ: Prevents non-repeatable reads, good for reports
 * - SERIALIZABLE: Full isolation, use for audit-critical operations
 */

import type { Pool, PoolClient } from "pg"
import { logger } from "../utils/logger"

export type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE"

export interface TransactionOptions {
  /** 
   * Transaction isolation level
   * @default "READ COMMITTED"
   */
  isolationLevel?: IsolationLevel
  /**
   * Statement timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  statementTimeout?: number
  /**
   * Whether this is an audit-critical operation (forces SERIALIZABLE)
   * @default false
   */
  auditCritical?: boolean
}

/**
 * Execute a function within a database transaction with explicit isolation level.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 * 
 * @param pool - Database connection pool
 * @param fn - Async function to execute within the transaction
 * @param options - Transaction options including isolation level
 * @returns Result of the function
 * 
 * @example
 * ```typescript
 * // Standard transaction (READ COMMITTED)
 * const result = await withTransaction(pool, async (client) => {
 *   await client.query("INSERT INTO users ...", [userId])
 *   return { success: true }
 * })
 * 
 * // Audit-critical transaction (SERIALIZABLE)
 * const result = await withTransaction(pool, async (client) => {
 *   await client.query("UPDATE balances ...", [amount])
 *   return { success: true }
 * }, { auditCritical: true })
 * ```
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    isolationLevel = "READ COMMITTED",
    statementTimeout = 30000,
    auditCritical = false,
  } = options

  // Force SERIALIZABLE for audit-critical operations
  const effectiveIsolationLevel: IsolationLevel = auditCritical ? "SERIALIZABLE" : isolationLevel

  const client = await pool.connect()
  const startTime = Date.now()

  try {
    // Begin transaction with explicit isolation level
    await client.query(`BEGIN ISOLATION LEVEL ${effectiveIsolationLevel}`)
    
    // Set statement timeout
    await client.query(`SET statement_timeout = ${statementTimeout}`)

    logger.debug("Transaction started", {
      isolationLevel: effectiveIsolationLevel,
      statementTimeout,
      auditCritical,
    })

    // Execute the transaction function
    const result = await fn(client)

    // Commit on success
    await client.query("COMMIT")

    const duration = Date.now() - startTime
    logger.debug("Transaction committed", {
      isolationLevel: effectiveIsolationLevel,
      durationMs: duration,
    })

    return result
  } catch (error) {
    // Rollback on error
    try {
      await client.query("ROLLBACK")
      logger.warn("Transaction rolled back", {
        isolationLevel: effectiveIsolationLevel,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      })
    } catch (rollbackError) {
      logger.error("Failed to rollback transaction", {
        originalError: error,
        rollbackError,
      })
    }
    throw error
  } finally {
    client.release()
  }
}

/**
 * Begin a transaction manually with explicit isolation level.
 * Use this when you need more control over the transaction lifecycle.
 * 
 * IMPORTANT: Caller is responsible for COMMIT/ROLLBACK and releasing the client.
 * 
 * @param pool - Database connection pool
 * @param options - Transaction options including isolation level
 * @returns PoolClient with active transaction
 * 
 * @example
 * ```typescript
 * const client = await beginTransaction(pool, { isolationLevel: "SERIALIZABLE" })
 * try {
 *   await client.query("UPDATE ...", [values])
 *   await client.query("COMMIT")
 * } catch (error) {
 *   await client.query("ROLLBACK")
 *   throw error
 * } finally {
 *   client.release()
 * }
 * ```
 */
export async function beginTransaction(
  pool: Pool,
  options: TransactionOptions = {}
): Promise<PoolClient> {
  const {
    isolationLevel = "READ COMMITTED",
    statementTimeout = 30000,
    auditCritical = false,
  } = options

  const effectiveIsolationLevel: IsolationLevel = auditCritical ? "SERIALIZABLE" : isolationLevel

  const client = await pool.connect()

  try {
    await client.query(`BEGIN ISOLATION LEVEL ${effectiveIsolationLevel}`)
    await client.query(`SET statement_timeout = ${statementTimeout}`)

    logger.debug("Manual transaction started", {
      isolationLevel: effectiveIsolationLevel,
      statementTimeout,
    })

    return client
  } catch (error) {
    client.release()
    throw error
  }
}

/**
 * Helper to commit a transaction started with beginTransaction
 */
export async function commitTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query("COMMIT")
    logger.debug("Manual transaction committed")
  } finally {
    client.release()
  }
}

/**
 * Helper to rollback a transaction started with beginTransaction
 */
export async function rollbackTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK")
    logger.debug("Manual transaction rolled back")
  } finally {
    client.release()
  }
}

/**
 * TransactionManager class for object-oriented usage
 */
export class TransactionManager {
  constructor(private pool: Pool) {}

  /**
   * Execute function within a transaction
   */
  async execute<T>(
    fn: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return withTransaction(this.pool, fn, options)
  }

  /**
   * Begin a manual transaction
   */
  async begin(options?: TransactionOptions): Promise<PoolClient> {
    return beginTransaction(this.pool, options)
  }

  /**
   * Commit a manual transaction
   */
  async commit(client: PoolClient): Promise<void> {
    return commitTransaction(client)
  }

  /**
   * Rollback a manual transaction
   */
  async rollback(client: PoolClient): Promise<void> {
    return rollbackTransaction(client)
  }
}
