import type { Request, Response, NextFunction } from "express"
import { pool } from "@mavibase/database/config/database"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { generateId } from "@mavibase/database/utils/id-generator"
import { logger } from "@mavibase/database/utils/logger"
import type { PoolClient } from "pg"

// Transaction states
enum TransactionState {
  PENDING = "PENDING",
  COMMITTED = "COMMITTED",
  ROLLED_BACK = "ROLLED_BACK",
  EXPIRED = "EXPIRED",
}

interface ActiveTransaction {
  id: string
  client: PoolClient
  project_id: string
  team_id: string
  database_id: string  // ✅ ADDED: Database scoping
  state: TransactionState  // ✅ ADDED: State machine
  operation_count: number  // ✅ ADDED: Track operations
  started_at: Date
  expires_at: Date
  last_activity: Date
}

/**
 * Transaction Controller
 * Provides user-exposed transaction API for multi-document operations
 * 
 * SECURITY RULES:
 * 1. ✅ Transactions are scoped to (transaction_id, project_id, database_id)
 * 2. ✅ Only document operations allowed (no schema/index changes)
 * 3. ✅ Maximum 1000 operations per transaction
 * 4. ✅ Reads see committed data only (no read-your-writes)
 * 5. ✅ Permissions checked at operation time
 * 6. ✅ State machine enforced (PENDING → COMMITTED/ROLLED_BACK)
 * 7. ✅ One PoolClient per transaction (never shared)
 * 
 * Usage:
 * 1. POST /databases/:dbId/transactions -> get transaction_id
 * 2. Use transaction_id in X-Transaction-Id header for operations
 * 3. POST /databases/:dbId/transactions/:txId/commit OR /rollback
 */
export class TransactionController {
  private static transactions = new Map<string, ActiveTransaction>()
  private static cleanupInterval: NodeJS.Timeout | null = null

  // Transaction settings
  private static readonly TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private static readonly MAX_TRANSACTIONS_PER_PROJECT = 10
  private static readonly MAX_OPS_PER_TRANSACTION = 1000  // ✅ ADDED
  private static readonly CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

