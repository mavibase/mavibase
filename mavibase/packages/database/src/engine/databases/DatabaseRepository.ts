import { pool } from "@mavibase/database/config/database"
import type { Database } from "@mavibase/database/types/database"
import { AppError } from "@mavibase/core"

export class DatabaseRepository {
async create(database: Database, projectId: string, teamId: string): Promise<Database> {
    const client = await pool.connect()

    try {
      await client.query("BEGIN")

      // Check if key already exists (globally unique)
      const existingKey = await client.query("SELECT id FROM databases WHERE key = $1 AND deleted_at IS NULL", [
        database.key,
      ])

      if (existingKey.rows.length > 0) {
        throw new AppError(409, "DUPLICATE_KEY", `Database with key '${database.key}' already exists`)
      }

      // Get quota defaults from environment variables
      const maxCollections = parseInt(process.env.DEFAULT_MAX_COLLECTIONS || "50", 10)
      const maxDocumentsPerCollection = parseInt(process.env.DEFAULT_MAX_DOCUMENTS_PER_COLLECTION || "100000", 10)
      const maxStorageMB = parseInt(process.env.DEFAULT_MAX_STORAGE_MB || "1000", 10)
      const maxStorageBytes = maxStorageMB * 1024 * 1024 // Convert MB to bytes

      // FIXED: Added team_id and quota columns to INSERT
      const result = await client.query(
        `INSERT INTO databases (id, name, key, description, project_id, team_id, created_at, updated_at, max_collections, max_documents_per_collection, max_storage_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          database.id,
          database.name,
          database.key,
          database.description,
          projectId,
          teamId, // ADDED: team_id from identity context
          database.created_at,
          database.updated_at,
          maxCollections,
          maxDocumentsPerCollection,
          maxStorageBytes,
        ],
      )

      await client.query("COMMIT")

      return this.mapRow(result.rows[0])
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async findAll(projectId: string): Promise<Database[]> {
    const result = await pool.query(
      `SELECT * FROM databases 
       WHERE project_id = $1 AND deleted_at IS NULL 
       ORDER BY created_at DESC`,
      [projectId],
    )

    return result.rows.map((row) => this.mapRow(row))
  }

  async findById(id: string, projectId: string): Promise<Database | null> {
    const result = await pool.query(
      `SELECT * FROM databases 
       WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
      [id, projectId],
    )

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async findByKey(key: string): Promise<Database | null> {
    const result = await pool.query(
      `SELECT * FROM databases 
       WHERE key = $1 AND deleted_at IS NULL`,
      [key],
    )

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async findByKeyHash(keyHash: string): Promise<Database | null> {
    const result = await pool.query(
      `SELECT * FROM databases 
       WHERE key_hash = $1 AND deleted_at IS NULL AND revoked_at IS NULL`,
      [keyHash],
    )

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async update(id: string, updates: Partial<Database>, projectId: string): Promise<Database> {
    const result = await pool.query(
      `UPDATE databases 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = $3
       WHERE id = $4 AND project_id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [updates.name, updates.description, new Date(), id, projectId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "NOT_FOUND", "Database not found or access denied")
    }

    return this.mapRow(result.rows[0])
  }

  async updateKeyHash(id: string, keyHash: string, keyPrefix: string): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET key_hash = $1, key_prefix = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [keyHash, keyPrefix, id],
    )
  }

  async updateLastUsed(id: string): Promise<void> {
    await pool.query(`UPDATE databases SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [id])
  }

  async revokeKey(id: string): Promise<void> {
    await pool.query(`UPDATE databases SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [id])
  }

  async delete(id: string, projectId: string): Promise<void> {
    const result = await pool.query(`DELETE FROM databases WHERE id = $1 AND project_id = $2`, [id, projectId])

    if (result.rowCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Database not found or access denied")
    }
  }

  async softDelete(id: string, projectId: string): Promise<void> {
    const result = await pool.query(
      `UPDATE databases 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    )

    if (result.rowCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Database not found or access denied")
    }
  }

  async getProjectId(databaseId: string): Promise<string | null> {
    const result = await pool.query(`SELECT project_id FROM databases WHERE id = $1 AND deleted_at IS NULL`, [
      databaseId,
    ])

    return result.rows.length > 0 ? result.rows[0].project_id : null
  }

  private mapRow(row: any): Database {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      description: row.description,
      project_id: row.project_id,
      team_id: row.team_id, // ADDED: map team_id from database
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }
  }
}
