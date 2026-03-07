import type { Request, Response, NextFunction } from "express"
import { DocumentRepository } from "@mavibase/database/engine/documents/DocumentRepository"
import { CollectionRepository } from "@mavibase/database/engine/collections/CollectionRepository"
import { DatabaseRepository } from "@mavibase/database/engine/databases/DatabaseRepository"
import { SchemaValidator } from "@mavibase/database/schema/SchemaValidator"
import { QueryParser } from "@mavibase/database/query/QueryParser"
import { FieldProjector } from "@mavibase/database/utils/FieldProjector"
import { PatchOperator } from "@mavibase/database/utils/PatchOperator"
import { ETagGenerator } from "@mavibase/database/utils/EtagGenerator"
import { QuotaManager } from "@mavibase/database/storage/QuotaManager"
import { AuthorizationPolicy } from "@mavibase/database/security/authorization/AuthorizationPolicy"
import { TransactionController } from "@mavibase/api/controllers/v1/transactions/TransactionController"
import { validateIfMatch } from "@mavibase/database/utils/etag-validator"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { InputValidator } from "@mavibase/api/middleware/input-validator"
import { generateId } from "@mavibase/database/utils/id-generator"
import { pool } from "@mavibase/database/config/database"
import type { PoolClient } from "pg"
import { RelationshipManager } from "@mavibase/database/engine/relationships/RelationshipManager"

export class DocumentController {
  private repository = new DocumentRepository()
  private collectionRepository = new CollectionRepository()
  private databaseRepository = new DatabaseRepository()
  private validator = new SchemaValidator()
  private queryParser = new QueryParser()
  private fieldProjector = new FieldProjector()
  private patchOperator = new PatchOperator()
  private etagGenerator = new ETagGenerator()
  private quotaManager = new QuotaManager()
  private policy = new AuthorizationPolicy()
  private relationshipManager = new RelationshipManager()
  private versioningEnabled = process.env.ENABLE_VERSIONING !== "false"

  /**
   * Helper: Get transaction client if X-Transaction-Id header present
   */
  private getTransactionClient(req: Request): PoolClient | null {
    const transactionId = req.headers['x-transaction-id'] as string | undefined
    
    if (!transactionId) {
      return null  // No transaction
    }

    const { databaseId } = req.params
    const projectId = req.identity!.project_id

    const txData = TransactionController.getTransactionClient(
      transactionId,
      projectId,
      databaseId
    )

    if (!txData) {
      throw new AppError(400, "INVALID_TRANSACTION", 
        "Transaction not found, expired, or operation limit exceeded", {
          transactionId,
          hint: "Start a new transaction or check if it has expired",
        })
    }

    return txData.client
  }

  /**
   * Helper: Increment transaction operation count
   */
  private incrementTransactionCount(req: Request, count: number = 1): void {
    const transactionId = req.headers['x-transaction-id'] as string | undefined
    
    if (transactionId) {
      // Increment operation count for each operation
      for (let i = 0; i < count; i++) {
        TransactionController.incrementOperationCount(transactionId)
      }
    }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId } = req.params
      let documentData = req.body

