import type { Request, Response, NextFunction } from "express"
import { CollectionRepository } from "@mavibase/database/engine/collections/CollectionRepository"
import { DatabaseRepository } from "@mavibase/database/engine/databases/DatabaseRepository"
import { IndexRepository } from "@mavibase/database/engine/indexes/IndexRepository"
import { QuotaManager } from "@mavibase/database/storage/QuotaManager"
import { AuthorizationPolicy } from "@mavibase/database/security/authorization/AuthorizationPolicy"
import { PermissionRuleEvaluator } from "@mavibase/database/security/authorization/PermissionRuleEvaluator"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { InputValidator } from "@mavibase/api/middleware/input-validator"
import { generateId, generateKey } from "@mavibase/database/utils/id-generator"
import { RelationshipManager } from "@mavibase/database/engine/relationships/RelationshipManager"
import { pool } from "@mavibase/database/config/database"

export class CollectionController {
  private repository: CollectionRepository
  private databaseRepository: DatabaseRepository
  private quotaManager: QuotaManager
  private policy: AuthorizationPolicy

  constructor() {
    this.repository = new CollectionRepository()
    this.databaseRepository = new DatabaseRepository()
    this.quotaManager = new QuotaManager()
    this.policy = new AuthorizationPolicy()
  }

  /**
   * Check if identity has the required role permission string.
   * Service accounts, team owners/admins, and un-roled users bypass.
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
      if (!this.hasRolePermission(req.identity!, "collections.create")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to create collections")
      }

      const { databaseId } = req.params
      const { name, description, schema, visibility, permission_rules } = req.body

      InputValidator.validateCollectionName(name)

      if (schema) {
        InputValidator.validateSchema(schema)
      }

      if (permission_rules) {
        const evaluator = new PermissionRuleEvaluator()
        const validation = evaluator.validateRules(permission_rules)
        if (!validation.valid) {
          throw new AppError(400, "INVALID_PERMISSION_RULES", validation.error || "Invalid permission rules")
        }
      }

      const projectId = req.identity!.project_id
      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.databaseRepository.findById(databaseId, projectId)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, { databaseId })
      }

      await this.quotaManager.checkCollectionQuota(databaseId)

      // Check storage quota for the collection (estimate size)
      const collectionSize = JSON.stringify({ name, description, schema, permission_rules }).length
      await this.quotaManager.checkStorageQuota(databaseId, collectionSize)

      const effectiveVisibility = visibility || this.policy.getDefaultCollectionVisibility(req.identity!)
      const createdBy = this.policy.getCreatorId(req.identity!)

      const collection = await this.repository.create(
        {
          id: generateId(),
          database_id: databaseId,
          name,
          key: generateKey(),
          description: description ?? null,
          created_by: createdBy,
          visibility: effectiveVisibility,
          permission_rules: permission_rules || null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        schema,
        projectId,
      )

      await this.quotaManager.incrementCollectionCount(databaseId)

      res.status(201).json({
        success: true,
        message: `Collection "${name}" created successfully`,
        data: collection,
      })
    } catch (error) {
      next(error)
    }
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId } = req.params

      const projectId = req.identity!.project_id
      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const database = await this.databaseRepository.findById(databaseId, projectId)
      if (!database) {
        throw new AppError(404, "DATABASE_NOT_FOUND", `Database with ID "${databaseId}" not found`, { databaseId })
      }

      const collections = await this.repository.findByDatabaseId(databaseId, projectId)

      const accessibleCollections = collections.filter((collection) =>
        this.policy.canReadCollection(req.identity!, collection),
      )

      res.status(200).json({
        success: true,
        message: `Retrieved ${accessibleCollections.length} collection(s)`,
        data: accessibleCollections,
      })
    } catch (error) {
      next(error)
    }
  }

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found or access denied`,
          {
            collectionId,
          },
        )
      }

      this.policy.enforceCollectionRead(req.identity!, collection)

      res.status(200).json({
        success: true,
        message: "Collection retrieved successfully",
        data: collection,
      })
    } catch (error) {
      next(error)
    }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params
      const { name, description, schema, permission_rules, visibility } = req.body

      if (!name && !description && !schema && permission_rules === undefined && !visibility) {
        throw new AppError(
          400,
          "NO_UPDATE_FIELDS",
          "At least one field (name, description, schema, permission_rules, or visibility) must be provided for update",
        )
      }

      if (name) {
        InputValidator.validateCollectionName(name)
      }

      if (schema) {
        InputValidator.validateSchema(schema)
      }

      if (permission_rules) {
        const evaluator = new PermissionRuleEvaluator()
        const validation = evaluator.validateRules(permission_rules)
        if (!validation.valid) {
          throw new AppError(400, "INVALID_PERMISSION_RULES", validation.error || "Invalid permission rules")
        }
      }

      const validVisibilities = ["public", "private", "internal", "team"]
      if (visibility && !validVisibilities.includes(visibility)) {
        throw new AppError(
          400,
          "INVALID_VISIBILITY",
          `Invalid visibility: ${visibility}. Must be one of: ${validVisibilities.join(", ")}`,
        )
      }

      const projectId = req.identity!.project_id

      const existing = await this.repository.findById(collectionId, projectId)
      if (!existing) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionWrite(req.identity!, existing)

      const updated = await this.repository.update(
        collectionId,
        {
          name,
          description,
          permission_rules: permission_rules !== undefined ? permission_rules : undefined,
          visibility: visibility || undefined,
          updated_at: new Date(),
        },
        schema,
        projectId,
      )

      res.status(200).json({
        success: true,
        message: "Collection updated successfully",
        data: updated,
      })
    } catch (error) {
      next(error)
    }
  }

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params

      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(
          404,
          "COLLECTION_NOT_FOUND",
          `Collection with ID "${collectionId}" not found or access denied`,
          {
            collectionId,
            hint: "Verify the collection ID is correct",
          },
        )
      }

      this.policy.enforceCollectionDelete(req.identity!, collection)

      await this.repository.softDelete(collectionId, projectId)
      await this.quotaManager.decrementCollectionCount(collection.database_id)

      res.json({
        success: true,
        message: `Collection "${collection.name}" (ID: ${collectionId}) deleted successfully`,
        data: {
          deletedId: collectionId,
          deletedName: collection.name,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  getSchema = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params
      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionRead(req.identity!, collection)

      if (!collection.schema_id) {
        return res.json({
          success: true,
          message: "Collection has no schema defined",
          data: null,
        })
      }

      const schema = await this.repository.getSchema(collection.schema_id)

      res.json({
        success: true,
        message: "Schema retrieved successfully",
        data: schema,
      })
    } catch (error) {
      next(error)
    }
  }

getAttributes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.params
    const projectId = req.identity!.project_id

    const collection = await this.repository.findById(collectionId, projectId)
    if (!collection) {
      throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
    }

    this.policy.enforceCollectionRead(req.identity!, collection)

    if (!collection.schema_id) {
      return res.json({
        success: true,
        message: "Collection has no attributes defined",
        data: [],
      })
    }

    const schema = await this.repository.getSchema(collection.schema_id)
    const attributes = schema?.definition?.fields || []

    // Map backend field structure to frontend expected format
    const formattedAttributes = attributes.map((field: any) => {
      const baseAttribute = {
        key: field.name,
        name: field.name,
        type: field.type,
        required: field.required || false,
        array: field.array || false,
        default: field.default,
        indexed: field.indexed || false,
        unique: field.unique || false,
        size: field.size,
        min: field.min,
        max: field.max,
        validation: field.validation || null,
      }

      // ✅ NEW: Include relationship config if it's a relationship type
      if (field.type === "relationship" && field.relationship) {
        return {
          ...baseAttribute,
          relationship: field.relationship  // ✅ Add relationship config
        }
      }

      return baseAttribute
    })

    res.json({
      success: true,
      message: `Retrieved ${formattedAttributes.length} attribute(s)`,
      data: formattedAttributes,
    })
  } catch (error) {
    next(error)
  }
}

createAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.params
    const { 
      key, 
      type, 
      required, 
      array, 
      default: defaultValue, 
      indexed, 
      unique, 
      validation,
      size,
      min,
      max,
      elements,
      // ✅ NEW: Relationship-specific fields
      relatedCollection,
      relationshipType,
      twoWay,
      twoWayKey,
      onDelete
    } = req.body

    console.log("[Relationship] Creating attribute:", { 
      key, type, relatedCollection, relationshipType, twoWay 
    })

    if (!key || !type) {
      throw new AppError(400, "INVALID_INPUT", "Attribute key and type are required")
    }

    // Validate key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      throw new AppError(400, "INVALID_KEY", 
        "Attribute key must start with a letter or underscore and contain only letters, numbers, and underscores")
    }

    // ✅ UPDATED: Add "relationship" to valid types
    const validTypes = [
      "string", "integer", "float", "number", "boolean", 
      "datetime", "email", "url", "ip", "enum", "object", "array",
      "relationship"  // ✅ NEW
    ]
    
    if (!validTypes.includes(type)) {
      throw new AppError(400, "INVALID_TYPE", `Type must be one of: ${validTypes.join(", ")}`)
    }

    const projectId = req.identity!.project_id

    const collection = await this.repository.findById(collectionId, projectId)
    if (!collection) {
      throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
    }

    this.policy.enforceCollectionWrite(req.identity!, collection)

    // Check storage quota before creating attribute (estimate size of attribute definition)
    const attributeSize = JSON.stringify(req.body).length
    await this.quotaManager.checkStorageQuota(collection.database_id, attributeSize)

    // Get current schema
    const schema = collection.schema_id 
      ? await this.repository.getSchema(collection.schema_id) 
      : null
    const currentFields = schema?.definition?.fields || []

    // Check if attribute already exists
    if (currentFields.find((f: any) => f.name === key)) {
      throw new AppError(409, "ATTRIBUTE_EXISTS", `Attribute with key '${key}' already exists`)
    }

    let newAttribute: any

    // ✅ NEW: Handle relationship type
    if (type === "relationship") {
      
      // Validate relationship-specific fields
      if (!relatedCollection) {
        throw new AppError(400, "MISSING_RELATED_COLLECTION", 
          "relatedCollection is required for relationship type")
      }
      
      if (!relationshipType) {
        throw new AppError(400, "MISSING_RELATIONSHIP_TYPE", 
          "relationshipType is required for relationship type")
      }

      const relationshipManager = new RelationshipManager()

      // Build relationship config
      const relationshipConfig = {
        type: relationshipType,
        relatedCollection,
        twoWay: twoWay || false,
        twoWayKey: twoWayKey || undefined,
        onDelete: onDelete || "setNull",
        side: "parent" as const
      }

      // Validate relationship
      await relationshipManager.validateRelationshipAttribute(
        collectionId,
        key,
        relationshipConfig,
        projectId
      )

      // Get target collection ID (relatedCollection can be ID or key)
      // Use CASE to safely handle UUID casting
      const targetCollection = await pool.query(
        `SELECT id FROM collections 
         WHERE (
           (CASE WHEN $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                 THEN id = $1::uuid 
                 ELSE false END)
           OR key = $2
         )
         AND project_id = $3 
         AND deleted_at IS NULL`,
        [relatedCollection, relatedCollection, projectId]
      )

      const targetCollectionId = targetCollection.rows[0].id

      // Create relationship metadata
      await relationshipManager.createRelationshipMetadata(
        collectionId,
        key,
        targetCollectionId,
        relationshipConfig
      )

      // Create two-way attribute if needed
      if (twoWay && twoWayKey) {
        await relationshipManager.createTwoWayAttribute(
          targetCollectionId,
          twoWayKey,
          collectionId,
          relationshipType,
          projectId
        )
      }

      // Create attribute with relationship config
      newAttribute = {
        name: key,
        type: "relationship",
        required: required || false,
        relationship: relationshipConfig
      }

      console.log("[Relationship] Created relationship attribute:", {
        key,
        targetCollection: relatedCollection,
        type: relationshipType,
        twoWay
      })

    } else {
      // ✅ EXISTING: Handle non-relationship attributes
      
      // Validate integer default value
      if (type === "integer" && defaultValue !== undefined) {
        const numDefault = Number(defaultValue)
        if (!Number.isInteger(numDefault)) {
          throw new AppError(400, "INVALID_DEFAULT", "Default value for integer type must be a whole number")
        }
      }

      // Validate enum must have elements
      if (type === "enum") {
        const enumValues = elements || validation?.enum
        if (!enumValues || !Array.isArray(enumValues) || enumValues.length === 0) {
          throw new AppError(400, "MISSING_ENUM_VALUES", "Enum type requires at least one element in 'elements' or 'validation.enum'")
        }
        // Validate default is one of the enum values
        if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
          if (!enumValues.includes(defaultValue)) {
            throw new AppError(400, "INVALID_DEFAULT", `Default value '${defaultValue}' must be one of the enum elements: ${enumValues.join(", ")}`)
          }
        }
      }

      newAttribute = {
        name: key,
        type: type,
        required: required || false,
        array: array || false,
      }

      // Add optional fields
      if (defaultValue !== undefined) newAttribute.default = defaultValue
      if (indexed !== undefined) newAttribute.indexed = indexed
      if (unique !== undefined) newAttribute.unique = unique
      if (size !== undefined) newAttribute.size = Number(size)
      if (min !== undefined) newAttribute.min = Number(min)
      if (max !== undefined) newAttribute.max = Number(max)
      
      // Build validation object
      const mergedValidation: any = { ...validation }
      
      // Handle enum values - support both 'elements' (frontend) and 'validation.enum' (direct)
      if (type === "enum") {
        const enumValues = elements || validation?.enum
        if (enumValues) {
          mergedValidation.enum = enumValues
        }
      }
      
      if (size !== undefined) mergedValidation.size = Number(size)
      if (min !== undefined) mergedValidation.min = Number(min)
      if (max !== undefined) mergedValidation.max = Number(max)
      
      // Handle object properties schema (already in validation from frontend)
      if (type === "object" && validation?.properties) {
        mergedValidation.properties = validation.properties
      }
      
      // Handle array item type (already in validation from frontend)
      if (type === "array" && validation?.arrayItemType) {
        mergedValidation.arrayItemType = validation.arrayItemType
      }
      
      if (Object.keys(mergedValidation).length > 0) {
        newAttribute.validation = mergedValidation
      }

      // Auto-create index if indexed is true
      if (indexed === true) {
        try {
          const indexRepo = new IndexRepository()
          
          const existingIndex = await indexRepo.findByFieldName(collectionId, key)
          if (!existingIndex) {
            const indexId = generateId()
            const indexName = `idx_doc_${collectionId.replace(/-/g, "_")}_${key}`
            
            const indexMetadata = await indexRepo.create({
              id: indexId,
              collection_id: collectionId,
              field_name: key,
              field_names: [key],
              index_type: "btree",
              is_unique: unique || false,
              created_at: new Date(),
            })
            
            indexRepo.createDatabaseIndex(
              collectionId,
              [key],
              indexName,
              "btree",
              unique || false
            ).then(() => {
              console.log(`[SUCCESS] Database index created for attribute: ${key}`)
              indexRepo.updateStatus(indexMetadata.id, "active", null).catch(console.error)
            }).catch((error) => {
              console.error("Failed to create database index:", error)
              indexRepo.updateStatus(indexMetadata.id, "failed", error.message).catch(console.error)
            })
          }
        } catch (indexError) {
          console.error("Failed to auto-create index:", indexError)
        }
      }
    }

    // Add new attribute to schema
    const updatedFields = [...currentFields, newAttribute]
    const updatedSchema = {
      fields: updatedFields,
    }

    await this.repository.update(collectionId, {}, updatedSchema, projectId)

    // Update storage usage for the created attribute
    await this.quotaManager.updateStorageUsage(collection.database_id, attributeSize)

    res.status(201).json({
      success: true,
      message: `Attribute '${key}' created successfully`,
      data: newAttribute,
    })
  } catch (error) {
    next(error)
  }
}

  updateAttribute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId, attributeKey } = req.params
      const { type, required, array, default: defaultValue } = req.body

      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionWrite(req.identity!, collection)

      // Check storage quota for attribute update (estimate size difference)
      const updateSize = JSON.stringify(req.body).length
      await this.quotaManager.checkStorageQuota(collection.database_id, updateSize)

      if (!collection.schema_id) {
        throw new AppError(404, "NO_SCHEMA", "Collection has no schema")
      }

      const schema = await this.repository.getSchema(collection.schema_id)
      const currentFields = schema?.definition?.fields || []

      // Schema uses 'name' not 'key'
      const attributeIndex = currentFields.findIndex((f: any) => f.name === attributeKey)
      if (attributeIndex === -1) {
        throw new AppError(404, "ATTRIBUTE_NOT_FOUND", `Attribute '${attributeKey}' not found`)
      }

      // Type mapping
      const typeMapping: Record<string, string> = {
        string: "string",
        integer: "number",
        float: "number",
        boolean: "boolean",
        datetime: "string",
        email: "string",
        url: "string",
        ip: "string",
        enum: "string",
      }

      // Update attribute
      const updatedAttribute = {
        ...currentFields[attributeIndex],
        ...(type && { type: typeMapping[type] || type }),
        ...(required !== undefined && { required }),
        ...(array !== undefined && { array }),
        ...(defaultValue !== undefined && { default: defaultValue }),
      }

      currentFields[attributeIndex] = updatedAttribute

      // Update schema - fields at top level
      const updatedSchema = {
        fields: currentFields,
      }

      await this.repository.update(collectionId, {}, updatedSchema, projectId)

      res.json({
        success: true,
        message: `Attribute '${attributeKey}' updated successfully`,
        data: updatedAttribute,
      })
    } catch (error) {
      next(error)
    }
  }

deleteAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId, attributeKey } = req.params
    const projectId = req.identity!.project_id

    const collection = await this.repository.findById(collectionId, projectId)
    if (!collection) {
      throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
    }

    this.policy.enforceCollectionWrite(req.identity!, collection)

    if (!collection.schema_id) {
      throw new AppError(404, "NO_SCHEMA", "Collection has no schema")
    }

    const schema = await this.repository.getSchema(collection.schema_id)
    const currentFields = schema?.definition?.fields || []

    const fieldToDelete = currentFields.find((f: any) => f.name === attributeKey)
    
    if (!fieldToDelete) {
      // Check if there's a relationship metadata for this attribute
      const relationshipCheck = await pool.query(
        `SELECT id FROM relationships 
         WHERE (source_collection_id = $1 AND source_attribute = $2)
            OR (target_collection_id = $1 AND target_attribute = $2)`,
        [collectionId, attributeKey]
      )

      if (relationshipCheck.rows.length > 0) {
        // Relationship exists but attribute is gone (already cleaned up)
        const relationshipManager = new RelationshipManager()
        await relationshipManager.deleteRelationship(collectionId, attributeKey)
        
        return res.json({
          success: true,
          message: `Relationship '${attributeKey}' deleted successfully`,
          data: { deletedKey: attributeKey },
        })
      }
      
      // Neither attribute nor relationship found
      throw new AppError(404, "ATTRIBUTE_NOT_FOUND", `Attribute '${attributeKey}' not found`)
    }

    // If it's a relationship, clean up relationship metadata
    if (fieldToDelete.type === "relationship") {
      const relationshipManager = new RelationshipManager()
      await relationshipManager.deleteRelationship(collectionId, attributeKey)
      
      console.log("[Relationship] Deleted relationship metadata for:", attributeKey)
    }

    // Clean up any associated indexes for this attribute (like Supabase/Firebase do)
    try {
      const indexRepository = new IndexRepository()
      const associatedIndex = await indexRepository.findByFieldName(collectionId, attributeKey)
      if (associatedIndex) {
        // Drop the actual database index first
        if (associatedIndex.index_name) {
          await indexRepository.dropDatabaseIndex(associatedIndex.index_name)
        }
        // Then remove the index metadata
        await indexRepository.delete(associatedIndex.id)
        console.log(`[CollectionController] Cleaned up orphaned index for deleted attribute '${attributeKey}'`)
      }
    } catch (indexError) {
      // Log but don't fail the attribute deletion if index cleanup fails
      console.error(`[CollectionController] Failed to clean up index for attribute '${attributeKey}':`, indexError)
    }

    // Remove from schema
    const filteredFields = currentFields.filter((f: any) => f.name !== attributeKey)
    const updatedSchema = {
      fields: filteredFields,
    }

    await this.repository.update(collectionId, {}, updatedSchema, projectId)

    // Reduce storage usage for the deleted attribute
    const deletedSize = JSON.stringify(fieldToDelete).length
    await this.quotaManager.updateStorageUsage(collection.database_id, -deletedSize)

    res.json({
      success: true,
      message: `Attribute '${attributeKey}' deleted successfully`,
      data: { deletedKey: attributeKey },
    })
  } catch (error) {
    next(error)
  }
}

getRelationships = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.params
    const projectId = req.identity!.project_id

    const collection = await this.repository.findById(collectionId, projectId)
    if (!collection) {
      throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
    }

    this.policy.enforceCollectionRead(req.identity!, collection)

    // Get all relationships where this collection is source or target
    const relationships = await pool.query(
      `SELECT 
        r.*,
        sc.name as source_collection_name,
        sc.key as source_collection_key,
        tc.name as target_collection_name,
        tc.key as target_collection_key
       FROM relationships r
       JOIN collections sc ON r.source_collection_id = sc.id
       JOIN collections tc ON r.target_collection_id = tc.id
       WHERE r.source_collection_id = $1 OR r.target_collection_id = $1
       ORDER BY r.created_at DESC`,
      [collectionId]
    )

    const formattedRelationships = relationships.rows.map(rel => ({
      id: rel.id,
      sourceCollection: {
        id: rel.source_collection_id,
        name: rel.source_collection_name,
        key: rel.source_collection_key
      },
      sourceAttribute: rel.source_attribute,
      targetCollection: {
        id: rel.target_collection_id,
        name: rel.target_collection_name,
        key: rel.target_collection_key
      },
      targetAttribute: rel.target_attribute,
      type: rel.type,
      onDelete: rel.on_delete,
      twoWay: rel.two_way,
      side: rel.source_collection_id === collectionId ? "source" : "target",
      createdAt: rel.created_at
    }))

    res.json({
      success: true,
      message: `Retrieved ${formattedRelationships.length} relationship(s)`,
      data: formattedRelationships
    })
  } catch (error) {
    next(error)
  }
}

  getPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params
      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionRead(req.identity!, collection)

      res.json({
        success: true,
        message: "Collection permissions retrieved successfully",
        data: {
          permission_rules: collection.permission_rules || null,
          visibility: collection.visibility,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  updatePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectionId } = req.params
      const { permission_rules } = req.body

      if (permission_rules) {
        const evaluator = new PermissionRuleEvaluator()
        const validation = evaluator.validateRules(permission_rules)
        if (!validation.valid) {
          throw new AppError(400, "INVALID_PERMISSION_RULES", validation.error || "Invalid permission rules")
        }
      }

      const projectId = req.identity!.project_id

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found or access denied")
      }

      this.policy.enforceCollectionWrite(req.identity!, collection)

      const updated = await this.repository.update(
        collectionId,
        {
          permission_rules: permission_rules !== undefined ? permission_rules : undefined,
          updated_at: new Date(),
        },
        undefined,
        projectId,
      )

      res.json({
        success: true,
        message: "Collection permissions updated successfully",
        data: updated,
      })
    } catch (error) {
      next(error)
    }
  }

  getUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { databaseId, collectionId } = req.params
      const projectId = req.identity!.project_id

      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const collection = await this.repository.findById(collectionId, projectId)
      if (!collection) {
        throw new AppError(404, "COLLECTION_NOT_FOUND", `Collection with ID "${collectionId}" not found`)
      }

      // Get document count
      const client = await pool.connect()
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM documents WHERE collection_id = $1 AND deleted_at IS NULL`,
          [collectionId]
        )
        const documentCount = parseInt(countResult.rows[0].count)

        // Get storage bytes (sum of document data size)
        const storageResult = await client.query(
          `SELECT 
            COALESCE(SUM(octet_length(data::text)), 0) as storage_bytes
          FROM documents 
          WHERE collection_id = $1 AND deleted_at IS NULL`,
          [collectionId]
        )
        const storageBytes = parseInt(storageResult.rows[0].storage_bytes || 0)

        // Get index count and index storage
        const indexRepository = new IndexRepository()
        const indexes = await indexRepository.findByCollectionId(collectionId)
        const indexCount = indexes.length

        const indexStorageResult = await client.query(
          `SELECT COALESCE(SUM(pg_relation_size(indexname::regclass)), 0) as index_bytes
           FROM pg_indexes
           WHERE tablename = 'documents'
             AND indexdef LIKE $1`,
          [`%${collectionId}%`]
        )
        const indexStorageBytes = parseInt(indexStorageResult.rows[0]?.index_bytes || 0)

        // Get version count and storage
        const versionResult = await client.query(
          `SELECT 
            COUNT(*) as version_count,
            COALESCE(SUM(octet_length(data::text)), 0) as version_bytes
           FROM document_versions
           WHERE collection_id = $1`,
          [collectionId]
        )
        const versionCount = parseInt(versionResult.rows[0]?.version_count || 0)
        const versionStorageBytes = parseInt(versionResult.rows[0]?.version_bytes || 0)

        // Get attribute count from schema (stored via schema_id in collection_schemas table)
        let attributes = 0
        let schemaStorageBytes = 0
        if (collection.schema_id) {
          const schema = await this.repository.getSchema(collection.schema_id)
          const fields = schema?.definition?.fields
          attributes = Array.isArray(fields) ? fields.length : 0
          schemaStorageBytes = schema ? JSON.stringify(schema).length : 0
        }

        // Avg document size
        const avgDocumentSize = documentCount > 0 ? Math.round(storageBytes / documentCount) : 0
        const totalBytes = storageBytes + indexStorageBytes + versionStorageBytes + schemaStorageBytes

        res.json({
          success: true,
          data: {
            documentCount,
            storageBytes,
            indexCount,
            attributeCount: attributes,
            indexStorageBytes,
            versionCount,
            versionStorageBytes,
            schemaStorageBytes,
            avgDocumentSize,
            totalBytes,
          },
        })
      } finally {
        client.release()
      }
    } catch (error) {
      next(error)
    }
  }
}
