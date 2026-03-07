import { pool } from "@mavibase/database/config/database"
import type { Document, DocumentVersion, QueryOperator, Collection } from "@mavibase/database/types/index"
import { AppError } from "@mavibase/core"
import { generateId } from "@mavibase/database/utils/id-generator"
import { logger } from "@mavibase/database/utils/logger"
import { CursorPaginator } from "@mavibase/database/services/cursor-paginator"
import type { PoolClient } from "pg"

export class DocumentRepository {
  private cursorPaginator = new CursorPaginator()
  private versioningEnabled = process.env.ENABLE_VERSIONING !== "false"
  private versionLimit = Number.parseInt(process.env.VERSION_LIMIT || "10")

  /**
   * Cleanup old versions to maintain version limit per document
   */
  private async cleanupOldVersions(documentId: string, collectionId: string, tx?: PoolClient): Promise<void> {
    if (!this.versioningEnabled || this.versionLimit <= 0) {
      return
    }

    const client = tx || pool

    // Delete versions beyond the limit, keeping only the most recent N versions
    await client.query(
      `DELETE FROM document_versions
       WHERE document_id = $1 AND collection_id = $2
       AND id NOT IN (
         SELECT id FROM document_versions
         WHERE document_id = $1 AND collection_id = $2
         ORDER BY version DESC
         LIMIT $3
       )`,
      [documentId, collectionId, this.versionLimit],
    )
  }

