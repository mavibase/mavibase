import { pool } from "@mavibase/database/config/database"
import { AppError } from "@mavibase/core"
import { generateId } from "@mavibase/database/utils/id-generator"
import type { Relationship, RelationshipConfig } from "../../types/relationship"

export type RelationshipType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
export type OnDeleteAction = 'cascade' | 'setNull' | 'restrict';

export interface RelationshipMeta {
  id: string;
  source_collection_id: string;
  source_attribute: string;
  target_collection_id: string;
  target_attribute?: string;
  type: RelationshipType;
  on_delete: OnDeleteAction;
  two_way: boolean;
  created_at: Date;
}

/**
 * Relationship Manager
 * Handles all relationship operations: validation, population, cascade deletes
 */
export class RelationshipManager {
  
  /**
   * Validate relationship attribute creation
   */
  async validateRelationshipAttribute(
    sourceCollectionId: string,
    attributeName: string,
    config: RelationshipConfig,
    projectId: string
  ): Promise<void> {
    
    // 1. Check target collection exists (fixed UUID comparison - case insensitive)
    const targetCollection = await pool.query(
      `SELECT id, key FROM collections 
       WHERE (
         (CASE WHEN $1 ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               THEN id = $1::uuid 
               ELSE false END)
         OR key = $2
       )
       AND project_id = $3 
       AND deleted_at IS NULL`,
      [config.relatedCollection, config.relatedCollection, projectId]
    )

    if (targetCollection.rows.length === 0) {
      throw new AppError(404, "TARGET_COLLECTION_NOT_FOUND",
        `Target collection '${config.relatedCollection}' not found`)
    }

    const targetCollectionId = targetCollection.rows[0].id

    // 2. Validate relationship type
    const validTypes: RelationshipType[] = ["oneToOne", "oneToMany", "manyToOne", "manyToMany"]
    if (!validTypes.includes(config.type)) {
      throw new AppError(400, "INVALID_RELATIONSHIP_TYPE",
        `Relationship type must be one of: ${validTypes.join(", ")}`)
    }

    // 3. Validate onDelete action
    const validActions: OnDeleteAction[] = ["cascade", "setNull", "restrict"]
    if (!validActions.includes(config.onDelete)) {
      throw new AppError(400, "INVALID_ON_DELETE_ACTION",
        `onDelete must be one of: ${validActions.join(", ")}`)
    }

    // 4. If two-way, validate twoWayKey is provided and doesn't conflict
    if (config.twoWay) {
      if (!config.twoWayKey) {
        throw new AppError(400, "MISSING_TWO_WAY_KEY",
          "twoWayKey is required for two-way relationships")
      }

      // Check if twoWayKey already exists in target collection
      const targetSchema = await pool.query(
        `SELECT definition FROM collection_schemas 
         WHERE collection_id = $1 AND is_active = true`,
        [targetCollectionId]
      )

      if (targetSchema.rows.length > 0) {
        const schema = targetSchema.rows[0].definition
        const existingField = schema.fields?.find((f: any) => f.name === config.twoWayKey)
        
        if (existingField) {
          throw new AppError(409, "TWO_WAY_KEY_EXISTS",
            `Field '${config.twoWayKey}' already exists in target collection`)
        }
      }
    }

    // 5. Prevent circular one-to-one relationships
    if (config.type === "oneToOne" && sourceCollectionId === targetCollectionId) {
      throw new AppError(400, "CIRCULAR_ONE_TO_ONE",
        "One-to-one relationships cannot be self-referential")
    }
  }