      InputValidator.validateDocumentData(documentData)

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      // Check permissions at OPERATION time (not at commit)
      if (!this.policy.canCreateDocument(req.identity!, collection)) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to create documents in this collection", {
          collectionId,
        })
      }

      await this.quotaManager.checkDocumentQuota(databaseId, collectionId)

      const documentSize = JSON.stringify(documentData).length
      await this.quotaManager.checkStorageQuota(databaseId, documentSize)

      // Validate against schema if exists and validation is enabled
      const schemaValidationEnabled = process.env.ENABLE_SCHEMA_VALIDATION !== "false"
      if (collection.schema_id && schemaValidationEnabled) {
        await this.validator.validate(
  documentData, 
  collection.schema_id,
  req.identity!.project_id,
  collectionId
)
      }

      const ownerId = this.policy.getOwnerId(req.identity!)
      const visibility = this.policy.getDefaultDocumentVisibility()

      // Extract $permissions from body if present
      const permissions = documentData.$permissions
      if (documentData.$permissions) {
        delete documentData.$permissions
      }

      // Get transaction client if in transaction
      const txClient = this.getTransactionClient(req)

      // Create document (with or without transaction)
      const document = await this.repository.create(
        {
          id: generateId(),
          collection_id: collectionId,
          team_id: req.identity!.team_id,
          data: documentData,
          owner_id: ownerId,
          visibility,
          permission_rules: permissions,
          version: this.versioningEnabled ? 1 : 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
        req.identity!.project_id,
        txClient,
      )

      // Increment transaction counter if in transaction
      this.incrementTransactionCount(req)

      // Update quotas (even in transaction - quota checks are immediate)
      await this.quotaManager.incrementDocumentCount(databaseId)
      await this.quotaManager.updateStorageUsage(databaseId, documentSize)

      // Sync two-way relationships (update reverse side documents)
      await this.syncTwoWayRelationships(
        collectionId,
        document.id,
        documentData,
        null, // No old data for create
        req.identity!.project_id
      )

      const effectivePermissions = document.permission_rules || collection.permission_rules || {}

      const responseData = {
        $id: document.id,
        $collection_id: collectionId,
        $database_id: databaseId,
        $created_at: document.created_at,
        $updated_at: document.updated_at,
        $version: document.version,
        $permissions: effectivePermissions,
        ...document.data,
      }

      const fields = req.query.fields as string | undefined
      const projectedData = this.fieldProjector.project(responseData, fields)

      const etag = this.etagGenerator.generate(document.version, document.updated_at)
      res.setHeader("ETag", etag)

      res.status(201).json({
        success: true,
        message: "Document created successfully",
        data: projectedData,
      })
    } catch (error) {
      next(error)
    }
  }

