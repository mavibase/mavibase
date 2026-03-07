import type { Request, Response, NextFunction } from "express"
import { VersionManager } from "@mavibase/database/engine/versioning/VersionManager"
import { DocumentRepository } from "@mavibase/database/engine/documents/DocumentRepository"
import { CollectionRepository } from "@mavibase/database/engine/collections/CollectionRepository"
import { DatabaseRepository } from "@mavibase/database/engine/databases/DatabaseRepository"
import { AppError } from "@mavibase/api/middleware/error-handler"

export class VersionController {
  private versionManager = new VersionManager()
  private documentRepository = new DocumentRepository()
  private collectionRepository = new CollectionRepository()
  private databaseRepository = new DatabaseRepository()

  listVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.collectionRepository.findById(collectionId, projectId)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const document = await this.documentRepository.findById(documentId, collectionId, projectId)
      if (!document) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      const versions = await this.versionManager.getVersionHistory(documentId)

      res.json({
        success: true,
        message: `Retrieved ${versions.length} version(s) for document ${documentId}`,
        data: versions,
        total: versions.length,
      })
    } catch (error) {
      next(error)
    }
  }

  getVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId, version } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.collectionRepository.findById(collectionId, projectId)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const document = await this.documentRepository.findById(documentId, collectionId, projectId)
      if (!document) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      const versionNumber = Number.parseInt(version)
      if (Number.isNaN(versionNumber)) {
        throw new AppError(400, "INVALID_VERSION", "Version must be a valid number", { providedVersion: version })
      }

      const versionData = await this.versionManager.getVersionByNumber(documentId, versionNumber)

      if (!versionData) {
        throw new AppError(404, "VERSION_NOT_FOUND", `Version ${versionNumber} not found for document ${documentId}`, {
          version: versionNumber,
          documentId,
        })
      }

      res.json({
        success: true,
        message: `Retrieved version ${versionNumber}`,
        data: versionData,
      })
    } catch (error) {
      next(error)
    }
  }

  compareVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId, version1, version2 } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.collectionRepository.findById(collectionId, projectId)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const document = await this.documentRepository.findById(documentId, collectionId, projectId)
      if (!document) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      const v1 = Number.parseInt(version1)
      const v2 = Number.parseInt(version2)

      if (Number.isNaN(v1) || Number.isNaN(v2)) {
        throw new AppError(400, "INVALID_VERSION", "Both versions must be valid numbers", {
          version1,
          version2,
        })
      }

      const comparison = await this.versionManager.compareVersions(documentId, v1, v2)

      res.json({
        success: true,
        message: `Compared version ${v1} with version ${v2}`,
        data: comparison,
      })
    } catch (error) {
      next(error)
    }
  }

  restoreVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId, documentId, version } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.collectionRepository.findById(collectionId, projectId)
      if (!collection || collection.database_id !== databaseId) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found in database "${databaseId}" or access denied`,
          { collectionId, databaseId },
        )
      }

      const document = await this.documentRepository.findById(documentId, collectionId, projectId)
      if (!document) {
        throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document with ID "${documentId}" not found or access denied`, {
          documentId,
          collectionId,
        })
      }

      const versionNumber = Number.parseInt(version)
      if (Number.isNaN(versionNumber)) {
        throw new AppError(400, "INVALID_VERSION", "Version must be a valid number", { providedVersion: version })
      }

      const restoredDocument = await this.versionManager.restoreVersion(documentId, collectionId, versionNumber)

      res.json({
        success: true,
        message: `Document restored to version ${versionNumber} successfully`,
        data: restoredDocument,
      })
    } catch (error) {
      next(error)
    }
  }
}