  /**
   * Create relationship metadata
   */
  async createRelationshipMetadata(
    sourceCollectionId: string,
    sourceAttribute: string,
    targetCollectionId: string,
    config: RelationshipConfig
  ): Promise<RelationshipMeta> {
    
    // generateId is imported at top level
    
    const meta: RelationshipMeta = {
      id: generateId(),
      source_collection_id: sourceCollectionId,
      source_attribute: sourceAttribute,
      target_collection_id: targetCollectionId,
      target_attribute: config.twoWay ? config.twoWayKey : undefined,
      type: config.type,
      on_delete: config.onDelete,
      two_way: config.twoWay,
      created_at: new Date()
    }

    // Store in relationships table
    await pool.query(
      `INSERT INTO relationships 
       (id, source_collection_id, source_attribute, target_collection_id, target_attribute, 
        type, on_delete, two_way, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        meta.id,
        meta.source_collection_id,
        meta.source_attribute,
        meta.target_collection_id,
        meta.target_attribute,
        meta.type,
        meta.on_delete,
        meta.two_way,
        meta.created_at
      ]
    )

    return meta
  }

  /**
   * Create two-way relationship (add reverse attribute to target collection)
   */
  async createTwoWayAttribute(
    targetCollectionId: string,
    twoWayKey: string,
    sourceCollectionId: string,
    relationshipType: RelationshipType,
    projectId: string
  ): Promise<void> {
    
    // Determine reverse relationship type
    const reverseType = this.getReverseRelationshipType(relationshipType)

    // Get target collection schema
    const schemaResult = await pool.query(
      `SELECT id, definition FROM collection_schemas 
       WHERE collection_id = $1 AND is_active = true`,
      [targetCollectionId]
    )

    let schemaId: string
    let currentFields: any[] = []

    if (schemaResult.rows.length > 0) {
      schemaId = schemaResult.rows[0].id
      currentFields = schemaResult.rows[0].definition.fields || []
    } else {
      // Create new schema if doesn't exist
      // generateId is imported at top level
      schemaId = generateId()
    }

    // Add reverse relationship field
    const reverseField = {
      name: twoWayKey,
      type: "relationship",
      relationship: {
        type: reverseType,
        relatedCollection: sourceCollectionId,
        twoWay: false,  // Already handled by forward relationship
        onDelete: "setNull",  // Default for reverse
        side: "child"
      }
    }

    currentFields.push(reverseField)

    // Update or create schema
    if (schemaResult.rows.length > 0) {
      // Update existing schema
      await pool.query(
        `UPDATE collection_schemas 
         SET definition = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [{ fields: currentFields }, schemaId]
      )
    } else {
      // Create new schema
      await pool.query(
        `INSERT INTO collection_schemas 
         (id, collection_id, definition, version, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [schemaId, targetCollectionId, { fields: currentFields }]
      )

      // Link schema to collection
      await pool.query(
        `UPDATE collections SET schema_id = $1 WHERE id = $2`,
        [schemaId, targetCollectionId]
      )
    }
  }

  /**
   * Get reverse relationship type
   */
  private getReverseRelationshipType(type: RelationshipType): RelationshipType {
    switch (type) {
      case "oneToOne": return "oneToOne"
      case "oneToMany": return "manyToOne"
      case "manyToOne": return "oneToMany"
      case "manyToMany": return "manyToMany"
    }
  }

  /**
   * Validate relationship value when creating/updating document
   */
  async validateRelationshipValue(
    value: any,
    field: any,
    collectionId: string,
    projectId: string
  ): Promise<void> {
    
    const config: RelationshipConfig = field.relationship

    // Get target collection (fixed UUID comparison - case insensitive)
    const targetCollection = await pool.query(
      `SELECT id FROM collections 
       WHERE (
         (CASE WHEN $1 ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
               THEN id = $1::uuid 
               ELSE false END)
         OR key = $2
       )
       AND project_id = $3 
       AND deleted_at IS NULL`,
      [config.relatedCollection, config.relatedCollection, projectId]
    )

    if (targetCollection.rows.length === 0) {
      throw new AppError(404, "TARGET_COLLECTION_NOT_FOUND",
        `Target collection '${config.relatedCollection}' not found`)
    }

    const targetCollectionId = targetCollection.rows[0].id

    // Validate based on relationship type
    if (config.type === "oneToOne" || config.type === "manyToOne") {
      // Should be a single document ID (string)
      if (typeof value !== "string") {
        throw new AppError(400, "INVALID_RELATIONSHIP_VALUE",
          `Field '${field.name}' must be a document ID (string)`)
      }

      // Check document exists
      await this.validateDocumentExists(value, targetCollectionId, field.name)

    } else if (config.type === "oneToMany" || config.type === "manyToMany") {
      // Should be an array of document IDs
      if (!Array.isArray(value)) {
        throw new AppError(400, "INVALID_RELATIONSHIP_VALUE",
          `Field '${field.name}' must be an array of document IDs`)
      }

      // Check all documents exist
      for (const docId of value) {
        if (typeof docId !== "string") {
          throw new AppError(400, "INVALID_RELATIONSHIP_VALUE",
            `All items in '${field.name}' must be document IDs (strings)`)
        }
        await this.validateDocumentExists(docId, targetCollectionId, field.name)
      }
    }
  }

  /**
   * Check if document exists
   */
  private async validateDocumentExists(
    documentId: string,
    collectionId: string,
    fieldName: string
  ): Promise<void> {
    
    const doc = await pool.query(
      `SELECT id FROM documents 
       WHERE id = $1 
       AND collection_id = $2 
       AND deleted_at IS NULL`,
      [documentId, collectionId]
    )

    if (doc.rows.length === 0) {
      throw new AppError(404, "REFERENCED_DOCUMENT_NOT_FOUND",
        `Document '${documentId}' referenced by '${fieldName}' not found`)
    }
  }

  /**
   * Populate relationships in document(s)
   */
  async populateRelationships(
    documents: any[],
    collectionId: string,
    populate: string[],  // Array of field names to populate
    projectId: string
  ): Promise<any[]> {
    
    if (!populate || populate.length === 0) {
      return documents
    }

    // Get collection schema
    const schemaResult = await pool.query(
      `SELECT definition FROM collection_schemas 
       WHERE collection_id = $1 AND is_active = true`,
      [collectionId]
    )

    if (schemaResult.rows.length === 0) {
      return documents  // No schema, no relationships
    }

    const schema = schemaResult.rows[0].definition
    const relationshipFields = schema.fields?.filter((f: any) => 
      f.type === "relationship" && populate.includes(f.name)
    ) || []

    if (relationshipFields.length === 0) {
      return documents  // No relationship fields to populate
    }

    // Populate each relationship field
    for (const field of relationshipFields) {
      const config: RelationshipConfig = field.relationship

      // Get target collection ID (fixed UUID comparison - case insensitive)
      const targetCollection = await pool.query(
        `SELECT id FROM collections 
         WHERE (
           (CASE WHEN $1 ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                 THEN id = $1::uuid 
                 ELSE false END)
           OR key = $2
         )
         AND project_id = $3 
         AND deleted_at IS NULL`,
        [config.relatedCollection, config.relatedCollection, projectId]
      )

      if (targetCollection.rows.length === 0) continue

      const targetCollectionId = targetCollection.rows[0].id

      // Populate for each document
      for (const doc of documents) {
        const value = doc[field.name] || doc.data?.[field.name]
        
        if (!value) continue

        if (config.type === "oneToOne" || config.type === "manyToOne") {
          // Fetch single related document
          const related = await this.fetchRelatedDocument(value, targetCollectionId)
          if (related) {
            if (doc.data) {
              doc.data[field.name] = related
            } else {
              doc[field.name] = related
            }
          }
        } else if (config.type === "oneToMany" || config.type === "manyToMany") {
          // Fetch multiple related documents
          const related = await this.fetchRelatedDocuments(value, targetCollectionId)
          if (doc.data) {
            doc.data[field.name] = related
          } else {
            doc[field.name] = related
          }
        }
      }
    }

    return documents
  }

  /**
   * Fetch single related document
   */
  private async fetchRelatedDocument(
    documentId: string,
    collectionId: string
  ): Promise<any | null> {
    
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at, version 
       FROM documents 
       WHERE id = $1 
       AND collection_id = $2 
       AND deleted_at IS NULL`,
      [documentId, collectionId]
    )

    if (result.rows.length === 0) return null

    const doc = result.rows[0]
    return {
      $id: doc.id,
      $createdAt: doc.created_at,
      $updatedAt: doc.updated_at,
      $version: doc.version,
      ...doc.data
    }
  }

