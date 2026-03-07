import { DocumentRepository } from "../documents/DocumentRepository"
import type { DocumentVersion } from "../../types/document"

export class VersionManager {
  private repository = new DocumentRepository()

  async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    return await this.repository.getVersions(documentId)
  }

  async getVersionByNumber(documentId: string, version: number): Promise<DocumentVersion | null> {
    const versions = await this.repository.getVersions(documentId)
    return versions.find((v) => v.version === version) || null
  }

  async compareVersions(
    documentId: string,
    version1: number,
    version2: number,
  ): Promise<{
    version1: DocumentVersion | null
    version2: DocumentVersion | null
    changes: string[]
    added: { path: string; value: any }[]
    removed: { path: string; value: any }[]
    modified: { path: string; oldValue: any; newValue: any }[]
  }> {
    const versions = await this.repository.getVersions(documentId)

    const v1 = versions.find((v) => v.version === version1) || null
    const v2 = versions.find((v) => v.version === version2) || null

    const changes: string[] = []
    const added: { path: string; value: any }[] = []
    const removed: { path: string; value: any }[] = []
    const modified: { path: string; oldValue: any; newValue: any }[] = []

    if (v1 && v2) {
      const keys1 = new Set(Object.keys(v1.data))
      const keys2 = new Set(Object.keys(v2.data))

      // Added keys (in v2 but not in v1)
      for (const key of keys2) {
        if (!keys1.has(key)) {
          changes.push(`Added field: ${key}`)
          added.push({ path: key, value: v2.data[key] })
        }
      }

      // Removed keys (in v1 but not in v2)
      for (const key of keys1) {
        if (!keys2.has(key)) {
          changes.push(`Removed field: ${key}`)
          removed.push({ path: key, value: v1.data[key] })
        }
      }

      // Changed values
      for (const key of keys1) {
        if (keys2.has(key) && JSON.stringify(v1.data[key]) !== JSON.stringify(v2.data[key])) {
          changes.push(`Modified field: ${key}`)
          modified.push({ path: key, oldValue: v1.data[key], newValue: v2.data[key] })
        }
      }
    }

    return { version1: v1, version2: v2, changes, added, removed, modified }
  }

  async restoreVersion(documentId: string, collectionId: string, version: number): Promise<any> {
    // Get the version to restore
    const versionData = await this.getVersionByNumber(documentId, version)

    if (!versionData) {
      throw new Error(`Version ${version} not found`)
    }

    // Update the document with the version data
    const updatedDocument = await this.repository.update(documentId, collectionId, versionData.data)

    return updatedDocument
  }
}
