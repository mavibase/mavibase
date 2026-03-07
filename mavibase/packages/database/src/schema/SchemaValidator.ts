import { pool } from "@mavibase/database/config/database"
import type { SchemaDefinition, SchemaField } from "../types/collection"
import { AppError } from "@mavibase/core"
import { RelationshipManager } from "../engine/relationships/RelationshipManager"

export class SchemaValidator {
  async validate(
    data: any, 
    schemaId: string, 
    projectId: string, 
    collectionId: string
  ): Promise<void> {
    // Get schema from database
    const result = await pool.query(
      `SELECT definition FROM collection_schemas 
       WHERE id = $1 AND is_active = true`,
      [schemaId],
    )

    if (result.rows.length === 0) {
      throw new AppError(404, "SCHEMA_NOT_FOUND", "Schema not found or is not active", {
        schemaId,
        hint: "The collection schema may have been updated or deleted",
      })
    }

    const schema: SchemaDefinition = result.rows[0].definition

    await this.validateAgainstSchema(data, schema, projectId, collectionId)
  }

  async validateAgainstSchema(
    data: any, 
    schema: SchemaDefinition, 
    projectId: string, 
    collectionId: string
  ): Promise<void> {
    if (!schema.fields || schema.fields.length === 0) {
      return // No validation rules
    }

    const errors: string[] = []
    const fieldDetails: any = {}

    // Check required fields and apply defaults
    for (const field of schema.fields) {
      if (!(field.name in data) && field.default !== undefined) {
        data[field.name] = field.default
      }

      if (field.required && !(field.name in data)) {
        errors.push(`Field '${field.name}' is required but missing`)
        fieldDetails[field.name] = {
          error: "required_field_missing",
          expectedType: field.type,
          required: true,
        }
        continue
      }

      if (!(field.name in data)) {
        continue
      }

      const value = data[field.name]
      
      // Allow null/undefined for optional fields
      if (value === null || value === undefined) {
        if (field.required) {
          errors.push(`Field '${field.name}' is required but has null/undefined value`)
          fieldDetails[field.name] = {
            error: "required_field_null",
            expectedType: field.type,
            required: true,
          }
        }
        continue
      }
      
      // Handle relationship validation
      if (field.type === "relationship") {
        const relationshipManager = new RelationshipManager()
        
        try {
          await relationshipManager.validateRelationshipValue(
            value,
            field,
            collectionId,
            projectId
          )
        } catch (error: any) {
          errors.push(error.message)
          fieldDetails[field.name] = {
            error: "relationship_validation_failed",
            message: error.message,
            relationship: (field as any).relationship
          }
        }
        
        continue  // Skip other validations for relationship fields
      }
      
      // Validate type
      const typeError = this.validateType(value, field.type, field.name)
      if (typeError) {
        errors.push(typeError)
        fieldDetails[field.name] = {
          error: "type_mismatch",
          expectedType: field.type,
          receivedType: this.getActualType(value),
          receivedValue: value,
        }
        continue
      }

      // Validate format (email, url, ip, datetime, enum)
      const formatError = await this.validateFormat(value, field)
      if (formatError) {
        errors.push(formatError)
        fieldDetails[field.name] = {
          error: "format_validation_failed",
          message: formatError,
          expectedFormat: field.type,
        }
        continue
      }

      // Validate object properties if defined
      if (field.type === "object" && field.validation?.properties) {
        const objErrors = this.validateObjectProperties(value, field.validation.properties, field.name)
        if (objErrors.length > 0) {
          errors.push(...objErrors)
          fieldDetails[field.name] = {
            error: "object_properties_invalid",
            message: objErrors.join("; "),
            expectedProperties: field.validation.properties,
          }
          continue
        }
      }

      // Validate array item types if defined
      if (field.type === "array" && field.validation?.arrayItemType) {
        const arrayErrors = this.validateArrayItems(value, field.validation.arrayItemType, field.name)
        if (arrayErrors.length > 0) {
          errors.push(...arrayErrors)
          fieldDetails[field.name] = {
            error: "array_items_invalid",
            message: arrayErrors.join("; "),
            expectedItemType: field.validation.arrayItemType,
          }
          continue
        }
      }

      // Validate field rules (min, max, size, etc.)
      const validationError = this.validateFieldRules(value, field)
      if (validationError) {
        errors.push(validationError)
        fieldDetails[field.name] = {
          error: "validation_failed",
          message: validationError,
          validation: field.validation,
        }
      }
    }

    const schemaFieldNames = new Set(schema.fields.map((f) => f.name))
    const unknownFields = Object.keys(data).filter((key) => !schemaFieldNames.has(key))

    if (unknownFields.length > 0 && process.env.REJECT_UNKNOWN_FIELDS === "true") {
      errors.push(`Unknown fields not allowed: ${unknownFields.join(", ")}`)
    }

    if (errors.length > 0) {
      throw new AppError(400, "SCHEMA_VALIDATION_FAILED", "Document validation failed against schema", {
        errors,
        fieldDetails,
        hint: "Check that all required fields are present and match the expected types",
        allowedFields: schema.fields.map((f) => ({
          name: f.name,
          type: f.type,
          required: f.required || false,
        })),
      })
    }
  }

