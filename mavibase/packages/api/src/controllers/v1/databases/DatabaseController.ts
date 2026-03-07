import type { Request, Response, NextFunction } from "express"
import { DatabaseRepository } from "@mavibase/database/engine/databases/DatabaseRepository"
import { CollectionRepository } from "@mavibase/database/engine/collections/CollectionRepository"
import { DocumentRepository } from "@mavibase/database/engine/documents/DocumentRepository"
import { QuotaManager } from "@mavibase/database/storage/QuotaManager"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { InputValidator } from "@mavibase/api/middleware/input-validator"
import { generateId, generateKey } from "@mavibase/database/utils/id-generator"

export class DatabaseController {
  private repository = new DatabaseRepository()
  private collectionRepository = new CollectionRepository()
  private documentRepository = new DocumentRepository()
  private quotaManager = new QuotaManager()

  /**
   * Check if identity has the required role permission string.
   * Service accounts, team owners/admins, and un-roled users bypass.
   * Only users with custom project roles assigned are gated.
   */
  private hasRolePermission(identity: any, requiredPermission: string): boolean {
    if (identity.type === "service" || identity.type === "api_key") return true
    const teamRole = identity.roles?.find((r: string) => r === "owner" || r === "admin")
    if (teamRole) return true
    if (!identity.project_roles || identity.project_roles.length === 0) return true
    if (!identity.permissions || identity.permissions.length === 0) return false
    return identity.permissions.includes(requiredPermission)
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.hasRolePermission(req.identity!, "databases.create")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to create databases")
      }

