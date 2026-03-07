import type { Request, Response, NextFunction } from "express"
import { IndexRepository } from "@mavibase/database/engine/indexes/IndexRepository"
import { CollectionRepository } from "@mavibase/database/engine/collections/CollectionRepository"
import { AuthorizationPolicy } from "@mavibase/database/security/authorization/AuthorizationPolicy"
import { QuotaManager } from "@mavibase/database/storage/QuotaManager"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { generateId } from "@mavibase/database/utils/id-generator"

export class IndexController {
  private repository = new IndexRepository()
  private collectionRepository = new CollectionRepository()
  private policy = new AuthorizationPolicy()
  private quotaManager = new QuotaManager()

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params
      const projectId = req.identity!.project_id
      const collection = await this.collectionRepository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionRead(req.identity!, collection)

      const indexes = await this.repository.findByCollectionId(collectionId)


      res.json({
        success: true,
        message: `Retrieved ${indexes.length} index(es)`,
        data: indexes,
      })
    } catch (error) {

      next(error)
    }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {

      const { collectionId } = req.params
      const { fieldName, fieldNames, indexType, isUnique, key, name } = req.body


      // Support both single fieldName and multiple fieldNames
      let fields: string[]
      if (fieldNames && Array.isArray(fieldNames) && fieldNames.length > 0) {
        fields = fieldNames
      } else if (fieldName) {
        fields = [fieldName]
      } else {
        throw new AppError(400, "INVALID_INPUT", "Either fieldName or fieldNames array is required")
      }


      const validIndexTypes = ["btree", "hash", "gin", "unique", "key"]
      if (indexType && !validIndexTypes.includes(indexType)) {
        throw new AppError(400, "INVALID_INDEX_TYPE", `Index type must be one of: ${validIndexTypes.join(", ")}`)
      }

      const projectId = req.identity!.project_id

      const collection = await this.collectionRepository.findById(collectionId, projectId)

      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionWrite(req.identity!, collection)

      // Check storage quota for index (estimate size based on index metadata)
      const indexSize = fields.join(',').length * 100 // Estimate ~100 bytes per field for index overhead
      await this.quotaManager.checkStorageQuota(collection.database_id, indexSize)

      // For single field, check if index already exists
      if (fields.length === 1) {
        const existing = await this.repository.findByFieldName(collectionId, fields[0])

        if (existing) {
          throw new AppError(409, "INDEX_ALREADY_EXISTS", `Index already exists for field '${fields[0]}'`)
        }
      }

      // Generate index name
      // Priority: 1. Custom 'name' parameter, 2. 'key' parameter, 3. Auto-generated
      const indexNameSuffix = fields.join('_')
      const indexName = name || key || `idx_doc_${collectionId.replace(/-/g, "_")}_${indexNameSuffix}`


      // Determine actual index type and uniqueness
      let actualIndexType: "btree" | "hash" | "gin" = "btree"
      let actualIsUnique = isUnique || false

      if (indexType === "gin") {
        actualIndexType = "gin"
        // GIN indexes don't support unique constraints
        actualIsUnique = false
      } else if (indexType === "hash") {
        actualIndexType = "hash"
        // Hash indexes don't support unique constraints in PostgreSQL
        actualIsUnique = false
      } else if (indexType === "unique") {
        actualIndexType = "btree"
        actualIsUnique = true
      } else if (indexType === "key" || indexType === "btree") {
        actualIndexType = "btree"
      }


      const index = await this.repository.create({
        id: generateId(),
        collection_id: collectionId,
        field_name: fields[0], // Primary field for backward compatibility
        field_names: fields,
        index_type: actualIndexType,
        is_unique: actualIsUnique,
        created_at: new Date(),
      })


      // Update storage usage for the index
      await this.quotaManager.updateStorageUsage(collection.database_id, indexSize)

      // Create the actual database index asynchronously
      this.repository
        .createDatabaseIndex(collectionId, fields, indexName, actualIndexType, actualIsUnique)
        .then(() => {
          console.log(`[SUCCESS] Database index '${indexName}' created for field(s): ${fields.join(", ")}`)
          this.repository.updateStatus(index.id, "active", null).catch(console.error)
        })
        .catch((error) => {
          console.error("Failed to create database index:", error)
          // Update metadata to mark as failed
          this.repository.updateStatus(index.id, "failed", error.message).catch(console.error)
        })

      res.status(201).json({
        success: true,
        message: fields.length === 1 
          ? `Index creation initiated for field '${fields[0]}'`
          : `Compound index creation initiated for fields: ${fields.join(", ")}`,
        data: {
          ...index,
          index_name: indexName,
          field_count: fields.length,
          is_compound: fields.length > 1,
        },
      })

    } catch (error) {

      next(error)
    }
  }

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {

      const { collectionId, indexId } = req.params
      const projectId = req.identity!.project_id


      const collection = await this.collectionRepository.findById(collectionId, projectId)

      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionWrite(req.identity!, collection)

      const index = await this.repository.findById(indexId)

      if (!index || index.collection_id !== collectionId) {
        throw new AppError(404, "INDEX_NOT_FOUND", "Index not found")
      }

      // Drop the database index
      const indexName = `idx_doc_${collectionId.replace(/-/g, "_")}_${index.field_name}`

      await this.repository.dropDatabaseIndex(indexName)

      await this.repository.delete(indexId)

      // Reduce storage usage for the deleted index
      const indexSize = (index.field_names || [index.field_name]).join(',').length * 100
      await this.quotaManager.updateStorageUsage(collection.database_id, -indexSize)

      res.json({
        success: true,
        message: `Index for field '${index.field_name}' deleted successfully`,
        data: { deletedId: indexId },
      })

    } catch (error) {

      next(error)
    }
  }
}