  async create(document: Document, projectId?: string, tx?: PoolClient): Promise<Document> {
    const client = tx || (await pool.connect())

    try {
      if (!tx) await client.query("BEGIN")

      if (projectId) {
        const collectionCheck = await client.query(
          `SELECT c.database_id, d.project_id 
           FROM collections c
           JOIN databases d ON c.database_id = d.id
           WHERE c.id = $1 AND c.deleted_at IS NULL AND d.deleted_at IS NULL`,
          [document.collection_id],
        )

        if (collectionCheck.rows.length === 0) {
          throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found")
        }

        if (collectionCheck.rows[0].project_id !== projectId) {
          throw new AppError(
            403,
            "TENANT_ISOLATION_VIOLATION",
            "Cannot create document in a collection you don't own",
            {
              hint: "The collection does not belong to your project",
            },
          )
        }
      }

      // FIXED: Added team_id and permission_rules
      const docResult = await client.query(
        `INSERT INTO documents (
          id, 
          collection_id, 
          team_id, 
          data, 
          schema_version, 
          version, 
          owner_id, 
          visibility, 
          permission_rules, 
          created_at, 
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          document.id,
          document.collection_id,
          document.team_id,
          JSON.stringify(document.data),
          document.schema_version,
          document.version,
          document.owner_id ?? null,
          document.visibility ?? "inherit",
          document.permission_rules ? JSON.stringify(document.permission_rules) : null,
          document.created_at,
          document.updated_at,
        ],
      )

      // Insert version history
      if (this.versioningEnabled) {
        await client.query(
          `INSERT INTO document_versions (id, document_id, collection_id, data, schema_version, version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            generateId(),
            document.id,
            document.collection_id,
            JSON.stringify(document.data),
            document.schema_version,
            document.version,
            document.created_at,
          ],
        )

        // Cleanup old versions if limit is exceeded
        await this.cleanupOldVersions(document.id, document.collection_id, client)
      }

      if (!tx) await client.query("COMMIT")

      return this.mapRow(docResult.rows[0])
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async findById(id: string, collectionId: string, projectId?: string, tx?: PoolClient): Promise<Document | null> {
    let query = `
      SELECT d.* 
      FROM documents d
      JOIN collections c ON d.collection_id = c.id
      JOIN databases db ON c.database_id = db.id
      WHERE d.id = $1 AND d.collection_id = $2 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
    `
    const params: any[] = [id, collectionId]

    if (projectId) {
      query += ` AND db.project_id = $3`
      params.push(projectId)
    }

    const result = tx ? await tx.query(query, params) : await pool.query(query, params)

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  async findByCollectionId(collectionId: string, projectId?: string, tx?: PoolClient): Promise<Document[]> {
    let query = `
      SELECT d.* 
      FROM documents d
      JOIN collections c ON d.collection_id = c.id
      JOIN databases db ON c.database_id = db.id
      WHERE d.collection_id = $1 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
    `
    const params: any[] = [collectionId]

    if (projectId) {
      query += ` AND db.project_id = $2`
      params.push(projectId)
    }

    const result = tx ? await tx.query(query, params) : await pool.query(query, params)

    return result.rows.map((row) => this.mapRow(row))
  }

  async findByCollectionIdPaginated(
    collectionId: string,
    limit: number,
    offset: number,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<Document[]> {
    let query = `
      SELECT d.* 
      FROM documents d
      JOIN collections c ON d.collection_id = c.id
      JOIN databases db ON c.database_id = db.id
      WHERE d.collection_id = $1 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
    `
    const params: any[] = [collectionId]

    if (projectId) {
      query += ` AND db.project_id = $2`
      params.push(projectId)
    }

    query += ` ORDER BY d.created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = tx ? await tx.query(query, params) : await pool.query(query, params)

    return result.rows.map((row) => this.mapRow(row))
  }

  async update(id: string, collectionId: string, newData: any, projectId?: string, tx?: PoolClient, permissionRules?: any): Promise<Document> {
    const client = tx || (await pool.connect())

    try {
      if (!tx) await client.query("BEGIN")

      let query = `
        SELECT d.* 
        FROM documents d
        JOIN collections c ON d.collection_id = c.id
        JOIN databases db ON c.database_id = db.id
        WHERE d.id = $1 AND d.collection_id = $2 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
      `
      const params: any[] = [id, collectionId]

      if (projectId) {
        query += ` AND db.project_id = $3`
        params.push(projectId)
      }

      const current = await client.query(query, params)

      if (current.rows.length === 0) {
        throw new AppError(404, "NOT_FOUND", "Document not found or access denied")
      }

      const currentDoc = this.mapRow(current.rows[0])
      const newVersion = this.versioningEnabled ? currentDoc.version + 1 : currentDoc.version

      // Update document (optionally update permission_rules too)
      let updateSql: string
      let updateParams: any[]
      
      if (permissionRules !== undefined) {
        updateSql = `UPDATE documents 
         SET data = $1, version = $2, permission_rules = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND collection_id = $5
         RETURNING *`
        updateParams = [JSON.stringify(newData), newVersion, permissionRules ? JSON.stringify(permissionRules) : null, id, collectionId]
      } else {
        updateSql = `UPDATE documents 
         SET data = $1, version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND collection_id = $4
         RETURNING *`
        updateParams = [JSON.stringify(newData), newVersion, id, collectionId]
      }

      const updateResult = await client.query(updateSql, updateParams)

      // Insert version history only if versioning is enabled
      if (this.versioningEnabled) {
        await client.query(
          `INSERT INTO document_versions (id, document_id, collection_id, data, schema_version, version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [generateId(), id, collectionId, JSON.stringify(newData), currentDoc.schema_version, newVersion, new Date()],
        )

        // Cleanup old versions if limit is exceeded
        await this.cleanupOldVersions(id, collectionId, client)
      }

      if (!tx) await client.query("COMMIT")

      return this.mapRow(updateResult.rows[0])
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async softDelete(id: string, collectionId: string, projectId?: string, tx?: PoolClient): Promise<void> {
    let query = `
      UPDATE documents d
      SET deleted_at = CURRENT_TIMESTAMP
      FROM collections c
      JOIN databases db ON c.database_id = db.id
      WHERE d.id = $1 AND d.collection_id = $2 
      AND d.collection_id = c.id 
      AND d.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND db.deleted_at IS NULL
    `
    const params: any[] = [id, collectionId]

    if (projectId) {
      query += ` AND db.project_id = $3`
      params.push(projectId)
    }

    const result = tx ? await tx.query(query, params) : await pool.query(query, params)

    if (result.rowCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Document not found or access denied")
    }
  }

  async bulkCreate(documents: Document[], projectId?: string, tx?: PoolClient): Promise<any> {
    const client = tx || (await pool.connect())
    const success: Document[] = []
    const errors: Array<{ index: number; error: string; data: any }> = []

    try {
      if (!tx) await client.query("BEGIN")

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        try {
          if (projectId) {
            const collectionCheck = await client.query(
              `SELECT c.database_id, d.project_id 
               FROM collections c
               JOIN databases d ON c.database_id = d.id
               WHERE c.id = $1 AND c.deleted_at IS NULL AND d.deleted_at IS NULL`,
              [doc.collection_id],
            )

            if (collectionCheck.rows.length === 0) {
              throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found")
            }

            if (collectionCheck.rows[0].project_id !== projectId) {
              throw new AppError(
                403,
                "TENANT_ISOLATION_VIOLATION",
                "Cannot create document in a collection you don't own",
                {
                  hint: "The collection does not belong to your project",
                },
              )
            }
          }

          // FIXED: Added team_id and permission_rules
          const docResult = await client.query(
            `INSERT INTO documents (
              id, 
              collection_id, 
              team_id, 
              data, 
              schema_version, 
              version, 
              owner_id, 
              visibility, 
              permission_rules, 
              created_at, 
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
              doc.id,
              doc.collection_id,
              doc.team_id,
              JSON.stringify(doc.data),
              doc.schema_version,
              doc.version,
              doc.owner_id ?? null,
              doc.visibility ?? "inherit",
              doc.permission_rules ? JSON.stringify(doc.permission_rules) : null,
              doc.created_at,
              doc.updated_at,
            ],
          )

          if (this.versioningEnabled) {
            await client.query(
              `INSERT INTO document_versions (id, document_id, collection_id, data, schema_version, version, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                generateId(),
                doc.id,
                doc.collection_id,
                JSON.stringify(doc.data),
                doc.schema_version,
                doc.version,
                doc.created_at,
              ],
            )

            await this.cleanupOldVersions(doc.id, doc.collection_id, client)
          }

          success.push(this.mapRow(docResult.rows[0]))
        } catch (error: any) {
          errors.push({
            index: i,
            error: error.message || "Unknown error",
            data: doc.data,
          })
        }
      }

      if (!tx) await client.query("COMMIT")

      return {
        success: success.length,
        failed: errors.length,
        documents: success,
        errors,
      }
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async bulkUpdate(
    updates: Array<{ id: string; collectionId: string; data: any }>,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<any> {
    const client = tx || (await pool.connect())
    const success: Document[] = []
    const errors: Array<{ id: string; error: string }> = []

    try {
      if (!tx) await client.query("BEGIN")

      for (const update of updates) {
        try {
          let query = `
            SELECT d.* 
            FROM documents d
            JOIN collections c ON d.collection_id = c.id
            JOIN databases db ON c.database_id = db.id
            WHERE d.id = $1 AND d.collection_id = $2 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
          `
          const params: any[] = [update.id, update.collectionId]

          if (projectId) {
            query += ` AND db.project_id = $3`
            params.push(projectId)
          }

          const current = await client.query(query, params)

          if (current.rows.length === 0) {
            errors.push({ id: update.id, error: "Document not found or access denied" })
            continue
          }

          const currentDoc = this.mapRow(current.rows[0])
          const newVersion = this.versioningEnabled ? currentDoc.version + 1 : currentDoc.version

          const updateResult = await client.query(
            `UPDATE documents SET data = $1, version = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND collection_id = $4 RETURNING *`,
            [JSON.stringify(update.data), newVersion, update.id, update.collectionId],
          )

          if (this.versioningEnabled) {
            await client.query(
              `INSERT INTO document_versions (id, document_id, collection_id, data, schema_version, version, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                generateId(),
                update.id,
                update.collectionId,
                JSON.stringify(update.data),
                currentDoc.schema_version,
                newVersion,
                new Date(),
              ],
            )

            await this.cleanupOldVersions(update.id, update.collectionId, client)
          }

          success.push(this.mapRow(updateResult.rows[0]))
        } catch (error: any) {
          errors.push({ id: update.id, error: error.message || "Unknown error" })
        }
      }

      if (!tx) await client.query("COMMIT")

      return {
        success: success.length,
        failed: errors.length,
        updated: success,
        errors,
      }
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async bulkDelete(
    ids: Array<{ id: string; collectionId: string }>,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<any> {
    const client = tx || (await pool.connect())
    const success: string[] = []
    const errors: Array<{ id: string; error: string }> = []

    try {
      if (!tx) await client.query("BEGIN")

      for (const item of ids) {
        try {
          let query = `
            UPDATE documents d
            SET deleted_at = CURRENT_TIMESTAMP
            FROM collections c
            JOIN databases db ON c.database_id = db.id
            WHERE d.id = $1 AND d.collection_id = $2 
            AND d.collection_id = c.id 
            AND d.deleted_at IS NULL
            AND c.deleted_at IS NULL
            AND db.deleted_at IS NULL
          `
          const params: any[] = [item.id, item.collectionId]

          if (projectId) {
            query += ` AND db.project_id = $3`
            params.push(projectId)
          }

          const result = await client.query(query, params)

          if (result.rowCount === 0) {
            errors.push({ id: item.id, error: "Document not found or access denied" })
          } else {
            success.push(item.id)
          }
        } catch (error: any) {
          errors.push({ id: item.id, error: error.message || "Unknown error" })
        }
      }

      if (!tx) await client.query("COMMIT")

      return {
        success: success.length,
        failed: errors.length,
        deleted: success,
        errors,
      }
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async query(
    collectionId: string,
    operators: QueryOperator[],
    collection: Collection,
    limit = 25,
    offset = 0,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<{ documents: Document[]; total: number }> {
    const client = tx || pool

    if (projectId) {
      const dbCheck = await client.query(`SELECT project_id FROM databases WHERE id = $1 AND deleted_at IS NULL`, [
        collection.database_id,
      ])

      if (dbCheck.rows.length === 0 || dbCheck.rows[0].project_id !== projectId) {
        throw new AppError(
          403,
          "TENANT_ISOLATION_VIOLATION",
          "Cannot query documents from a collection you don't own",
          {
            hint: "The collection does not belong to your project",
          },
        )
      }
    }

    const whereConditions: string[] = ["collection_id = $1", "deleted_at IS NULL"]
    const params: any[] = [collectionId]
    let paramIndex = 2

    let orderByClause = ""

    // Check for indexed fields
    const indexedFields: Set<string> = new Set()
    if (collection.schema_id) {
      const schemaResult = await client.query("SELECT definition FROM collection_schemas WHERE id = $1", [
        collection.schema_id,
      ])
      if (schemaResult.rows.length > 0) {
        const schema = schemaResult.rows[0].definition
        schema.fields?.forEach((field: any) => {
          if (field.indexed) {
            indexedFields.add(field.name)
          }
        })
      }
    }

    // Process operators
    for (const op of operators) {
      if (op.field && !indexedFields.has(op.field) && op.type !== "limit" && op.type !== "offset") {
        logger.warn("Query on non-indexed field", {
          collection_id: collectionId,
          field: op.field,
        })
      }

      switch (op.type) {
        case "equal":
          whereConditions.push(`data->>'${op.field}' = $${paramIndex}`)
          params.push(String(op.value))
          paramIndex++
          break
        case "notEqual":
          whereConditions.push(`data->>'${op.field}' != $${paramIndex}`)
          params.push(String(op.value))
          paramIndex++
          break
        case "lessThan":
          whereConditions.push(`(data->>'${op.field}')::numeric < $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "lessThanEqual":
          whereConditions.push(`(data->>'${op.field}')::numeric <= $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "greaterThan":
          whereConditions.push(`(data->>'${op.field}')::numeric > $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "greaterThanEqual":
          whereConditions.push(`(data->>'${op.field}')::numeric >= $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "contains":
          whereConditions.push(`data->>'${op.field}' LIKE $${paramIndex}`)
          params.push(`%${op.value}%`)
          paramIndex++
          break
        case "startsWith":
          whereConditions.push(`data->>'${op.field}' LIKE $${paramIndex}`)
          params.push(`${op.value}%`)
          paramIndex++
          break
        case "endsWith":
          whereConditions.push(`data->>'${op.field}' LIKE $${paramIndex}`)
          params.push(`%${op.value}`)
          paramIndex++
          break
        case "isNull":
          whereConditions.push(`data->>'${op.field}' IS NULL`)
          break
        case "isNotNull":
          whereConditions.push(`data->>'${op.field}' IS NOT NULL`)
          break
        case "between":
          whereConditions.push(`(data->>'${op.field}')::numeric BETWEEN $${paramIndex} AND $${paramIndex + 1}`)
          params.push(Number(op.value), Number(op.value2))
          paramIndex += 2
          break
        case "limit":
          limit = Math.min(Number(op.value) || 25, 100)
          break
        case "offset":
          offset = Number(op.value) || 0
          break
        case "orderBy":
          const direction = op.direction === "desc" ? "DESC" : "ASC"
          orderByClause = `ORDER BY data->>'${op.field}' ${direction}`
          break
        case "in":
          const inValues = (op.value as any[]).map((v) => `'${String(v)}'`).join(",")
          whereConditions.push(`data->>'${op.field}' IN (${inValues})`)
          break
        case "notIn":
          const notInValues = (op.value as any[]).map((v) => `'${String(v)}'`).join(",")
          whereConditions.push(`data->>'${op.field}' NOT IN (${notInValues})`)
          break
        case "search":
          // Full-text search using PostgreSQL's ILIKE for simplicity
          whereConditions.push(`data::text ILIKE $${paramIndex}`)
          params.push(`%${op.value}%`)
          paramIndex++
          break
        case "and":
          if (op.conditions && op.conditions.length > 0) {
            const andConditions = this.buildConditionsFromOperators(op.conditions, paramIndex, params)
            whereConditions.push(`(${andConditions.conditions.join(" AND ")})`)
            paramIndex = andConditions.paramIndex
          }
          break
        case "or":
          if (op.conditions && op.conditions.length > 0) {
            const orConditions = this.buildConditionsFromOperators(op.conditions, paramIndex, params)
            whereConditions.push(`(${orConditions.conditions.join(" OR ")})`)
            paramIndex = orConditions.paramIndex
          }
          break
        case "not":
          if (op.conditions) {
            const conditions = Array.isArray(op.conditions) ? op.conditions : [op.conditions]
            const notConditions = this.buildConditionsFromOperators(conditions, paramIndex, params)
            whereConditions.push(`NOT (${notConditions.conditions.join(" AND ")})`)
            paramIndex = notConditions.paramIndex
          }
          break
      }
    }

    // Build query
    const whereClause = whereConditions.join(" AND ")
    const orderBy = orderByClause || "ORDER BY created_at DESC"

    // Get total count
    const countResult = await client.query(`SELECT COUNT(*) FROM documents WHERE ${whereClause}`, params)
    const total = Number.parseInt(countResult.rows[0].count)

    // Get documents
    const result = await client.query(
      `SELECT * FROM documents 
       WHERE ${whereClause}
       ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    )

    return {
      documents: result.rows.map((row) => this.mapRow(row)),
      total,
    }
  }

  async queryWithCursor(
    collectionId: string,
    operators: QueryOperator[],
    collection: Collection,
    limit = 25,
    cursor?: string,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<{ documents: Document[]; nextCursor: string | null; hasMore: boolean }> {
    const client = tx || pool

    if (projectId) {
      const dbCheck = await client.query(`SELECT project_id FROM databases WHERE id = $1 AND deleted_at IS NULL`, [
        collection.database_id,
      ])

      if (dbCheck.rows.length === 0 || dbCheck.rows[0].project_id !== projectId) {
        throw new AppError(
          403,
          "TENANT_ISOLATION_VIOLATION",
          "Cannot query documents from a collection you don't own",
          {
            hint: "The collection does not belong to your project",
          },
        )
      }
    }

    const whereConditions: string[] = ["collection_id = $1", "deleted_at IS NULL"]
    const params: any[] = [collectionId]
    let paramIndex = 2

    let offset = 0
    if (cursor) {
      const cursorData = this.cursorPaginator.decodeCursor(cursor)
      offset = cursorData.offset
    }

    let orderByClause = ""

    // Check for indexed fields
    const indexedFields: Set<string> = new Set()
    if (collection.schema_id) {
      const schemaResult = await client.query("SELECT definition FROM collection_schemas WHERE id = $1", [
        collection.schema_id,
      ])
      if (schemaResult.rows.length > 0) {
        const schema = schemaResult.rows[0].definition
        schema.fields?.forEach((field: any) => {
          if (field.indexed) {
            indexedFields.add(field.name)
          }
        })
      }
    }

    // Process operators (same as before)
    for (const op of operators) {
      if (op.field && !indexedFields.has(op.field) && op.type !== "limit" && op.type !== "offset") {
        logger.warn("Query on non-indexed field", {
          collection_id: collectionId,
          field: op.field,
        })
      }

      switch (op.type) {
        case "equal":
          whereConditions.push(`data->>'${op.field}' = $${paramIndex}`)
          params.push(String(op.value))
          paramIndex++
          break
        case "notEqual":
          whereConditions.push(`data->>'${op.field}' != $${paramIndex}`)
          params.push(String(op.value))
          paramIndex++
          break
        case "lessThan":
          whereConditions.push(`(data->>'${op.field}')::numeric < $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "greaterThan":
          whereConditions.push(`(data->>'${op.field}')::numeric > $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        case "contains":
          whereConditions.push(`data->>'${op.field}' LIKE $${paramIndex}`)
          params.push(`%${op.value}%`)
          paramIndex++
          break
        case "limit":
          limit = Math.min(Number(op.value) || 25, 100)
          break
        case "orderBy":
          const direction = op.direction === "desc" ? "DESC" : "ASC"
          orderByClause = `ORDER BY data->>'${op.field}' ${direction}, created_at DESC, id DESC`
          break
        case "in":
          const inValues = (op.value as any[]).map((v) => `'${String(v)}'`).join(",")
          whereConditions.push(`data->>'${op.field}' IN (${inValues})`)
          break
      }
    }

    // Build query with cursor pagination
    const whereClause = whereConditions.join(" AND ")
    const orderBy = orderByClause || "ORDER BY created_at DESC, id DESC"

    // Fetch one extra record to check if there are more results
    const fetchLimit = limit + 1

    const result = await client.query(
      `SELECT * FROM documents 
       WHERE ${whereClause}
       ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, fetchLimit, offset],
    )

    const documents = result.rows.slice(0, limit).map((row) => this.mapRow(row))
    const hasMore = result.rows.length > limit
    const nextCursor = hasMore ? this.cursorPaginator.getNextCursor(offset, limit, hasMore) : null

    return {
      documents,
      nextCursor,
      hasMore,
    }
  }

  async getVersions(documentId: string, tx?: PoolClient): Promise<DocumentVersion[]> {
    const client = tx || pool

    const result = await client.query(
      `SELECT * FROM document_versions 
       WHERE document_id = $1 
       ORDER BY version DESC`,
      [documentId],
    )

    return result.rows.map((row) => this.mapVersionRow(row))
  }

  async patch(
    id: string,
    collectionId: string,
    patchedData: any,
    projectId?: string,
    tx?: PoolClient,
  ): Promise<Document> {
    const client = tx || (await pool.connect())

    try {
      if (!tx) await client.query("BEGIN")

      let query = `
        SELECT d.* 
        FROM documents d
        JOIN collections c ON d.collection_id = c.id
        JOIN databases db ON c.database_id = db.id
        WHERE d.id = $1 AND d.collection_id = $2 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
      `
      const params: any[] = [id, collectionId]

      if (projectId) {
        query += ` AND db.project_id = $3`
        params.push(projectId)
      }

      const current = await client.query(query, params)

      if (current.rows.length === 0) {
        throw new AppError(404, "NOT_FOUND", "Document not found or access denied")
      }

      const currentDoc = this.mapRow(current.rows[0])
      const newVersion = this.versioningEnabled ? currentDoc.version + 1 : currentDoc.version

      // Update document with patched data
      const updateResult = await client.query(
        `UPDATE documents 
         SET data = $1, version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND collection_id = $4
         RETURNING *`,
        [JSON.stringify(patchedData), newVersion, id, collectionId],
      )

      // Insert version history only if versioning is enabled
      if (this.versioningEnabled) {
        await client.query(
          `INSERT INTO document_versions (id, document_id, collection_id, data, schema_version, version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            generateId(),
            id,
            collectionId,
            JSON.stringify(patchedData),
            currentDoc.schema_version,
            newVersion,
            new Date(),
          ],
        )

        // Cleanup old versions if limit is exceeded
        await this.cleanupOldVersions(id, collectionId, client)
      }

      if (!tx) await client.query("COMMIT")

      return this.mapRow(updateResult.rows[0])
    } catch (error) {
      if (!tx) await client.query("ROLLBACK")
      throw error
    } finally {
      if (!tx) client.release()
    }
  }

  async countByCollectionId(collectionId: string, projectId?: string, tx?: PoolClient): Promise<number> {
    const client = tx || pool

    let query = `
      SELECT COUNT(*) as count
      FROM documents d
      JOIN collections c ON d.collection_id = c.id
      JOIN databases db ON c.database_id = db.id
      WHERE d.collection_id = $1 AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND db.deleted_at IS NULL
    `
    const params: any[] = [collectionId]

    if (projectId) {
      query += ` AND db.project_id = $2`
      params.push(projectId)
    }

    const result = await client.query(query, params)
    return Number.parseInt(result.rows[0].count)
  }

  // FIXED: Added team_id and permission_rules
  private mapRow(row: any): Document {
    return {
      id: row.id,
      collection_id: row.collection_id,
      team_id: row.team_id,
      data: row.data,
      schema_version: row.schema_version,
      version: row.version,
      owner_id: row.owner_id,
      visibility: row.visibility,
      permission_rules: row.permission_rules,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }
  }

  private mapVersionRow(row: any): DocumentVersion {
    return {
      id: row.id,
      document_id: row.document_id,
      collection_id: row.collection_id,
      data: row.data,
      schema_version: row.schema_version,
      version: row.version,
      created_at: row.created_at,
    }
  }

  private buildConditionsFromOperators(
    operators: QueryOperator[],
    startParamIndex: number,
    params: any[],
  ): { conditions: string[]; paramIndex: number } {
    const conditions: string[] = []
    let paramIndex = startParamIndex

    for (const op of operators) {
      switch (op.type) {
        case "equal":
          conditions.push(`data->>'${op.field}' = $${paramIndex}`)
          params.push(String(op.value))
          paramIndex++
          break
        case "greaterThan":
          conditions.push(`(data->>'${op.field}')::numeric > $${paramIndex}`)
          params.push(Number(op.value))
          paramIndex++
          break
        // Add more as needed
      }
    }

    return { conditions, paramIndex }
  }
}
