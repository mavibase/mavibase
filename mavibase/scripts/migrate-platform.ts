import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { Pool } from "pg"
import fs from "fs"

const MIGRATIONS_DIR = path.join(__dirname, "../migrations/platform")

interface Migration {
  version: number
  name: string
  file: string
}

const logger = {
  info: (message: string, meta?: any) => console.log(JSON.stringify({ level: "INFO", message, ...meta })),
  error: (message: string, meta?: any) => console.log(JSON.stringify({ level: "ERROR", message, ...meta })),
}

const pool = new Pool({
  connectionString: process.env.PLATFORM_DB_URL,
})

const getMigrations = (): Migration[] => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))

  return files
    .map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/)
      if (!match) return null

      return {
        version: Number.parseInt(match[1]),
        name: match[2],
        file: path.join(MIGRATIONS_DIR, file),
      }
    })
    .filter((m): m is Migration => m !== null)
    .sort((a, b) => a.version - b.version)
}

const runMigrations = async () => {
  const client = await pool.connect()

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get applied migrations
    const result = await client.query("SELECT version FROM platform_schema_migrations ORDER BY version")
    const appliedVersions = new Set(result.rows.map((r) => r.version))

    // Get pending migrations
    const allMigrations = getMigrations()
    const pendingMigrations = allMigrations.filter((m) => !appliedVersions.has(m.version))

    if (pendingMigrations.length === 0) {
      logger.info("No pending platform migrations")
      return
    }

    logger.info(`Running ${pendingMigrations.length} platform migration(s)`)

    for (const migration of pendingMigrations) {
      logger.info(`Applying platform migration ${migration.version}: ${migration.name}`)

      const sql = fs.readFileSync(migration.file, "utf-8")

      await client.query("BEGIN")
      try {
        await client.query(sql)
        await client.query("INSERT INTO platform_schema_migrations (version, name) VALUES ($1, $2)", [
          migration.version,
          migration.name,
        ])
        await client.query("COMMIT")

        logger.info(`Platform migration ${migration.version} applied successfully`)
      } catch (error) {
        await client.query("ROLLBACK")
        logger.error(`Platform migration ${migration.version} failed`, { error })
        throw error
      }
    }

    logger.info("All platform migrations completed successfully")
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch((error) => {
  logger.error("Platform migration failed", { error })
  process.exit(1)
})
