import { pool } from "@mavibase/database/config/database"
import { AppError } from "@mavibase/core"

export interface DatabaseQuotas {
  max_collections: number
  max_documents_per_collection: number
  max_storage_bytes: number
  current_collections: number
  current_documents: number
  current_storage_bytes: number
}

export interface DatabaseSizeBreakdown {
  documents: number
  collections: number
  indexes: number
  schemas: number
  relationships: number
  versions: number
  total: number
  last_calculated_at: Date | null
}

export interface QuotaUsageResponse {
  quotas: DatabaseQuotas
  size: DatabaseSizeBreakdown
  formatted: {
    documents: string
    collections: string
    indexes: string
    schemas: string
    relationships: string
    versions: string
    total: string
  }
  utilization: {
    storage_percentage: number
    collections_percentage: number
    documents_percentage: number
  }
}

export class QuotaManager {
  /**
   * Check if database can create a new collection
   */
  async checkCollectionQuota(databaseId: string): Promise<void> {
    const result = await pool.query(
      `SELECT max_collections, current_collections 
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const { max_collections, current_collections } = result.rows[0]

    if (current_collections >= max_collections) {
      throw new AppError(
        429,
        "COLLECTION_QUOTA_EXCEEDED",
        `Collection limit reached. Maximum ${max_collections} collections allowed.`,
        {
          limit: max_collections,
          current: current_collections,
          hint: "Delete unused collections or upgrade your plan",
        },
      )
    }
  }

  /**
   * Check if collection can create multiple documents (bulk check)
   */
  async checkBulkDocumentQuota(databaseId: string, collectionId: string, count: number): Promise<void> {
    const dbResult = await pool.query(
      `SELECT max_documents_per_collection, current_documents 
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (dbResult.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const { max_documents_per_collection, current_documents } = dbResult.rows[0]

    const collectionDocCount = await pool.query(
      `SELECT COUNT(*) as count 
       FROM documents 
       WHERE collection_id = $1 AND deleted_at IS NULL`,
      [collectionId],
    )

    const currentCollectionDocs = Number.parseInt(collectionDocCount.rows[0].count)
    const afterBulkCount = currentCollectionDocs + count

    if (afterBulkCount > max_documents_per_collection) {
      const available = max_documents_per_collection - currentCollectionDocs
      throw new AppError(
        429,
        "DOCUMENT_QUOTA_EXCEEDED",
        `Bulk create would exceed document limit for this collection. Maximum ${max_documents_per_collection} documents allowed per collection.`,
        {
          limit: max_documents_per_collection,
          current: currentCollectionDocs,
          requested: count,
          available: Math.max(0, available),
          hint: available > 0 
            ? `You can only add ${available} more document(s) to this collection`
            : "Delete unused documents or upgrade your plan",
        },
      )
    }

    // Also check total database document limit
    if (current_documents + count > max_documents_per_collection * 100) {
      throw new AppError(429, "DATABASE_DOCUMENT_QUOTA_EXCEEDED", "Bulk create would exceed total document limit for database", {
        hint: "Delete unused documents or upgrade your plan",
      })
    }
  }

  /**
   * Check if collection can create a new document
   */
  async checkDocumentQuota(databaseId: string, collectionId: string): Promise<void> {
    const dbResult = await pool.query(
      `SELECT max_documents_per_collection, current_documents 
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (dbResult.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const { max_documents_per_collection, current_documents } = dbResult.rows[0]

    const collectionDocCount = await pool.query(
      `SELECT COUNT(*) as count 
       FROM documents 
       WHERE collection_id = $1 AND deleted_at IS NULL`,
      [collectionId],
    )

    const currentCollectionDocs = Number.parseInt(collectionDocCount.rows[0].count)

    if (currentCollectionDocs >= max_documents_per_collection) {
      throw new AppError(
        429,
        "DOCUMENT_QUOTA_EXCEEDED",
        `Document limit reached for this collection. Maximum ${max_documents_per_collection} documents allowed per collection.`,
        {
          limit: max_documents_per_collection,
          current: currentCollectionDocs,
          hint: "Delete unused documents or upgrade your plan",
        },
      )
    }

    if (current_documents >= max_documents_per_collection * 100) {
      throw new AppError(429, "DATABASE_DOCUMENT_QUOTA_EXCEEDED", "Total document limit reached for database", {
        hint: "Delete unused documents or upgrade your plan",
      })
    }
  }

  /**
   * Check if database has enough storage space
   */
  async checkStorageQuota(databaseId: string, additionalBytes: number): Promise<void> {
    const result = await pool.query(
      `SELECT max_storage_bytes, current_storage_bytes 
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const max_storage_bytes = Number(result.rows[0].max_storage_bytes)
    const current_storage_bytes = Number(result.rows[0].current_storage_bytes)

    if (current_storage_bytes + additionalBytes > max_storage_bytes) {
      throw new AppError(
        429,
        "STORAGE_QUOTA_EXCEEDED",
        `Storage limit reached. Maximum ${this.formatBytes(max_storage_bytes)} allowed.`,
        {
          limit: max_storage_bytes,
          current: current_storage_bytes,
          additional: additionalBytes,
          hint: "Delete unused data or upgrade your plan",
        },
      )
    }
  }

  /**
   * Increment collection count
   */
  async incrementCollectionCount(databaseId: string): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET current_collections = current_collections + 1 
       WHERE id = $1`,
      [databaseId],
    )
  }

  /**
   * Decrement collection count
   */
  async decrementCollectionCount(databaseId: string): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET current_collections = GREATEST(0, current_collections - 1) 
       WHERE id = $1`,
      [databaseId],
    )
  }

  /**
   * Increment document count
   */
  async incrementDocumentCount(databaseId: string, count = 1): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET current_documents = current_documents + $2 
       WHERE id = $1`,
      [databaseId, count],
    )
  }

  /**
   * Decrement document count
   */
  async decrementDocumentCount(databaseId: string, count = 1): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET current_documents = GREATEST(0, current_documents - $2) 
       WHERE id = $1`,
      [databaseId, count],
    )
  }

  /**
   * Update storage usage
   */
  async updateStorageUsage(databaseId: string, bytes: number): Promise<void> {
    await pool.query(
      `UPDATE databases 
       SET current_storage_bytes = GREATEST(0, current_storage_bytes + $2) 
       WHERE id = $1`,
      [databaseId, bytes],
    )
  }

  /**
   * Get current quota usage for a database
   */
  async getQuotaUsage(databaseId: string): Promise<DatabaseQuotas> {
    const result = await pool.query(
      `SELECT 
        max_collections,
        max_documents_per_collection,
        max_storage_bytes,
        current_collections,
        current_documents,
        current_storage_bytes
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    return result.rows[0]
  }

  /**
   * Recalculate and update actual usage (for maintenance)
   */
  async recalculateUsage(databaseId: string): Promise<void> {
    const client = await pool.connect()

    try {
      await client.query("BEGIN")

      // Count collections
      const collectionsResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM collections 
         WHERE database_id = $1 AND deleted_at IS NULL`,
        [databaseId],
      )
      const collectionCount = Number.parseInt(collectionsResult.rows[0].count)

      // Count documents across all collections
      const documentsResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM documents d
         JOIN collections c ON d.collection_id = c.id
         WHERE c.database_id = $1 AND d.deleted_at IS NULL`,
        [databaseId],
      )
      const documentCount = Number.parseInt(documentsResult.rows[0].count)

      // Calculate storage (rough estimate based on JSON data size)
      const storageResult = await client.query(
        `SELECT COALESCE(SUM(LENGTH(d.data::text)), 0) as bytes
         FROM documents d
         JOIN collections c ON d.collection_id = c.id
         WHERE c.database_id = $1 AND d.deleted_at IS NULL`,
        [databaseId],
      )
      const storageBytes = Number.parseInt(storageResult.rows[0].bytes)

      // Update database with actual values
      await client.query(
        `UPDATE databases 
         SET current_collections = $2,
             current_documents = $3,
             current_storage_bytes = $4
         WHERE id = $1`,
        [databaseId, collectionCount, documentCount, storageBytes],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get comprehensive quota and size usage for a database
   */
  async getQuotaAndSizeUsage(databaseId: string): Promise<QuotaUsageResponse> {
    const result = await pool.query(
      `SELECT 
        max_collections,
        max_documents_per_collection,
        max_storage_bytes,
        current_collections,
        current_documents,
        current_storage_bytes,
        size_documents_bytes,
        size_collections_bytes,
        size_indexes_bytes,
        size_schemas_bytes,
        size_relationships_bytes,
        size_versions_bytes,
        size_total_bytes,
        size_last_calculated_at
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const row = result.rows[0]

    const quotas: DatabaseQuotas = {
      max_collections: row.max_collections,
      max_documents_per_collection: row.max_documents_per_collection,
      max_storage_bytes: Number(row.max_storage_bytes),
      current_collections: row.current_collections,
      current_documents: row.current_documents,
      current_storage_bytes: Number(row.current_storage_bytes),
    }

    const size: DatabaseSizeBreakdown = {
      documents: Number(row.size_documents_bytes || 0),
      collections: Number(row.size_collections_bytes || 0),
      indexes: Number(row.size_indexes_bytes || 0),
      schemas: Number(row.size_schemas_bytes || 0),
      relationships: Number(row.size_relationships_bytes || 0),
      versions: Number(row.size_versions_bytes || 0),
      total: Number(row.size_total_bytes || 0),
      last_calculated_at: row.size_last_calculated_at,
    }

    return {
      quotas,
      size,
      formatted: {
        documents: this.formatBytes(size.documents),
        collections: this.formatBytes(size.collections),
        indexes: this.formatBytes(size.indexes),
        schemas: this.formatBytes(size.schemas),
        relationships: this.formatBytes(size.relationships),
        versions: this.formatBytes(size.versions),
        total: this.formatBytes(size.total),
      },
      utilization: {
        storage_percentage: quotas.max_storage_bytes > 0 ? (size.total / quotas.max_storage_bytes) * 100 : 0,
        collections_percentage:
          quotas.max_collections > 0 ? (quotas.current_collections / quotas.max_collections) * 100 : 0,
        documents_percentage:
          quotas.max_documents_per_collection * 100 > 0
            ? (quotas.current_documents / (quotas.max_documents_per_collection * 100)) * 100
            : 0,
      },
    }
  }

  /**
   * Get size breakdown for a specific database
   */
  async getSizeBreakdown(databaseId: string): Promise<DatabaseSizeBreakdown> {
    const result = await pool.query(
      `SELECT 
        size_documents_bytes,
        size_collections_bytes,
        size_indexes_bytes,
        size_schemas_bytes,
        size_relationships_bytes,
        size_versions_bytes,
        size_total_bytes,
        size_last_calculated_at
       FROM databases 
       WHERE id = $1 AND deleted_at IS NULL`,
      [databaseId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
    }

    const row = result.rows[0]

    return {
      documents: Number(row.size_documents_bytes || 0),
      collections: Number(row.size_collections_bytes || 0),
      indexes: Number(row.size_indexes_bytes || 0),
      schemas: Number(row.size_schemas_bytes || 0),
      relationships: Number(row.size_relationships_bytes || 0),
      versions: Number(row.size_versions_bytes || 0),
      total: Number(row.size_total_bytes || 0),
      last_calculated_at: row.size_last_calculated_at,
    }
  }

  /**
   * Recalculate sizes for all resources in a database
   * Useful for migrations or fixing inconsistencies
   */
async recalculateSizes(databaseId: string): Promise<DatabaseSizeBreakdown> {
    const client = await pool.connect()

    try {
      await client.query("BEGIN")

      // Calculate actual storage sizes using pg_column_size
      const sizeResult = await client.query(
        `WITH database_sizes AS (
          -- Documents (THE BIG ONE - 95%+ of storage)
          SELECT 
            COALESCE(SUM(pg_column_size(d.*)), 0) as documents_size
          FROM documents d
          JOIN collections c ON d.collection_id = c.id
          WHERE c.database_id = $1 
            AND d.deleted_at IS NULL
        ),
        collection_sizes AS (
          -- Collections
          SELECT 
            COALESCE(SUM(pg_column_size(c.*)), 0) as collections_size
          FROM collections c
          WHERE c.database_id = $1 
            AND c.deleted_at IS NULL
        ),
        schema_sizes AS (
          -- Collection Schemas
          SELECT 
            COALESCE(SUM(pg_column_size(cs.*)), 0) as schemas_size
          FROM collection_schemas cs
          JOIN collections c ON cs.collection_id = c.id
          WHERE c.database_id = $1
        ),
        attribute_sizes AS (
          -- Attributes
          SELECT 
            COALESCE(SUM(pg_column_size(a.*)), 0) as attributes_size
          FROM attributes a
          JOIN collections c ON a.collection_id = c.id
          WHERE c.database_id = $1
        ),
        relationship_sizes AS (
          -- Relationships
          SELECT 
            COALESCE(SUM(pg_column_size(r.*)), 0) as relationships_size
          FROM relationships r
          WHERE r.database_id = $1 
            AND r.deleted_at IS NULL
        ),
        version_sizes AS (
          -- Document Versions
          SELECT 
            COALESCE(SUM(pg_column_size(dv.*)), 0) as versions_size
          FROM document_versions dv
          JOIN documents d ON dv.document_id = d.id
          JOIN collections c ON d.collection_id = c.id
          WHERE c.database_id = $1
        )
        SELECT 
          d.documents_size,
          c.collections_size,
          s.schemas_size,
          a.attributes_size,
          r.relationships_size,
          v.versions_size
        FROM database_sizes d, collection_sizes c, schema_sizes s, 
             attribute_sizes a, relationship_sizes r, version_sizes v`,
        [databaseId],
      )

      if (sizeResult.rows.length === 0) {
        throw new AppError(404, "DATABASE_NOT_FOUND", "Database not found")
      }

      const sizes = sizeResult.rows[0]
      
      // Get actual sizes
      const documentsSize = Number(sizes.documents_size || 0)
      const collectionsSize = Number(sizes.collections_size || 0)
      const schemasSize = Number(sizes.schemas_size || 0)
      const attributesSize = Number(sizes.attributes_size || 0)
      const relationshipsSize = Number(sizes.relationships_size || 0)
      const versionsSize = Number(sizes.versions_size || 0)
      
      // Calculate subtotal
      const subtotal = documentsSize + collectionsSize + schemasSize + attributesSize + relationshipsSize + versionsSize
      
      // Add 30% overhead for indexes
      const totalSize = Math.round(subtotal * 1.3)

      // Update database with calculated sizes
      await client.query(
        `UPDATE databases 
         SET 
           size_documents_bytes = $2,
           size_collections_bytes = $3,
           size_indexes_bytes = $4,  -- Store index overhead separately
           size_schemas_bytes = $5,
           size_relationships_bytes = $6,
           size_versions_bytes = $7,
           size_total_bytes = $8,
           size_last_calculated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          databaseId, 
          documentsSize, 
          collectionsSize, 
          Math.round(subtotal * 0.3), // 30% for indexes
          schemasSize, 
          relationshipsSize, 
          versionsSize, 
          totalSize
        ],
      )

      // Also update current_storage_bytes for quota tracking
      await client.query(
        `UPDATE databases 
         SET current_storage_bytes = $2
         WHERE id = $1`,
        [databaseId, totalSize],
      )

      await client.query("COMMIT")

      return {
        documents: documentsSize,
        collections: collectionsSize,
        indexes: Math.round(subtotal * 0.3),
        schemas: schemasSize,
        relationships: relationshipsSize,
        versions: versionsSize,
        total: totalSize,
        last_calculated_at: new Date(),
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
}
