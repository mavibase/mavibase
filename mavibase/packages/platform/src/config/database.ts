import { Pool, QueryResultRow } from "pg"
import { logger } from "../utils/logger"

if (!process.env.PLATFORM_DB_URL) {
  throw new Error("PLATFORM_DB_URL is required")
}

const DATABASE_URL = process.env.PLATFORM_DB_URL
const url = new URL(DATABASE_URL)
const databaseName = url.pathname.replace("/", "")

/**
 * Ensure database exists before starting the app
 */
async function ensureDatabase() {
  const bootstrapUrl = new URL(DATABASE_URL)
  bootstrapUrl.pathname = "/postgres"

  const pool = new Pool({
    connectionString: bootstrapUrl.toString(),
  })

  try {
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    )

    if (result.rowCount === 0) {
      logger.info(`Database "${databaseName}" does not exist. Creating...`)
      await pool.query(`CREATE DATABASE "${databaseName}"`)
      logger.info(`Database "${databaseName}" created successfully`)
    }
  } finally {
    await pool.end()
  }
}

;(async () => {
  await ensureDatabase()
})()

/**
 * Main application pool
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
})

pool.on("error", (err) => {
  logger.error("Unexpected database error", { error: err })
})

/**
 * Typed query helper
 */
export const query = async <T extends QueryResultRow>(
  text: string,
  params?: any[]
) => {
  const start = Date.now()

  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start

    if (duration > 1000) {
      logger.warn("Slow query detected", { duration, query: text })
      // Note: slow_query_logs table lives in the database package DB, 
      // platform slow queries are only logged here
    }

    return result
  } catch (error) {
    logger.error("Database query error", { error, query: text })
    throw error
  }
}
export const testConnection = async () => {
  try {
    const client = await pool.connect()
    await client.query("SELECT NOW()")
    client.release()
    logger.info("Database connection successful")
    return true
  } catch (error) {
    logger.error("Database connection failed", error)
    return false
  }
}
