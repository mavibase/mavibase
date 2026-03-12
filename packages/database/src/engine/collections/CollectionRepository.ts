import { pool } from "@mavibase/database/config/database"
import type { Collection, CollectionSchema, SchemaDefinition } from "../../types/collection"
import { AppError } from "@mavibase/core"
import { generateId } from "@mavibase/database/utils/id-generator"

// Default isolation level for collection operations (READ COMMITTED prevents dirty reads)
const DEFAULT_ISOLATION_LEVEL = "READ COMMITTED"

export class CollectionRepository {
  async create(collection: Collection, schema?: SchemaDefinition, projectId?: string): Promise<Collection> {
    const client = await pool.connect()

    try {
      await client.query(`BEGIN ISOLATION LEVEL ${DEFAULT_ISOLATION_LEVEL}`)

      // 1️⃣ Check key uniqueness inside the database
      const existingKey = await client.query(
        `SELECT id 
         FROM collections 
         WHERE database_id = $1 AND key = $2 AND deleted_at IS NULL`,
        [collection.database_id, collection.key],
      )

      if (existingKey.rows.length > 0) {
        throw new AppError(
          409,
          "DUPLICATE_KEY",
          `Collection with key '${collection.key}' already exists in this database`,
        )
      }

      // ADDED: Get project_id and team_id from database
      const dbInfo = await client.query(
        `SELECT project_id, team_id FROM databases WHERE id = $1 AND deleted_at IS NULL`,
        [collection.database_id],
      )

      if (dbInfo.rows.length === 0) {
        throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
      }

      const { project_id: dbProjectId, team_id: dbTeamId } = dbInfo.rows[0]

      // ADDED: Verify project isolation if projectId provided
      if (projectId && dbProjectId !== projectId) {
        throw new AppError(
          403,
          "TENANT_ISOLATION_VIOLATION",
          "Cannot create collection in a database you don't own",
          {
            hint: "The database does not belong to your project",
          },
        )
      }

      // 2️⃣ Create collection FIRST (parent) - ADDED project_id and team_id
      const collectionResult = await client.query(
        `INSERT INTO collections (
          id,
          database_id,
          project_id,
          team_id,
          name,
          key,
          description,
          created_by,
          visibility,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          collection.id,
          collection.database_id,
          dbProjectId,  // ADDED
          dbTeamId,     // ADDED
          collection.name,
          collection.key,
          collection.description ?? null,
          collection.created_by ?? null,
          collection.visibility ?? "private",
          collection.created_at,
          collection.updated_at,
        ],
      )

      let schemaId: string | undefined = undefined

      // 3️⃣ Create schema SECOND (child)
      if (schema) {
        this.validateSchemaDefinition(schema)

        schemaId = generateId()

        await client.query(
          `INSERT INTO collection_schemas (
            id,
            collection_id,
            definition,
            version,
            is_active,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [schemaId, collection.id, JSON.stringify(schema), 1, true, new Date(), new Date()],
        )

        // 4️⃣ Link schema to collection
        await client.query(
          `UPDATE collections 
           SET schema_id = $1 
           WHERE id = $2`,
          [schemaId, collection.id],
        )
      }

      await client.query("COMMIT")

      // 5️⃣ Create indexes async (OUTSIDE transaction)
      if (schema) {
        this.createIndexesAsync(collection.id, schema).catch((error) => {
          console.error("Failed to create indexes:", error)
        })
      }

      return this.mapRow(collectionResult.rows[0])
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async findByDatabaseId(databaseId: string, projectId?: string): Promise<Collection[]> {
    let query = `SELECT c.* 
                 FROM collections c`
    const params: any[] = [databaseId]

    if (projectId) {
      // Join with databases to ensure project isolation
      query += ` INNER JOIN databases d ON c.database_id = d.id 
                 WHERE c.database_id = $1 
                 AND c.deleted_at IS NULL 
                 AND d.project_id = $2 
                 AND d.deleted_at IS NULL
                 ORDER BY c.created_at DESC`
      params.push(projectId)
    } else {
      query += ` WHERE c.database_id = $1 AND c.deleted_at IS NULL
                 ORDER BY c.created_at DESC`
    }

    const result = await pool.query(query, params)

    return result.rows.map((row) => this.mapRow(row))
  }

  async findById(id: string, projectId?: string): Promise<Collection | null> {
    let query = `SELECT c.* 
                 FROM collections c`
    const params: any[] = [id]

    if (projectId) {
      query += ` INNER JOIN databases d ON c.database_id = d.id 
                 WHERE c.id = $1 AND c.deleted_at IS NULL AND d.project_id = $2 AND d.deleted_at IS NULL`
      params.push(projectId)
    } else {
      query += ` WHERE c.id = $1 AND c.deleted_at IS NULL`
    }

    const result = await pool.query(query, params)

    return result.rows.length ? this.mapRow(result.rows[0]) : null
  }

  async getSchema(schemaId: string): Promise<CollectionSchema | null> {
    const result = await pool.query(
      `SELECT * 
       FROM collection_schemas 
       WHERE id = $1`,
      [schemaId],
    )

    return result.rows.length ? this.mapSchemaRow(result.rows[0]) : null
  }

async update(
  id: string,
  updates: Partial<Collection>,
  schema?: SchemaDefinition,
  projectId?: string,
): Promise<Collection> {
  const client = await pool.connect()

  try {
    await client.query(`BEGIN ISOLATION LEVEL ${DEFAULT_ISOLATION_LEVEL}`)

    const existing = await this.findById(id, projectId)
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Collection not found or access denied")
    }

    let schemaId: string | undefined

    if (schema) {
      this.validateSchemaDefinition(schema)

      // Deactivate old schema
      await client.query(
        `UPDATE collection_schemas
         SET is_active = false
         WHERE collection_id = $1 AND is_active = true`,
        [id],
      )

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM collection_schemas
         WHERE collection_id = $1`,
        [id],
      )

      schemaId = generateId()

      await client.query(
        `INSERT INTO collection_schemas (
          id,
          collection_id,
          definition,
          version,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [schemaId, id, JSON.stringify(schema), versionResult.rows[0].next_version, true, new Date(), new Date()],
      )
    }

    // ✅ FIXED: Added permission_rules and visibility to UPDATE query
    const result = await client.query(
      `UPDATE collections
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           schema_id = COALESCE($3, schema_id),
           permission_rules = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE permission_rules END,
           visibility = COALESCE($7, visibility),
           updated_at = $4
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [
        updates.name, 
        updates.description, 
        schemaId, 
        new Date(), 
        updates.permission_rules !== undefined ? JSON.stringify(updates.permission_rules) : null,
        id,
        updates.visibility || null,
      ],
    )

    if (!result.rows.length) {
      throw new AppError(404, "NOT_FOUND", "Collection not found")
    }

    await client.query("COMMIT")

    if (schema) {
      this.createIndexesAsync(id, schema).catch(console.error)
    }

    return this.mapRow(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

  async softDelete(id: string, projectId?: string): Promise<void> {
    // Now implemented as a hard delete so collections are physically removed.
    let query = `DELETE FROM collections WHERE id = $1`
    const params: any[] = [id]

    if (projectId) {
      query = `DELETE FROM collections c
               USING databases d
               WHERE c.id = $1 
                 AND c.database_id = d.id 
                 AND d.project_id = $2
                 AND d.deleted_at IS NULL`
      params.push(projectId)
    }

    const result = await pool.query(query, params)

    if (result.rowCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Collection not found or access denied")
    }
  }

  // ================== Helpers ==================

  private validateSchemaDefinition(schema: SchemaDefinition) {
    if (!schema.fields || !Array.isArray(schema.fields)) {
      throw new AppError(400, "INVALID_SCHEMA", "Schema must contain a fields array")
    }

    // Updated to include all supported attribute types
    const validTypes = [
      "string", 
      "number", 
      "integer", 
      "float", 
      "boolean", 
      "datetime", 
      "email", 
      "url", 
      "ip", 
      "enum", 
      "object", 
      "array",
      "relationship",
    ]
    const reserved = ["id", "created_at", "updated_at", "deleted_at", "version"]

    for (const field of schema.fields) {
      if (!field.name || !field.type) {
        throw new AppError(400, "INVALID_SCHEMA", "Each field must have name and type")
      }

      if (reserved.includes(field.name)) {
        throw new AppError(400, "INVALID_SCHEMA", `Field '${field.name}' is reserved`)
      }

      if (!validTypes.includes(field.type)) {
        throw new AppError(400, "INVALID_SCHEMA", `Invalid type '${field.type}'. Must be one of: ${validTypes.join(", ")}`)
      }

      // Validate enum type has enum values
      if (field.type === "enum") {
        if (!field.validation?.enum || !Array.isArray(field.validation.enum) || field.validation.enum.length === 0) {
          throw new AppError(400, "INVALID_SCHEMA", `Field '${field.name}' is type 'enum' but has no enum values in validation.enum`)
        }
      }
    }
  }

  private async createIndexesAsync(collectionId: string, schema: SchemaDefinition) {
    for (const field of schema.fields.filter((f) => f.indexed)) {
      const indexName = `idx_doc_${collectionId.replace(/-/g, "_")}_${field.name}`

      await pool.query(
        `CREATE INDEX IF NOT EXISTS ${indexName}
         ON documents ((data->>'${field.name}'))
         WHERE collection_id = $1 AND deleted_at IS NULL`,
        [collectionId],
      )
    }
  }

  // UPDATED: Added project_id, team_id, and permission_rules to mapRow
  private mapRow(row: any): Collection {
    return {
      id: row.id,
      database_id: row.database_id,
      project_id: row.project_id,      // ADDED
      team_id: row.team_id,            // ADDED
      name: row.name,
      key: row.key,
      description: row.description,
      created_by: row.created_by,
      visibility: row.visibility,
      permission_rules: row.permission_rules,  // ADDED
      schema_id: row.schema_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }
  }

  private mapSchemaRow(row: any): CollectionSchema {
    return {
      id: row.id,
      collection_id: row.collection_id,
      definition: row.definition,
      version: row.version,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
}