list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId, collectionId } = req.params

    const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
    if (!collection || collection.database_id !== databaseId) {
      throw new AppError(
        404,
        "COLLECTION_NOT_FOUND",
        `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
        { collectionId, databaseId },
      )
    }

    // Enforce document listing access (checks role permissions + collection RLS rules)
    this.policy.enforceDocumentList(req.identity!, collection)

    const queries = this.queryParser.parse(req.query.queries as string | undefined)
    this.queryParser.validateOperators(queries)

    const useCursor = !!req.query.cursor
    const cursor = req.query.cursor as string | undefined

    // ✅ NEW: Get populate parameter
    const populate = req.query.populate as string | undefined
    const populateFields = populate ? populate.split(',') : []

    if (useCursor) {
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 25, 100)
      let result = await this.repository.queryWithCursor(
        collectionId,
        queries,
        collection,
        limit,
        cursor,
        req.identity!.project_id,
      )

      // ✅ NEW: Populate relationships if requested
      if (populateFields.length > 0) {
        const relationshipManager = new RelationshipManager()
        result.documents = await relationshipManager.populateRelationships(
          result.documents,
          collectionId,
          populateFields,
          req.identity!.project_id
        )
      }

      const transformedDocs = result.documents.map((doc) => ({
        $id: doc.id,
        $collection_id: collectionId,
        $database_id: databaseId,
        $created_at: doc.created_at,
        $updated_at: doc.updated_at,
        $version: doc.version,
        $permissions: doc.permission_rules || collection.permission_rules || {},
        ...doc.data,
      }))

      const fields = req.query.fields as string | undefined
      const projectedDocs = this.fieldProjector.projectMany(transformedDocs, fields)

      res.json({
        success: true,
        message: `Retrieved ${projectedDocs.length} document(s)`,
        data: projectedDocs,
        pagination: {
          limit,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      })
    } else {
      InputValidator.validatePagination(req.query.limit as string, req.query.offset as string)

      const limit = Math.min(Number.parseInt(req.query.limit as string) || 25, 100)
      const offset = Number.parseInt(req.query.offset as string) || 0

      let result = await this.repository.query(
        collectionId, 
        queries, 
        collection, 
        limit, 
        offset, 
        req.identity!.project_id
      )

      // ✅ NEW: Populate relationships if requested
      if (populateFields.length > 0) {
        const relationshipManager = new RelationshipManager()
        result.documents = await relationshipManager.populateRelationships(
          result.documents,
          collectionId,
          populateFields,
          req.identity!.project_id
        )
      }

      const transformedDocs = result.documents.map((doc) => ({
        $id: doc.id,
        $collection_id: collectionId,
        $database_id: databaseId,
        $created_at: doc.created_at,
        $updated_at: doc.updated_at,
        $version: doc.version,
        $permissions: doc.permission_rules || collection.permission_rules || {},
        ...doc.data,
      }))

      const fields = req.query.fields as string | undefined
      const projectedDocs = this.fieldProjector.projectMany(transformedDocs, fields)

      res.json({
        success: true,
        message: `Retrieved ${projectedDocs.length} document(s)`,
        data: projectedDocs,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
      })
    }
  } catch (error) {
    next(error)
  }
}

get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId, collectionId, documentId } = req.params

    const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
    if (!collection || collection.database_id !== databaseId) {
      throw new AppError(
        404,
        "COLLECTION_NOT_FOUND",
        `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
        { collectionId, databaseId },
      )
    }

    let document = await this.repository.findById(documentId, collectionId, req.identity!.project_id)
    if (!document) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
        documentId,
        collectionId,
      })
    }

    // Enforce document-level read permissions
    this.policy.enforceDocumentRead(req.identity!, document, collection)

    // ✅ NEW: Populate relationships if requested
    const populate = req.query.populate as string | undefined
    if (populate) {
      const populateFields = populate.split(',')
      const relationshipManager = new RelationshipManager()
      
      const populated = await relationshipManager.populateRelationships(
        [document],
        collectionId,
        populateFields,
        req.identity!.project_id
      )
      
      document = populated[0]
    }

    const effectivePermissions = document.permission_rules || collection.permission_rules || {}

    const responseData = {
      $id: document.id,
      $collection_id: collectionId,
      $database_id: databaseId,
      $created_at: document.created_at,
      $updated_at: document.updated_at,
      $version: document.version,
      $permissions: effectivePermissions,
      ...document.data,
    }

    const fields = req.query.fields as string | undefined
    const projectedData = this.fieldProjector.project(responseData, fields)

    const etag = this.etagGenerator.generate(document.version, document.updated_at)
    res.setHeader("ETag", etag)

    res.json({
      success: true,
      message: "Document retrieved successfully",
      data: projectedData,
    })
  } catch (error) {
    next(error)
  }
}

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId } = req.params
      const updateData = req.body

      // Extract $permissions from body if present (same pattern as create)
      const permissions = updateData.$permissions
      if (updateData.$permissions) {
        delete updateData.$permissions
      }

      InputValidator.validateDocumentData(updateData)

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const existingDoc = await this.repository.findById(documentId, collectionId, req.identity!.project_id)
      if (!existingDoc) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      // Check permissions at OPERATION time
      this.policy.enforceDocumentWrite(req.identity!, existingDoc, collection)

      // Check storage quota for the size difference
      const oldSize = JSON.stringify(existingDoc.data).length
      const newSize = JSON.stringify(updateData).length
      const sizeDiff = newSize - oldSize
      if (sizeDiff > 0) {
        await this.quotaManager.checkStorageQuota(databaseId, sizeDiff)
      }

      const ifMatch = req.headers["if-match"] as string | undefined
      if (!validateIfMatch(existingDoc.version, existingDoc.updated_at, ifMatch)) {
        throw new AppError(
          412,
          "PRECONDITION_FAILED",
          "Document has been modified by another request. Please fetch the latest version and try again.",
          {
            hint: "Include the current ETag in the If-Match header to prevent conflicts",
            currentVersion: existingDoc.version,
          },
        )
      }