      const { id, name, description } = req.body

      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity", {
          hint: "This should not happen - contact support",
        })
      }

      InputValidator.validateDatabaseName(name)

      const databaseId = id || generateId()

      if (id && !/^[a-zA-Z0-9-_]+$/.test(id)) {
        throw new AppError(
          400,
          "INVALID_ID_FORMAT",
          "Database ID must contain only letters, numbers, hyphens, and underscores",
          { providedId: id, hint: "Leave 'id' empty to auto-generate a valid ID" },
        )
      }

      const database = await this.repository.create(
        {
          id: databaseId,
          name,
          key: generateKey(), // Deprecated but keeping for backwards compatibility
          description,
          project_id,
          created_at: new Date(),
          updated_at: new Date(),
        },
        project_id,
        req.identity!.team_id,
      )

      res.status(201).json({
        success: true,
        message: `Database "${name}" created successfully`,
        data: database,
      })
    } catch (error) {
      next(error)
    }
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.hasRolePermission(req.identity!, "databases.read")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to list databases")
      }

      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      InputValidator.validatePagination(req.query.limit as string, req.query.offset as string)

      const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 100)
      const offset = Number.parseInt(req.query.offset as string) || 0

      const databases = await this.repository.findAll(project_id)
      const paginatedResults = databases.slice(offset, offset + limit)

      res.json({
        success: true,
        message: `Retrieved ${paginatedResults.length} database(s)`,
        data: paginatedResults,
        pagination: {
          total: databases.length,
          limit,
          offset,
          hasMore: offset + limit < databases.length,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.hasRolePermission(req.identity!, "databases.read")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to read databases")
      }

      const { databaseId } = req.params
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, {
          databaseId,
          hint: "Check that the database ID is correct and belongs to your project",
        })
      }

      const quotas = await this.quotaManager.getQuotaUsage(databaseId)

      res.json({
        success: true,
        message: "Database retrieved successfully",
        data: {
          ...database,
          quotas: {
            collections: {
              current: quotas.current_collections,
              limit: quotas.max_collections,
              remaining: quotas.max_collections - quotas.current_collections,
            },
            documents: {
              current: quotas.current_documents,
              limit: quotas.max_documents_per_collection * 100,
              remaining: quotas.max_documents_per_collection * 100 - quotas.current_documents,
            },
            storage: {
              current: quotas.current_storage_bytes,
              limit: quotas.max_storage_bytes,
              remaining: quotas.max_storage_bytes - quotas.current_storage_bytes,
            },
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  getFull = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const { stream } = req.query
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, {
          databaseId,
          hint: "Check that the database ID is correct",
        })
      }

      if (stream === "true") {
        return this.streamFullExport(req, res, next, database)
      }

      // Get all collections for this database
      const collections = await this.collectionRepository.findByDatabaseId(databaseId)

      // Enforce export size limit for non-streaming exports
      const MAX_EXPORT_COLLECTIONS = 50
      if (collections.length > MAX_EXPORT_COLLECTIONS) {
        throw new AppError(
          400,
          "EXPORT_TOO_LARGE",
          `Database has ${collections.length} collections. Use streaming export (?stream=true) for large databases`,
          {
            collectionCount: collections.length,
            limit: MAX_EXPORT_COLLECTIONS,
            hint: "Add ?stream=true to the URL to use streaming export",
          },
        )
      }

      // Get all documents for each collection
      const collectionsWithDocuments = await Promise.all(
        collections.map(async (collection) => {
          const documents = await this.documentRepository.findByCollectionId(collection.id)

          // Limit documents per collection for safety
          if (documents.length > 10000) {
            throw new AppError(
              400,
              "EXPORT_TOO_LARGE",
              `Collection "${collection.name}" has ${documents.length} documents. Use streaming export (?stream=true)`,
              {
                collectionName: collection.name,
                documentCount: documents.length,
                hint: "Add ?stream=true to the URL to use streaming export",
              },
            )
          }

          return {
            ...collection,
            documents: documents.map((doc) => ({
              $id: doc.id,
              $created_at: doc.created_at,
              $updated_at: doc.updated_at,
              $version: doc.version,
              ...doc.data,
            })),
            documentCount: documents.length,
          }
        }),
      )

      const totalDocuments = collectionsWithDocuments.reduce((sum, col) => sum + col.documentCount, 0)

      res.json({
        success: true,
        message: `Exported complete database structure with ${collections.length} collection(s) and ${totalDocuments} document(s)`,
        data: {
          ...database,
          collections: collectionsWithDocuments,
          collectionCount: collections.length,
          totalDocuments,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  private streamFullExport = async (req: Request, res: Response, next: NextFunction, database: any) => {
    try {
      const { databaseId } = req.params

      // Set headers for streaming JSON
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Transfer-Encoding", "chunked")

      // Start JSON response
      res.write('{"success":true,"message":"Streaming database export","data":{')
      res.write(`"id":"${database.id}",`)
      res.write(`"name":"${database.name}",`)
      res.write(`"description":${database.description ? `"${database.description}"` : "null"},`)
      res.write(`"created_at":"${database.created_at}",`)
      res.write(`"updated_at":"${database.updated_at}",`)
      res.write('"collections":[')

      const collections = await this.collectionRepository.findByDatabaseId(databaseId)

      let collectionIndex = 0
      let totalDocuments = 0

      for (const collection of collections) {
        if (collectionIndex > 0) {
          res.write(",")
        }

        // Write collection metadata
        res.write("{")
        res.write(`"id":"${collection.id}",`)
        res.write(`"name":"${collection.name}",`)
        res.write(`"key":"${collection.key}",`)
        res.write(`"description":${collection.description ? `"${collection.description}"` : "null"},`)
        res.write(`"created_at":"${collection.created_at}",`)
        res.write('"documents":[')

        // Stream documents in chunks
        const CHUNK_SIZE = 100
        let offset = 0
        let hasMore = true
        let docIndex = 0

        while (hasMore) {
          const documents = await this.documentRepository.findByCollectionIdPaginated(collection.id, CHUNK_SIZE, offset)

          for (const doc of documents) {
            if (docIndex > 0) {
              res.write(",")
            }

            res.write(
              JSON.stringify({
                $id: doc.id,
                $created_at: doc.created_at,
                $updated_at: doc.updated_at,
                $version: doc.version,
                ...doc.data,
              }),
            )

            docIndex++
            totalDocuments++
          }

          offset += CHUNK_SIZE
          hasMore = documents.length === CHUNK_SIZE

          // Allow Node.js to process other requests
          await new Promise((resolve) => setImmediate(resolve))
        }

        res.write(`],"documentCount":${docIndex}`)
        res.write("}")

        collectionIndex++
      }

      res.write("]")
      res.write(`,"collectionCount":${collections.length}`)
      res.write(`,"totalDocuments":${totalDocuments}`)
      res.write("}}")
      res.end()
    } catch (error) {
      next(error)
    }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.hasRolePermission(req.identity!, "databases.update")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to update databases")
      }

      const { databaseId } = req.params
      const { name, description } = req.body
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      if (!name && description === undefined) {
        throw new AppError(400, "NO_UPDATE_FIELDS", "At least one field (name or description) must be provided", {
          hint: "Include 'name' or 'description' in the request body",
        })
      }

      if (name) {
        InputValidator.validateDatabaseName(name)
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, {
          databaseId,
          hint: "Verify the database ID is correct",
        })
      }

      const updated = await this.repository.update(
        databaseId,
        {
          name: name || database.name,
          description: description !== undefined ? description : database.description,
          updated_at: new Date(),
        },
        project_id,
      )

      res.json({
        success: true,
        message: `Database "${updated.name}" updated successfully`,
        data: updated,
      })
    } catch (error) {
      next(error)
    }
  }

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.hasRolePermission(req.identity!, "databases.delete")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to delete databases")
      }

      const { databaseId } = req.params
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, {
          databaseId,
          hint: "The database may have already been deleted",
        })
      }

      await this.repository.delete(databaseId, project_id)

      res.json({
        success: true,
        message: `Database "${database.name}" (ID: ${databaseId}) deleted successfully`,
        data: {
          deletedId: databaseId,
          deletedName: database.name,
        },
        warning: "All collections and documents in this database have been permanently deleted",
      })
    } catch (error) {
      next(error)
    }
  }

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`)
      }

      const collections = await this.collectionRepository.findByDatabaseId(databaseId)
      
      // Get accurate size breakdown from size tracking columns
      const sizeBreakdown = await this.quotaManager.getSizeBreakdown(databaseId)
      const quotas = await this.quotaManager.getQuotaUsage(databaseId)

      // Get document count per collection
      const collectionStats = await Promise.all(
        collections.map(async (col) => {
          const count = await this.documentRepository.countByCollectionId(col.id)
          return {
            id: col.id,
            name: col.name,
            documentCount: count,
          }
        }),
      )

      res.json({
        success: true,
        data: {
          databaseId,
          databaseName: database.name,
          collectionCount: collections.length,
          totalDocuments: quotas.current_documents,
          storageBytes: sizeBreakdown.total,
          collections: collectionStats,
          sizeBreakdown: {
            documents: sizeBreakdown.documents,
            collections: sizeBreakdown.collections,
            indexes: sizeBreakdown.indexes,
            schemas: sizeBreakdown.schemas,
            relationships: sizeBreakdown.relationships,
            versions: sizeBreakdown.versions,
            total: sizeBreakdown.total,
            last_calculated_at: sizeBreakdown.last_calculated_at,
          },
          quotas: {
            collections: {
              used: quotas.current_collections,
              limit: quotas.max_collections,
            },
            documents: {
              used: quotas.current_documents,
              limit: quotas.max_documents_per_collection * quotas.max_collections,
            },
            storage: {
              used: sizeBreakdown.total,
              limit: quotas.max_storage_bytes,
            },
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  getSchema = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params
      const project_id = req.identity!.project_id

      if (!project_id) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.repository.findById(databaseId, project_id)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`)
      }

      const collections = await this.collectionRepository.findByDatabaseId(databaseId)

      const schema = {
        database: {
          id: database.id,
          name: database.name,
        },
        collections: collections.map((col) => ({
          id: col.id,
          name: col.name,
          key: col.key,
          visibility: col.visibility,
          schema: col.schema_id ? true : false,
        })),
      }

      res.json({
        success: true,
        data: schema,
      })
    } catch (error) {
      next(error)
    }
  }
}
