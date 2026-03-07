import { pool } from "@mavibase/database/config/database"
import type { CollectionIndex } from "../../types/collection"
import { AppError } from "@mavibase/core"

export class IndexRepository {
  async create(index: Omit<CollectionIndex, "status"> & { field_names?: string[] }): Promise<CollectionIndex & { status: string }> {
    // Support both single field_name and multi-field field_names
    const fieldNames = index.field_names || [index.field_name]
    const indexNameSuffix = fieldNames.join('_')
    
    const result = await pool.query(
      `INSERT INTO index_metadata (id, collection_id, field_name, field_names, index_name, index_type, is_unique, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        index.id,
        index.collection_id,
        index.field_name, // Keep for backward compatibility
        JSON.stringify(fieldNames), // Store array of field names
        `idx_doc_${index.collection_id.replace(/-/g, "_")}_${indexNameSuffix}`,
        index.index_type || "btree",
        index.is_unique || false,
        "creating",
        index.created_at,
        index.created_at,
      ],
    )

    return this.mapRow(result.rows[0])
  }

  async findByCollectionId(collectionId: string): Promise<Array<CollectionIndex & { status: string }>> {
    const result = await pool.query(
      `SELECT * FROM index_metadata 
       WHERE collection_id = $1 
       ORDER BY created_at DESC`,
      [collectionId],
    )

    return result.rows.map((row) => this.mapRow(row))
  }

  async findById(id: string): Promise<(CollectionIndex & { status: string; index_name: string }) | null> {
    const result = await pool.query(`SELECT * FROM index_metadata WHERE id = $1`, [id])

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async findByFieldName(
    collectionId: string,
    fieldName: string,
  ): Promise<(CollectionIndex & { status: string }) | null> {
    const result = await pool.query(
      `SELECT * FROM index_metadata 
       WHERE collection_id = $1 AND field_name = $2`,
      [collectionId, fieldName],
    )

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async createDatabaseIndex(
    collectionId: string,
    fieldNames: string | string[],
    indexName: string,
    indexType: "btree" | "hash" | "gin",
    isUnique: boolean,
  ): Promise<void> {
    try {
      const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames]
      
      // Sanitize index name and type to prevent SQL injection
      const sanitizedIndexName = indexName.replace(/[^a-zA-Z0-9_]/g, '_')
      const sanitizedIndexType = ['btree', 'hash', 'gin'].includes(indexType) ? indexType : 'btree'
      
      // Only btree supports unique constraints
      const actualIsUnique = sanitizedIndexType === 'btree' && isUnique
      const uniqueClause = actualIsUnique ? "UNIQUE" : ""
      
      // Build the index expression based on field count and type
      let indexExpression: string
      let usingClause: string = sanitizedIndexType
      
      if (fields.length === 1) {
        // Single field index
        if (sanitizedIndexType === "gin") {
          // For GIN indexes, we index the entire data column with jsonb_path_ops
          // This supports @> containment queries for any field
          indexExpression = `(data)`
          usingClause = `gin`
        } else {
          indexExpression = `((data->>'${fields[0].replace(/'/g, "''")}'))`
        }
      } else {
        // Multi-field composite index - escape field names
        if (sanitizedIndexType === "gin") {
          // For GIN with multiple fields, index the whole data object
          indexExpression = `(data)`
          usingClause = `gin`
        } else {
          const escapedFields = fields.map(f => `(data->>'${f.replace(/'/g, "''")}')`)
          indexExpression = `(${escapedFields.join(', ')})`
        }
      }

      // Build SQL with sanitized values (can't use parameters for DDL statements)
      let sql: string
      if (sanitizedIndexType === "gin") {
        // GIN indexes on JSONB use jsonb_path_ops for efficient containment queries
        // Syntax: USING gin (column jsonb_path_ops) - operator class goes inside parentheses
        sql = `CREATE INDEX IF NOT EXISTS ${sanitizedIndexName}
           ON documents USING gin (data jsonb_path_ops)
           WHERE collection_id = '${collectionId.replace(/'/g, "''")}' AND deleted_at IS NULL`
      } else {
        sql = `CREATE ${uniqueClause} INDEX IF NOT EXISTS ${sanitizedIndexName}
           ON documents USING ${usingClause} ${indexExpression}
           WHERE collection_id = '${collectionId.replace(/'/g, "''")}' AND deleted_at IS NULL`
      }

      await pool.query(sql)

      // Update status to active
      await pool.query(
        `UPDATE index_metadata 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE index_name = $2`,
        ['active', indexName],
      )
    } catch (error: any) {
      // Update status to failed
      await pool.query(
        `UPDATE index_metadata 
         SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
         WHERE index_name = $3`,
        ['failed', error.message, indexName],
      )
      throw error
    }
  }

  async dropDatabaseIndex(indexName: string): Promise<void> {
    // Sanitize the index name to prevent SQL injection
    const sanitizedIndexName = indexName.replace(/[^a-zA-Z0-9_]/g, '_')
    // DROP INDEX doesn't support parameterized queries
    await pool.query(`DROP INDEX IF EXISTS ${sanitizedIndexName}`)
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    await pool.query(
      `UPDATE index_metadata 
       SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, errorMessage || null, id],
    )
  }

  async delete(id: string): Promise<void> {
    const result = await pool.query(`DELETE FROM index_metadata WHERE id = $1`, [id])

    if (result.rowCount === 0) {
      throw new AppError(404, "INDEX_NOT_FOUND", "Index not found")
    }
  }

  private mapRow(row: any): CollectionIndex & { status: string; index_name: string; field_names?: string[] } {
    // Handle field_names - could be JSON array string, plain string, or null
    let fieldNames: string[]
    
    if (row.field_names) {
      if (typeof row.field_names === 'string') {
        try {
          // Try to parse as JSON array
          fieldNames = JSON.parse(row.field_names)
        } catch {
          // If parsing fails, it's a plain string - wrap it in array
          fieldNames = [row.field_names]
        }
      } else if (Array.isArray(row.field_names)) {
        // Already an array (PostgreSQL can return JSONB as object)
        fieldNames = row.field_names
      } else {
        // Fallback to field_name
        fieldNames = [row.field_name]
      }
    } else {
      // No field_names, use field_name
      fieldNames = [row.field_name]
    }

    return {
      id: row.id,
      collection_id: row.collection_id,
      field_name: row.field_name,
      field_names: fieldNames,
      index_name: row.index_name,
      index_type: row.index_type || "btree",
      is_unique: row.is_unique || false,
      status: row.status,
      created_at: row.created_at,
    }
  }
}
