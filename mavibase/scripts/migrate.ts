import dotenv from "dotenv"
dotenv.config()

import { pool, logger } from "@mavibase/database"
import fs from "fs"
import path from "path"

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations", "database")

interface Migration {
  version: number
  name: string
  file: string
}

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
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get applied migrations
    const result = await client.query("SELECT version FROM schema_migrations ORDER BY version")
    const appliedVersions = new Set(result.rows.map((r) => r.version))

    // Get pending migrations
    const allMigrations = getMigrations()
    const pendingMigrations = allMigrations.filter((m) => !appliedVersions.has(m.version))

    if (pendingMigrations.length === 0) {
      logger.info("No pending migrations")
      return
    }

    logger.info(`Running ${pendingMigrations.length} migration(s)`)

    for (const migration of pendingMigrations) {
      logger.info(`Applying migration ${migration.version}: ${migration.name}`)

      const sql = fs.readFileSync(migration.file, "utf-8")

      await client.query("BEGIN")
      try {
        await client.query(sql)
        await client.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [
          migration.version,
          migration.name,
        ])
        await client.query("COMMIT")

        logger.info(`Migration ${migration.version} applied successfully`)
      } catch (error) {
        await client.query("ROLLBACK")
        logger.error(`Migration ${migration.version} failed`, { error })
        throw error
      }
    }

    logger.info("All migrations completed successfully")
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch((error) => {
  logger.error("Migration failed", { error })
  process.exit(1)
})