  /**
   * Fetch multiple related documents
   */
  private async fetchRelatedDocuments(
    documentIds: string[],
    collectionId: string
  ): Promise<any[]> {
    
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return []
    }

    const result = await pool.query(
      `SELECT id, data, created_at, updated_at, version 
       FROM documents 
       WHERE id = ANY($1) 
       AND collection_id = $2 
       AND deleted_at IS NULL`,
      [documentIds, collectionId]
    )

    return result.rows.map(doc => ({
      $id: doc.id,
      $createdAt: doc.created_at,
      $updatedAt: doc.updated_at,
      $version: doc.version,
      ...doc.data
    }))
  }

  /**
   * Handle cascade operations when document is deleted
   */
  async handleCascadeDelete(
    documentId: string,
    collectionId: string,
    projectId: string
  ): Promise<void> {
    
    // Find all relationships where this collection is the target
    const relationships = await pool.query(
      `SELECT * FROM relationships 
       WHERE target_collection_id = $1`,
      [collectionId]
    )

    for (const rel of relationships.rows) {
      const onDelete: OnDeleteAction = rel.on_delete

      if (onDelete === "restrict") {
        // Check if any documents reference this one
        const references = await pool.query(
          `SELECT id FROM documents 
           WHERE collection_id = $1 
           AND (data->>'${rel.source_attribute}' = $2 
                OR data->'${rel.source_attribute}' @> $3)
           AND deleted_at IS NULL`,
          [
            rel.source_collection_id,
            documentId,
            JSON.stringify([documentId])
          ]
        )

        if (references.rows.length > 0) {
          throw new AppError(409, "REFERENCE_EXISTS",
            `Cannot delete: ${references.rows.length} document(s) reference this document via '${rel.source_attribute}'`,
            {
              referencingDocuments: references.rows.length,
              field: rel.source_attribute
            })
        }

      } else if (onDelete === "cascade") {
        // Delete all documents that reference this one
        await pool.query(
          `UPDATE documents 
           SET deleted_at = CURRENT_TIMESTAMP 
           WHERE collection_id = $1 
           AND (data->>'${rel.source_attribute}' = $2 
                OR data->'${rel.source_attribute}' @> $3)
           AND deleted_at IS NULL`,
          [
            rel.source_collection_id,
            documentId,
            JSON.stringify([documentId])
          ]
        )

      } else if (onDelete === "setNull") {
        // Set relationship field to null
        await pool.query(
          `UPDATE documents 
           SET data = data - '${rel.source_attribute}',
               updated_at = CURRENT_TIMESTAMP,
               version = version + 1
           WHERE collection_id = $1 
           AND (data->>'${rel.source_attribute}' = $2 
                OR data->'${rel.source_attribute}' @> $3)
           AND deleted_at IS NULL`,
          [
            rel.source_collection_id,
            documentId,
            JSON.stringify([documentId])
          ]
        )
      }
    }
  }

  /**
   * Delete relationship metadata and clean up two-way attributes
   */
  async deleteRelationship(
    collectionId: string,
    attributeName: string
  ): Promise<void> {
    
    // Find relationship (check both source and target)
    const relationship = await pool.query(
      `SELECT * FROM relationships 
       WHERE (source_collection_id = $1 AND source_attribute = $2)
          OR (target_collection_id = $1 AND target_attribute = $2)`,
      [collectionId, attributeName]
    )

    if (relationship.rows.length === 0) {
      console.log(`[Relationship] No relationship found for ${collectionId}:${attributeName}`)
      return  // No relationship to delete (might have been cleaned up already)
    }

    const rel = relationship.rows[0]

    // If two-way and we're deleting from source, remove target attribute
    if (rel.two_way && rel.source_collection_id === collectionId && rel.target_attribute) {
      try {
        await this.removeTwoWayAttribute(
          rel.target_collection_id,
          rel.target_attribute
        )
        console.log(`[Relationship] Removed two-way attribute '${rel.target_attribute}' from target collection`)
      } catch (error) {
        console.error(`[Relationship] Failed to remove two-way attribute:`, error)
        // Continue anyway - metadata will still be cleaned up
      }
    }

    // If two-way and we're deleting from target, remove source attribute
    if (rel.two_way && rel.target_collection_id === collectionId && rel.source_attribute) {
      try {
        await this.removeTwoWayAttribute(
          rel.source_collection_id,
          rel.source_attribute
        )
        console.log(`[Relationship] Removed two-way attribute '${rel.source_attribute}' from source collection`)
      } catch (error) {
        console.error(`[Relationship] Failed to remove two-way attribute:`, error)
        // Continue anyway - metadata will still be cleaned up
      }
    }

    // Delete relationship metadata (always do this)
    await pool.query(
      `DELETE FROM relationships WHERE id = $1`,
      [rel.id]
    )
    
    console.log(`[Relationship] Deleted relationship metadata: ${rel.id}`)
  }

  /**
   * Remove two-way attribute from collection (with graceful handling)
   */
  private async removeTwoWayAttribute(
    collectionId: string,
    attributeName: string
  ): Promise<void> {
    
    const schemaResult = await pool.query(
      `SELECT id, definition FROM collection_schemas 
       WHERE collection_id = $1 AND is_active = true`,
      [collectionId]
    )

    if (schemaResult.rows.length === 0) {
      console.log(`[Relationship] No schema found for collection ${collectionId}`)
      return  // No schema, nothing to remove
    }

    const schema = schemaResult.rows[0].definition
    
    // Check if field actually exists
    const fieldExisted = schema.fields?.some((f: any) => f.name === attributeName)
    
    if (!fieldExisted) {
      console.log(`[Relationship] Attribute '${attributeName}' not found in schema (already removed)`)
      return  // Attribute doesn't exist, nothing to remove
    }

    // Remove it
    const fields = schema.fields.filter((f: any) => f.name !== attributeName)

    await pool.query(
      `UPDATE collection_schemas 
       SET definition = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [{ fields }, schemaResult.rows[0].id]
    )
    
    console.log(`[Relationship] Removed attribute '${attributeName}' from collection ${collectionId}`)
  }
}