  /**
   * Initialize cleanup timer
   */
  static initialize(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredTransactions()
      }, this.CLEANUP_INTERVAL_MS)

      logger.info("Transaction cleanup initialized", {
        interval: this.CLEANUP_INTERVAL_MS,
        maxOpsPerTx: this.MAX_OPS_PER_TRANSACTION,
      })
    }
  }

  /**
   * Shutdown cleanup timer
   */
  static shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null

      // Rollback all active transactions
      this.transactions.forEach(async (tx) => {
        try {
          if (tx.state === TransactionState.PENDING) {
            await tx.client.query("ROLLBACK")
            tx.state = TransactionState.ROLLED_BACK
          }
          tx.client.release()
        } catch (error) {
          logger.error("Error rolling back transaction on shutdown", {
            transactionId: tx.id,
            error,
          })
        }
      })

      this.transactions.clear()
      logger.info("Transaction cleanup shutdown")
    }
  }

  /**
   * Begin a new transaction
   * POST /databases/:databaseId/transactions
   */
  begin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { databaseId } = req.params
      const projectId = req.identity!.project_id
      const teamId = req.identity!.team_id

      // ✅ Validate database exists and belongs to project
      const dbCheck = await pool.query(
        `SELECT id FROM databases WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [databaseId, projectId]
      )

      if (dbCheck.rows.length === 0) {
        throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found or access denied", {
          databaseId,
          projectId,
        })
      }

      // Check transaction limit per project
      const projectTransactions = Array.from(TransactionController.transactions.values()).filter(
        (tx) => tx.project_id === projectId && tx.state === TransactionState.PENDING,
      )

      if (projectTransactions.length >= TransactionController.MAX_TRANSACTIONS_PER_PROJECT) {
        throw new AppError(
          429,
          "TOO_MANY_TRANSACTIONS",
          `Maximum ${TransactionController.MAX_TRANSACTIONS_PER_PROJECT} concurrent transactions per project exceeded`,
          {
            current: projectTransactions.length,
            max: TransactionController.MAX_TRANSACTIONS_PER_PROJECT,
          },
        )
      }

      // Acquire database client (one per transaction - never shared)
      const client = await pool.connect()

      try {
        // Begin transaction
        await client.query("BEGIN")
        await client.query(`SET statement_timeout = ${TransactionController.TRANSACTION_TIMEOUT_MS}`)
        
        // ✅ Set transaction isolation level (Read Committed - sees only committed data)
        await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")

        // Generate transaction ID
        const transactionId = `tx_${generateId()}`
        const now = new Date()
        const expiresAt = new Date(now.getTime() + TransactionController.TRANSACTION_TIMEOUT_MS)

        // Store transaction with full scoping
        const transaction: ActiveTransaction = {
          id: transactionId,
          client,
          project_id: projectId,
          team_id: teamId,
          database_id: databaseId,  // ✅ ADDED: Database scoping
          state: TransactionState.PENDING,  // ✅ ADDED: Initial state
          operation_count: 0,  // ✅ ADDED: Track operations
          started_at: now,
          expires_at: expiresAt,
          last_activity: now,
        }

        TransactionController.transactions.set(transactionId, transaction)

        logger.info("Transaction started", {
          transactionId,
          projectId,
          databaseId,
          expiresAt,
        })

        res.status(201).json({
          success: true,
          message: "Transaction started",
          data: {
            transaction_id: transactionId,
            database_id: databaseId,
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            timeout_ms: TransactionController.TRANSACTION_TIMEOUT_MS,
            max_operations: TransactionController.MAX_OPS_PER_TRANSACTION,
            isolation_level: "READ_COMMITTED",
          },
        })
      } catch (error) {
        // Release client if BEGIN fails
        client.release()
        throw error
      }
    } catch (error) {
      next(error)
    }
  }

  /**
   * Commit a transaction
   * POST /databases/:databaseId/transactions/:transactionId/commit
   */
  commit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { databaseId, transactionId } = req.params
      const projectId = req.identity!.project_id

      // ✅ Full validation with database scoping
      const transaction = this.getTransaction(transactionId, projectId, databaseId)

      // ✅ Verify state is PENDING
      if (transaction.state !== TransactionState.PENDING) {
        throw new AppError(400, "INVALID_STATE", `Transaction is in ${transaction.state} state, cannot commit`, {
          transactionId,
          currentState: transaction.state,
        })
      }

      // Commit transaction
      await transaction.client.query("COMMIT")
      transaction.state = TransactionState.COMMITTED  // ✅ Update state
      transaction.client.release()

      // Remove from active transactions
      TransactionController.transactions.delete(transactionId)

      logger.info("Transaction committed", {
        transactionId,
        projectId,
        databaseId,
        operations: transaction.operation_count,
        duration: Date.now() - transaction.started_at.getTime(),
      })

      res.json({
        success: true,
        message: "Transaction committed successfully",
        data: {
          transaction_id: transactionId,
          operations: transaction.operation_count,
          committed_at: new Date().toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Rollback a transaction
   * POST /databases/:databaseId/transactions/:transactionId/rollback
   */
  rollback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { databaseId, transactionId } = req.params
      const projectId = req.identity!.project_id

      // ✅ Full validation with database scoping
      const transaction = this.getTransaction(transactionId, projectId, databaseId)

      // ✅ Verify state is PENDING
      if (transaction.state !== TransactionState.PENDING) {
        throw new AppError(400, "INVALID_STATE", `Transaction is in ${transaction.state} state, cannot rollback`, {
          transactionId,
          currentState: transaction.state,
        })
      }

      // Rollback transaction
      await transaction.client.query("ROLLBACK")
      transaction.state = TransactionState.ROLLED_BACK  // ✅ Update state
      transaction.client.release()

      // Remove from active transactions
      TransactionController.transactions.delete(transactionId)

      logger.info("Transaction rolled back", {
        transactionId,
        projectId,
        databaseId,
        operations: transaction.operation_count,
        duration: Date.now() - transaction.started_at.getTime(),
      })

      res.json({
        success: true,
        message: "Transaction rolled back successfully",
        data: {
          transaction_id: transactionId,
          operations: transaction.operation_count,
          rolled_back_at: new Date().toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get transaction status
   * GET /databases/:databaseId/transactions/:transactionId
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { databaseId, transactionId } = req.params
      const projectId = req.identity!.project_id

      // ✅ Full validation with database scoping
      const transaction = this.getTransaction(transactionId, projectId, databaseId)

      const now = new Date()
      const remainingMs = transaction.expires_at.getTime() - now.getTime()

      res.json({
        success: true,
        data: {
          transaction_id: transactionId,
          database_id: transaction.database_id,
          state: transaction.state,
          started_at: transaction.started_at.toISOString(),
          expires_at: transaction.expires_at.toISOString(),
          remaining_ms: Math.max(0, remainingMs),
          last_activity: transaction.last_activity.toISOString(),
          operation_count: transaction.operation_count,
          max_operations: TransactionController.MAX_OPS_PER_TRANSACTION,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * List active transactions for project
   * GET /databases/:databaseId/transactions
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { databaseId } = req.params
      const projectId = req.identity!.project_id

      // ✅ Filter by project AND database
      const projectTransactions = Array.from(TransactionController.transactions.values())
        .filter((tx) => tx.project_id === projectId && tx.database_id === databaseId)
        .map((tx) => ({
          transaction_id: tx.id,
          state: tx.state,
          started_at: tx.started_at.toISOString(),
          expires_at: tx.expires_at.toISOString(),
          last_activity: tx.last_activity.toISOString(),
          operation_count: tx.operation_count,
        }))

      res.json({
        success: true,
        data: {
          database_id: databaseId,
          transactions: projectTransactions,
          total: projectTransactions.length,
          max: TransactionController.MAX_TRANSACTIONS_PER_PROJECT,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get and validate transaction with FULL scoping
   * ✅ CRITICAL: Validates (transaction_id, project_id, database_id) tuple
   */
  private getTransaction(transactionId: string, projectId: string, databaseId: string): ActiveTransaction {
    const transaction = TransactionController.transactions.get(transactionId)

    if (!transaction) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", `Transaction ${transactionId} not found or already completed`, {
        transactionId,
      })
    }

    // ✅ CRITICAL: Verify project ownership
    if (transaction.project_id !== projectId) {
      logger.warn("Transaction project mismatch", {
        transactionId,
        expectedProject: projectId,
        actualProject: transaction.project_id,
      })
      throw new AppError(403, "FORBIDDEN", "You do not have access to this transaction", {
        transactionId,
      })
    }

    // ✅ CRITICAL: Verify database scoping
    if (transaction.database_id !== databaseId) {
      logger.warn("Transaction database mismatch", {
        transactionId,
        expectedDatabase: databaseId,
        actualDatabase: transaction.database_id,
      })
      throw new AppError(403, "FORBIDDEN", "Transaction does not belong to this database", {
        transactionId,
        expectedDatabase: databaseId,
        actualDatabase: transaction.database_id,
      })
    }

    // ✅ Check if expired
    if (new Date() > transaction.expires_at) {
      // Auto-rollback expired transaction
      if (transaction.state === TransactionState.PENDING) {
        transaction.client.query("ROLLBACK").catch(() => {})
        transaction.state = TransactionState.EXPIRED
      }
      transaction.client.release()
      TransactionController.transactions.delete(transactionId)

      throw new AppError(410, "TRANSACTION_EXPIRED", `Transaction ${transactionId} has expired and been rolled back`, {
        transactionId,
        expiredAt: transaction.expires_at.toISOString(),
      })
    }

    // Update last activity
    transaction.last_activity = new Date()

    return transaction
  }

  /**
   * Get transaction client for operations (used by document controller)
   * ✅ CRITICAL: Full scoping validation + state check + operation limit
   */
  static getTransactionClient(
    transactionId: string, 
    projectId: string, 
    databaseId: string
  ): { client: PoolClient; transaction: ActiveTransaction } | null {
    const transaction = this.transactions.get(transactionId)

    if (!transaction) return null

    // ✅ CRITICAL: Project scoping
    if (transaction.project_id !== projectId) {
      logger.warn("Transaction project mismatch in getClient", {
        transactionId,
        expectedProject: projectId,
        actualProject: transaction.project_id,
      })
      return null
    }

    // ✅ CRITICAL: Database scoping
    if (transaction.database_id !== databaseId) {
      logger.warn("Transaction database mismatch in getClient", {
        transactionId,
        expectedDatabase: databaseId,
        actualDatabase: transaction.database_id,
      })
      return null
    }

    // ✅ CRITICAL: State must be PENDING
    if (transaction.state !== TransactionState.PENDING) {
      logger.warn("Transaction not in PENDING state", {
        transactionId,
        state: transaction.state,
      })
      return null
    }

    // ✅ Check expiration
    if (new Date() > transaction.expires_at) {
      return null
    }

    // ✅ Check operation limit
    if (transaction.operation_count >= this.MAX_OPS_PER_TRANSACTION) {
      logger.warn("Transaction operation limit exceeded", {
        transactionId,
        operationCount: transaction.operation_count,
        limit: this.MAX_OPS_PER_TRANSACTION,
      })
      return null
    }

    // Update last activity
    transaction.last_activity = new Date()

    return { client: transaction.client, transaction }
  }

  /**
   * Increment operation counter for transaction
   * ✅ ADDED: Track operations per transaction
   */
  static incrementOperationCount(transactionId: string): void {
    const transaction = this.transactions.get(transactionId)
    if (transaction) {
      transaction.operation_count++
    }
  }

  /**
   * Cleanup expired transactions
   */
  private static cleanupExpiredTransactions(): void {
    const now = new Date()
    let cleanedCount = 0

    this.transactions.forEach(async (tx, txId) => {
      if (now > tx.expires_at && tx.state === TransactionState.PENDING) {
        try {
          await tx.client.query("ROLLBACK")
          tx.state = TransactionState.EXPIRED
          tx.client.release()
          this.transactions.delete(txId)
          cleanedCount++

          logger.warn("Expired transaction auto-rolled back", {
            transactionId: txId,
            projectId: tx.project_id,
            databaseId: tx.database_id,
            operations: tx.operation_count,
            expiredAt: tx.expires_at.toISOString(),
          })
        } catch (error) {
          logger.error("Error cleaning up expired transaction", {
            transactionId: txId,
            error,
          })
        }
      }
    })

    if (cleanedCount > 0) {
      logger.info("Cleaned up expired transactions", {
        count: cleanedCount,
        remaining: this.transactions.size,
      })
    }
  }
}

// Initialize cleanup on module load
TransactionController.initialize()

// Graceful shutdown
process.on("SIGINT", () => TransactionController.shutdown())
process.on("SIGTERM", () => TransactionController.shutdown())