  private validateType(value: any, expectedType: SchemaField["type"], fieldName: string): string | null {
    if (expectedType === "relationship") {
      return null
    }
    // email, url, ip, datetime, enum are all stored as strings
    if (["email", "url", "ip", "datetime", "enum"].includes(expectedType)) {
      if (typeof value !== "string") {
        return `Field '${fieldName}' must be a string (${expectedType}), received ${this.getActualType(value)}`
      }
      return null
    }

    switch (expectedType) {
      case "string":
        if (typeof value !== "string") {
          return `Field '${fieldName}' must be a string, received ${this.getActualType(value)}`
        }
        break

      case "number":
      case "integer":
      case "float":
        if (typeof value !== "number" || Number.isNaN(value)) {
          return `Field '${fieldName}' must be a number, received ${this.getActualType(value)}`
        }
        // Integer check
        if (expectedType === "integer" && !Number.isInteger(value)) {
          return `Field '${fieldName}' must be an integer, received ${value}`
        }
        break

      case "boolean":
        if (typeof value !== "boolean") {
          return `Field '${fieldName}' must be a boolean, received ${this.getActualType(value)}`
        }
        break

      case "object":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return `Field '${fieldName}' must be an object, received ${this.getActualType(value)}`
        }
        break

      case "array":
        if (!Array.isArray(value)) {
          return `Field '${fieldName}' must be an array, received ${this.getActualType(value)}`
        }
        break

      default:
        return `Field '${fieldName}' has unsupported type '${expectedType}'`
    }