if (collection.schema_id) {
  await this.validator.validate(
    updateData, 
    collection.schema_id,
    req.identity!.project_id,    // ✅ ADD THIS
    collectionId                  // ✅ ADD THIS
  )
}
      // Get transaction client if in transaction
      const txClient = this.getTransactionClient(req)

      const document = await this.repository.update(
        documentId, 
        collectionId, 
        updateData, 
        req.identity!.project_id,
        txClient,
        permissions,
      )

      // Increment transaction counter if in transaction
      this.incrementTransactionCount(req)

      // Update storage usage with the size difference
      if (sizeDiff !== 0) {
        await this.quotaManager.updateStorageUsage(databaseId, sizeDiff)
      }

      // Sync two-way relationships (compare old vs new data)
      await this.syncTwoWayRelationships(
        collectionId,
        documentId,
        updateData,
        existingDoc.data as Record<string, unknown>,
        req.identity!.project_id
      )

      const effectivePermissions = document.permission_rules || collection.permission_rules || {}

      const responseData = {
        $id: document.id,
        $collection_id: collectionId,
        $database_id: databaseId,
        $created_at: document.created_at,
        $updated_at: document.updated_at,
        $version: document.version,
        $permissions: effectivePermissions,
        ...document.data,
      }

      const fields = req.query.fields as string | undefined
      const projectedData = this.fieldProjector.project(responseData, fields)

      const etag = this.etagGenerator.generate(document.version, document.updated_at)
      res.setHeader("ETag", etag)

      res.json({
        success: true,
        message: "Document updated successfully",
        data: projectedData,
      })
    } catch (error) {
      next(error)
    }
  }

  delete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId, collectionId, documentId } = req.params

    const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
    if (!collection || collection.database_id !== databaseId) {
      throw new AppError(
        404,
        "COLLECTION_NOT_FOUND",
        `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
        { collectionId, databaseId },
      )
    }

    const document = await this.repository.findById(documentId, collectionId, req.identity!.project_id)
    if (!document) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
        documentId,
        collectionId,
      })
    }

    // Check permissions at OPERATION time
    this.policy.enforceDocumentDelete(req.identity!, document, collection)

    // Handle cascade operations BEFORE deleting
    const relationshipManager = new RelationshipManager()
    await relationshipManager.handleCascadeDelete(
      documentId,
      collectionId,
      req.identity!.project_id
    )

    // Get transaction client if in transaction
    const txClient = this.getTransactionClient(req)

    // Calculate storage to free up
    const documentSize = JSON.stringify(document.data).length

    await this.repository.delete(
      documentId, 
      collectionId, 
      req.identity!.project_id,
      txClient,
    )

    // Update quotas - decrement counts and storage
    await this.quotaManager.decrementDocumentCount(databaseId)
    await this.quotaManager.updateStorageUsage(databaseId, -documentSize)

    // Increment transaction counter if in transaction
    this.incrementTransactionCount(req)

    res.json({
      success: true,
      message: `Document with ID "${documentId}" deleted successfully`,
      data: {
        deletedId: documentId,
      },
    })
  } catch (error) {
    next(error)
  }
}

  bulkCreate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId } = req.params
      const { documents } = req.body

      if (!Array.isArray(documents) || documents.length === 0) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Request body must contain a 'documents' array with at least one document",
          {
            hint: "Send an array of document objects in the 'documents' field",
          },
        )
      }

      if (documents.length > 100) {
        throw new AppError(400, "BATCH_LIMIT_EXCEEDED", "Cannot create more than 100 documents at once", {
          limit: 100,
          received: documents.length,
        })
      }

      // Check if in transaction and validate operation count
      const transactionId = req.headers['x-transaction-id'] as string | undefined
      if (transactionId) {
        const txData = TransactionController.getTransactionClient(
          transactionId,
          req.identity!.project_id,
          databaseId
        )

        if (!txData) {
          throw new AppError(400, "INVALID_TRANSACTION", "Transaction not found or expired")
        }

        // Check: Will this bulk op exceed transaction limit?
        const currentCount = txData.transaction.operation_count
        const newCount = currentCount + documents.length

        if (newCount > 1000) {  // MAX_OPS_PER_TRANSACTION
          throw new AppError(400, "TRANSACTION_LIMIT_EXCEEDED",
            `Bulk operation would exceed transaction limit (${newCount}/1000)`, {
              currentOperations: currentCount,
              bulkOperations: documents.length,
              limit: 1000,
            })
        }
      }

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          {
            collectionId,
            databaseId,
          },
        )
      }

      // Check document quota for bulk operation
      await this.quotaManager.checkBulkDocumentQuota(databaseId, collectionId, documents.length)

      // Check storage quota for bulk operation (estimate total size)
      const totalSize = documents.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0)
      await this.quotaManager.checkStorageQuota(databaseId, totalSize)

      const validatedDocs: any[] = []
      const validationErrors: any[] = []

      for (let i = 0; i < documents.length; i++) {
        try {
          InputValidator.validateDocumentData(documents[i])

          if (collection.schema_id) {
            const schemaResult = await pool.query("SELECT definition FROM collection_schemas WHERE id = $1", [
              collection.schema_id,
            ])
if (schemaResult.rows.length > 0) {
  const schema = schemaResult.rows[0].definition
  await this.validator.validateAgainstSchema(
    documents[i], 
    schema,
    req.identity!.project_id,    // ✅ ADD THIS
    collectionId                  // ✅ ADD THIS
  )
  await this.validator.validateUniqueConstraints(collectionId, documents[i], schema)
}
          }

          validatedDocs.push({
            id: generateId(),
            collection_id: collectionId,
            team_id: req.identity!.team_id,
            data: documents[i],
            version: this.versioningEnabled ? 1 : 0,
            created_at: new Date(),
            updated_at: new Date(),
          })
        } catch (error: any) {
          validationErrors.push({
            index: i,
            error: error.message,
            data: documents[i],
          })
        }
      }

      // Get transaction client if in transaction
      const txClient = this.getTransactionClient(req)

      const result = await this.repository.bulkCreate(
        validatedDocs, 
        req.identity!.project_id,
        txClient,
      )

      // Increment by NUMBER of successful documents
      this.incrementTransactionCount(req, result.success)

      // Update quotas for successfully created documents
      if (result.success > 0) {
        await this.quotaManager.incrementDocumentCount(databaseId, result.success)
        const successfulDocsSize = result.documents.reduce(
          (sum: number, doc: any) => sum + JSON.stringify(doc.data).length, 
          0
        )
        await this.quotaManager.updateStorageUsage(databaseId, successfulDocsSize)
      }

      res.status(201).json({
        success: true,
        message: `Bulk create completed: ${result.success} succeeded, ${result.failed + validationErrors.length} failed`,
        data: {
          success: result.success,
          failed: result.failed + validationErrors.length,
          documents: result.documents.map((doc: any) => ({
            $id: doc.id,
            $collection_id: collectionId,
            $database_id: databaseId,
            $created_at: doc.created_at,
            $updated_at: doc.updated_at,
            $version: doc.version,
            $permissions: doc.permission_rules || collection.permission_rules || {},
            ...doc.data,
          })),
          errors: [...validationErrors, ...result.errors],
        },
      })
    } catch (error) {
      next(error)
    }
  }

  bulkUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId } = req.params
      const { updates } = req.body

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Request body must contain an 'updates' array with at least one update",
          {
            hint: "Send an array of objects with 'id' and 'data' fields",
          },
        )
      }

      if (updates.length > 100) {
        throw new AppError(400, "BATCH_LIMIT_EXCEEDED", "Cannot update more than 100 documents at once", {
          limit: 100,
          received: updates.length,
        })
      }

      // Check transaction limit for bulk update
      const transactionId = req.headers['x-transaction-id'] as string | undefined
      if (transactionId) {
        const txData = TransactionController.getTransactionClient(
          transactionId,
          req.identity!.project_id,
          databaseId
        )

        if (!txData) {
          throw new AppError(400, "INVALID_TRANSACTION", "Transaction not found or expired")
        }

        const currentCount = txData.transaction.operation_count
        const newCount = currentCount + updates.length

        if (newCount > 1000) {
          throw new AppError(400, "TRANSACTION_LIMIT_EXCEEDED",
            `Bulk operation would exceed transaction limit (${newCount}/1000)`, {
              currentOperations: currentCount,
              bulkOperations: updates.length,
              limit: 1000,
            })
        }
      }

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          {
            collectionId,
            databaseId,
          },
        )
      }

      const validatedUpdates: any[] = []
      const validationErrors: any[] = []

      for (const update of updates) {
        if (!update.id || !update.data) {
          validationErrors.push({
            id: update.id || "unknown",
            error: "Each update must have 'id' and 'data' fields",
          })
          continue
        }

        try {
          InputValidator.validateDocumentData(update.data)

          if (collection.schema_id) {
            const schemaResult = await pool.query("SELECT definition FROM collection_schemas WHERE id = $1", [
              collection.schema_id,
            ])
if (schemaResult.rows.length > 0) {
  const schema = schemaResult.rows[0].definition
  await this.validator.validateAgainstSchema(
    update.data, 
    schema,
    req.identity!.project_id,    // ✅ ADD THIS
    collectionId                  // ✅ ADD THIS
  )
  await this.validator.validateUniqueConstraints(collectionId, update.data, schema, update.id)
}
          }

          validatedUpdates.push({
            id: update.id,
            collectionId,
            data: update.data,
          })
        } catch (error: any) {
          validationErrors.push({
            id: update.id,
            error: error.message,
          })
        }
      }

      // Get transaction client
      const txClient = this.getTransactionClient(req)

      const result = await this.repository.bulkUpdate(
        validatedUpdates, 
        req.identity!.project_id,
        txClient,
      )

      // Increment by number of successful updates
      this.incrementTransactionCount(req, result.success)

      res.json({
        success: true,
        message: `Bulk update completed: ${result.success} succeeded, ${result.failed + validationErrors.length} failed`,
        data: {
          success: result.success,
          failed: result.failed + validationErrors.length,
          updated: result.updated.map((doc: any) => ({
            $id: doc.id,
            $collection_id: collectionId,
            $database_id: databaseId,
            $created_at: doc.created_at,
            $updated_at: doc.updated_at,
            $version: doc.version,
            $permissions: doc.permission_rules || collection.permission_rules || {},
            ...doc.data,
          })),
          errors: [...validationErrors, ...result.errors],
        },
      })
    } catch (error) {
      next(error)
    }
  }

  bulkDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId } = req.params
      const { ids } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Request body must contain an 'ids' array with at least one document ID",
          {
            hint: "Send an array of document IDs to delete",
          },
        )
      }

      if (ids.length > 100) {
        throw new AppError(400, "BATCH_LIMIT_EXCEEDED", "Cannot delete more than 100 documents at once", {
          limit: 100,
          received: ids.length,
        })
      }

      // Check transaction limit for bulk delete
      const transactionId = req.headers['x-transaction-id'] as string | undefined
      if (transactionId) {
        const txData = TransactionController.getTransactionClient(
          transactionId,
          req.identity!.project_id,
          databaseId
        )

        if (!txData) {
          throw new AppError(400, "INVALID_TRANSACTION", "Transaction not found or expired")
        }

        const currentCount = txData.transaction.operation_count
        const newCount = currentCount + ids.length

        if (newCount > 1000) {
          throw new AppError(400, "TRANSACTION_LIMIT_EXCEEDED",
            `Bulk operation would exceed transaction limit (${newCount}/1000)`, {
              currentOperations: currentCount,
              bulkOperations: ids.length,
              limit: 1000,
            })
        }
      }

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          {
            collectionId,
            databaseId,
          },
        )
      }

      const deleteList = ids.map((id: string) => ({
        id,
        collectionId,
      }))

      // Get transaction client
      const txClient = this.getTransactionClient(req)

      const result = await this.repository.bulkDelete(
        deleteList, 
        req.identity!.project_id,
        txClient,
      )

      // Increment by number of successful deletes
      this.incrementTransactionCount(req, result.success)

      res.json({
        success: true,
        message: `Bulk delete completed: ${result.success} succeeded, ${result.failed} failed`,
        data: {
          success: result.success,
          failed: result.failed,
          deleted: result.deleted,
          errors: result.errors,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  patch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId } = req.params
      const patchOps = req.body

      this.patchOperator.validatePatch(patchOps)

      const collection = await this.collectionRepository.findById(collectionId, req.identity!.project_id)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const existingDoc = await this.repository.findById(documentId, collectionId, req.identity!.project_id)
      if (!existingDoc) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      const ifMatch = req.headers["if-match"] as string | undefined
      if (!validateIfMatch(existingDoc.version, existingDoc.updated_at, ifMatch)) {
        throw new AppError(
          412,
          "PRECONDITION_FAILED",
          "Document has been modified by another request. Please fetch the latest version and try again.",
          {
            hint: "Include the current ETag in the If-Match header to prevent conflicts",
            currentVersion: existingDoc.version,
          },
        )
      }

      const patchedData = this.patchOperator.applyPatch(existingDoc.data, patchOps)

      // Check storage quota for the size difference
      const oldSize = JSON.stringify(existingDoc.data).length
      const newSize = JSON.stringify(patchedData).length
      const sizeDiff = newSize - oldSize
      if (sizeDiff > 0) {
        await this.quotaManager.checkStorageQuota(databaseId, sizeDiff)
      }

if (collection.schema_id) {
  await this.validator.validate(
    patchedData, 
    collection.schema_id,
    req.identity!.project_id,    // ✅ ADD THIS
    collectionId                  // ✅ ADD THIS
  )
}

      // Get transaction client
      const txClient = this.getTransactionClient(req)

      const document = await this.repository.patch(
        documentId, 
        collectionId, 
        patchedData, 
        req.identity!.project_id,
        txClient,
      )

      // Increment transaction counter
      this.incrementTransactionCount(req)

      // Update storage usage with the size difference
      if (sizeDiff !== 0) {
        await this.quotaManager.updateStorageUsage(databaseId, sizeDiff)
      }

      const effectivePermissions = document.permission_rules || collection.permission_rules || {}

      const responseData = {
        $id: document.id,
        $collection_id: collectionId,
        $database_id: databaseId,
        $created_at: document.created_at,
        $updated_at: document.updated_at,
        $version: document.version,
        $permissions: effectivePermissions,
        ...document.data,
      }

      const fields = req.query.fields as string | undefined
      const projectedData = this.fieldProjector.project(responseData, fields)

      const etag = this.etagGenerator.generate(document.version, document.updated_at)
      res.setHeader("ETag", etag)

      res.json({
        success: true,
        message: "Document patched successfully",
        data: projectedData,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Sync two-way relationships when a document is created or updated.
   * When doc A links to doc B via a two-way relationship, B's reverse field should include A.
   */
  private async syncTwoWayRelationships(
    collectionId: string,
    documentId: string,
    newData: Record<string, unknown>,
    oldData: Record<string, unknown> | null,
    projectId: string
  ): Promise<void> {
    try {
      // Get collection schema to find two-way relationship fields
      const schemaResult = await pool.query(
        `SELECT cs.definition FROM collection_schemas cs
         JOIN collections c ON c.schema_id = cs.id
         WHERE c.id = $1 AND cs.is_active = true`,
        [collectionId]
      )

      if (schemaResult.rows.length === 0) return

      const schema = schemaResult.rows[0].definition
      const fields = schema.fields || []

      for (const field of fields) {
        if (field.type !== "relationship") continue
        if (!field.relationship?.twoWay || !field.relationship?.twoWayKey) continue

        const fieldName = field.name
        const twoWayKey = field.relationship.twoWayKey
        const targetCollectionId = field.relationship.relatedCollection
        const relType = field.relationship.type // oneToOne, oneToMany, manyToOne, manyToMany

        const newValue = newData[fieldName]
        const oldValue = oldData?.[fieldName]

        // Normalize to arrays for easier processing
        const newIds = this.normalizeToArray(newValue)
        const oldIds = this.normalizeToArray(oldValue)

        // Find added and removed links
        const addedIds = newIds.filter(id => !oldIds.includes(id))
        const removedIds = oldIds.filter(id => !newIds.includes(id))

        // Update added documents (add this document's ID to their reverse field)
        for (const targetDocId of addedIds) {
          await this.addToReverseField(targetCollectionId, targetDocId, twoWayKey, documentId, relType, projectId)
        }

        // Update removed documents (remove this document's ID from their reverse field)
        for (const targetDocId of removedIds) {
          await this.removeFromReverseField(targetCollectionId, targetDocId, twoWayKey, documentId, relType, projectId)
        }
      }
    } catch (error) {
      // Log but don't fail the main operation
      console.error("[TwoWaySync] Error syncing relationships:", error)
    }
  }

  /**
   * Add a document ID to another document's reverse relationship field
   */
  private async addToReverseField(
    collectionId: string,
    documentId: string,
    fieldName: string,
    valueToAdd: string,
    relType: string,
    projectId: string
  ): Promise<void> {
    try {
      // Get current document data
      const docResult = await pool.query(
        `SELECT data FROM documents WHERE id = $1 AND collection_id = $2`,
        [documentId, collectionId]
      )

      if (docResult.rows.length === 0) return

      const currentData = docResult.rows[0].data || {}
      let newValue: unknown

      // Determine if reverse field should be an array based on SOURCE relationship type:
      // - manyToOne source → oneToMany reverse → array (one user has MANY posts)
      // - oneToOne source → oneToOne reverse → single value
      // - oneToMany source → manyToOne reverse → single value
      // - manyToMany source → manyToMany reverse → array
      const isArrayField = relType === "manyToOne" || relType === "manyToMany"

      if (isArrayField) {
        const currentArray = Array.isArray(currentData[fieldName]) ? currentData[fieldName] : []
        if (!currentArray.includes(valueToAdd)) {
          newValue = [...currentArray, valueToAdd]
        } else {
          return // Already exists
        }
      } else {
        newValue = valueToAdd
      }

      // Update document
      await pool.query(
        `UPDATE documents 
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), $1, $2::jsonb), 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND collection_id = $4`,
        [`{${fieldName}}`, JSON.stringify(newValue), documentId, collectionId]
      )
    } catch (error) {
      console.error("[TwoWaySync] Error adding to reverse field:", error)
    }
  }

  /**
   * Remove a document ID from another document's reverse relationship field
   */
  private async removeFromReverseField(
    collectionId: string,
    documentId: string,
    fieldName: string,
    valueToRemove: string,
    relType: string,
    projectId: string
  ): Promise<void> {
    try {
      const docResult = await pool.query(
        `SELECT data FROM documents WHERE id = $1 AND collection_id = $2`,
        [documentId, collectionId]
      )

      if (docResult.rows.length === 0) return

      const currentData = docResult.rows[0].data || {}
      // Same logic as addToReverseField - reverse of manyToOne or manyToMany needs array
      const isArrayField = relType === "manyToOne" || relType === "manyToMany"

      let newValue: unknown

      if (isArrayField) {
        const currentArray = Array.isArray(currentData[fieldName]) ? currentData[fieldName] : []
        newValue = currentArray.filter((id: string) => id !== valueToRemove)
      } else {
        // For single-value fields, set to null if it matches
        if (currentData[fieldName] === valueToRemove) {
          newValue = null
        } else {
          return // Not our value
        }
      }

      await pool.query(
        `UPDATE documents 
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), $1, $2::jsonb), 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND collection_id = $4`,
        [`{${fieldName}}`, JSON.stringify(newValue), documentId, collectionId]
      )
    } catch (error) {
      console.error("[TwoWaySync] Error removing from reverse field:", error)
    }
  }

  /**
   * Normalize relationship value to array
   */
  private normalizeToArray(value: unknown): string[] {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(v => typeof v === "string") as string[]
    if (typeof value === "string") return [value]
    return []
  }
}