    return null
  }

  private async validateFormat(value: any, field: SchemaField): Promise<string | null> {
    if (typeof value !== "string") return null
    if (field.type === "relationship") return null

    switch (field.type) {
      case "email":
        return this.validateEmail(value, field.name)
      
      case "url":
        return this.validateURL(value, field.name)
      
      case "ip":
        return this.validateIP(value, field.name)
      
      case "datetime":
        return this.validateDateTime(value, field.name)
      
      case "enum":
        return this.validateEnum(value, field)
      
      default:
        return null
    }
  }

  private validateEmail(value: string, fieldName: string): string | null {
    // RFC 5322 simplified email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    
    if (!emailRegex.test(value)) {
      return `Field '${fieldName}' must be a valid email address`
    }
    
    return null
  }

  private validateURL(value: string, fieldName: string): string | null {
    try {
      new URL(value)
      return null
    } catch {
      return `Field '${fieldName}' must be a valid URL`
    }
  }

  private validateIP(value: string, fieldName: string): string | null {
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    
    // IPv6 regex (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
    
    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      return `Field '${fieldName}' must be a valid IP address (IPv4 or IPv6)`
    }
    
    return null
  }

  private validateDateTime(value: string, fieldName: string): string | null {
    // ISO 8601 datetime format
    const date = new Date(value)
    
    if (isNaN(date.getTime())) {
      return `Field '${fieldName}' must be a valid ISO 8601 datetime string`
    }
    
    return null
  }

  private validateEnum(value: string, field: SchemaField): string | null {
    if (!field.validation?.enum || field.validation.enum.length === 0) {
      return `Field '${field.name}' is marked as enum but no enum values are defined`
    }
    
    if (!field.validation.enum.includes(value)) {
      return `Field '${field.name}' must be one of: ${field.validation.enum.join(", ")}`
    }
    
    return null
  }

  private getActualType(value: any): string {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  private validateFieldRules(value: any, field: SchemaField): string | null {
    if (!field.validation) return null

    const rules = field.validation

    // String validation (also applies to email, url, ip, datetime, enum)
    if (["string", "email", "url", "ip", "datetime", "enum"].includes(field.type) && typeof value === "string") {
      // Use maxLength instead of size
      if (rules.maxLength && value.length > rules.maxLength) {
        return rules.customMessage || `Field '${field.name}' must be at most ${rules.maxLength} characters`
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        return rules.customMessage || `Field '${field.name}' must be at least ${rules.minLength} characters`
      }
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern)
        if (!regex.test(value)) {
          return rules.customMessage || `Field '${field.name}' does not match required pattern`
        }
      }
    }

    // Number validation (number, integer, float)
    if (["number", "integer", "float"].includes(field.type) && typeof value === "number") {
      
      if (rules.min !== undefined && value < rules.min) {
        return rules.customMessage || `Field '${field.name}' must be at least ${rules.min}`
      }
      if (rules.max !== undefined && value > rules.max) {
        return rules.customMessage || `Field '${field.name}' must be at most ${rules.max}`
      }
    }

    // Array validation
    if (field.type === "array" && Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        return `Field '${field.name}' must have at least ${rules.minItems} items`
      }
      if (rules.maxItems && value.length > rules.maxItems) {
        return `Field '${field.name}' must have at most ${rules.maxItems} items`
      }
    }

    return null
  }

  async validateUniqueConstraints(
    collectionId: string,
    data: any,
    schema: SchemaDefinition,
    excludeDocId?: string,
  ): Promise<void> {
    const uniqueFields = schema.fields.filter((f) => f.unique)
    if (uniqueFields.length === 0) return

    const errors: string[] = []

    for (const field of uniqueFields) {
      if (!(field.name in data)) continue

      const value = data[field.name]
      let query = `SELECT id FROM documents WHERE collection_id = $1 AND data->>'${field.name}' = $2 AND deleted_at IS NULL`
      const params: any[] = [collectionId, String(value)]

      if (excludeDocId) {
        query += ` AND id != $3`
        params.push(excludeDocId)
      }

      const result = await pool.query(query, params)

      if (result.rows.length > 0) {
        errors.push(`Field '${field.name}' must be unique. Value '${value}' already exists`)
      }
    }

    if (errors.length > 0) {
      throw new AppError(400, "UNIQUE_CONSTRAINT_VIOLATION", "Unique constraint validation failed", {
        errors,
        hint: "One or more fields with unique constraints already have the provided values",
      })
    }
  }

  /**
   * Validate object properties against the schema
   */
  private validateObjectProperties(
    obj: Record<string, unknown>,
    properties: Array<{ key: string; type: string; required?: boolean }>,
    fieldName: string
  ): string[] {
    const errors: string[] = []

    for (const prop of properties) {
      const value = obj[prop.key]

      // Check if value is missing (undefined or null)
      const isAbsent = value === undefined || value === null

      // Check if value is "empty" based on type (for required validation)
      // - string: empty or whitespace-only string
      // - integer/float/number: NaN is considered invalid, but 0 is valid
      // - boolean: false is a valid value, not considered empty
      const isEmpty = 
        (prop.type === "string" && typeof value === "string" && value.trim() === "") ||
        (["integer", "float", "number"].includes(prop.type) && typeof value === "number" && Number.isNaN(value))
      
      if (prop.required && (isAbsent || isEmpty)) {
        errors.push(`Object '${fieldName}' is missing required property '${prop.key}'`)
        continue
      }

      // Skip if value is not present and not required
      if (isAbsent) continue

      // Validate type
      const actualType = this.getActualType(value)
      const expectedType = prop.type

      let typeValid = false
      switch (expectedType) {
        case "string":
          typeValid = typeof value === "string"
          break
        case "number":
        case "float":
          typeValid = typeof value === "number" && !Number.isNaN(value)
          break
        case "integer":
          typeValid = typeof value === "number" && Number.isInteger(value)
          break
        case "boolean":
          typeValid = typeof value === "boolean"
          break
        default:
          typeValid = true // Allow unknown types
      }

      if (!typeValid) {
        errors.push(`Object '${fieldName}' property '${prop.key}' expected ${expectedType}, got ${actualType}`)
      }
    }

    return errors
  }

  /**
   * Validate array items against the expected type
   */
  private validateArrayItems(
    arr: unknown[],
    expectedItemType: string,
    fieldName: string
  ): string[] {
    const errors: string[] = []

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      const actualType = this.getActualType(item)

      let typeValid = false
      switch (expectedItemType) {
        case "string":
          typeValid = typeof item === "string"
          break
        case "number":
        case "float":
          typeValid = typeof item === "number" && !Number.isNaN(item)
          break
        case "integer":
          typeValid = typeof item === "number" && Number.isInteger(item)
          break
        case "boolean":
          typeValid = typeof item === "boolean"
          break
        case "object":
          typeValid = typeof item === "object" && item !== null && !Array.isArray(item)
          break
        default:
          typeValid = true
      }

      if (!typeValid) {
        errors.push(`Array '${fieldName}' item at index ${i} expected ${expectedItemType}, got ${actualType}`)
      }
    }

    return errors
  }
}
