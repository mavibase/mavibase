import { AppError } from "@mavibase/api/middleware/error-handler"
import type { SchemaDefinition } from "@mavibase/database"

export class InputValidator {
  static validateCollectionName(name: string): void {
    if (!name || typeof name !== "string") {
      throw new AppError(400, "INVALID_INPUT", "Collection name is required and must be a string")
    }

    if (name.length < 1 || name.length > 255) {
      throw new AppError(400, "INVALID_INPUT", "Collection name must be between 1 and 255 characters")
    }

    if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
      throw new AppError(
        400,
        "INVALID_INPUT",
        "Collection name can only contain letters, numbers, spaces, hyphens, and underscores",
      )
    }
  }

  static validateSchema(schema: SchemaDefinition): void {
    if (!schema || typeof schema !== "object") {
      throw new AppError(400, "INVALID_SCHEMA", "Schema must be an object")
    }

    if (!schema.fields || !Array.isArray(schema.fields)) {
      throw new AppError(400, "INVALID_SCHEMA", "Schema must contain a fields array")
    }

    // All supported types - UPDATED to include new types
    const validTypes = [
      "string",
      "number",
      "integer",
      "float",
      "boolean",
      "datetime",
      "email",
      "url",
      "ip",
      "enum",
      "object",
      "array",
    ]

    const reserved = ["id", "created_at", "updated_at", "deleted_at", "version"]

    for (const field of schema.fields) {
      if (!field.name || !field.type) {
        throw new AppError(400, "INVALID_SCHEMA", "Each field must have 'name' and 'type'")
      }

      if (typeof field.name !== "string") {
        throw new AppError(400, "INVALID_SCHEMA", "Field name must be a string")
      }

      if (reserved.includes(field.name)) {
        throw new AppError(400, "INVALID_SCHEMA", `Field name '${field.name}' is reserved`)
      }

      if (!validTypes.includes(field.type)) {
        throw new AppError(
          400,
          "INVALID_SCHEMA",
          `Invalid field type '${field.type}'. Must be one of: ${validTypes.join(", ")}`,
        )
      }

      // Validate enum type has enum values
      if (field.type === "enum") {
        if (!field.validation?.enum || !Array.isArray(field.validation.enum) || field.validation.enum.length === 0) {
          throw new AppError(
            400,
            "INVALID_SCHEMA",
            `Field '${field.name}' is type 'enum' but has no enum values in validation.enum array`,
          )
        }
      }

      // Validate field name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        throw new AppError(
          400,
          "INVALID_SCHEMA",
          `Field name '${field.name}' must start with a letter or underscore and contain only letters, numbers, and underscores`,
        )
      }
    }
  }

  static validateDocumentData(data: any): void {
    if (!data || typeof data !== "object") {
      throw new AppError(400, "INVALID_INPUT", "Document data must be an object")
    }

    if (Array.isArray(data)) {
      throw new AppError(400, "INVALID_INPUT", "Document data cannot be an array")
    }
  }

  static validatePagination(limit?: string | number, offset?: string | number): void {
    if (limit !== undefined) {
      const limitNum = typeof limit === "string" ? Number.parseInt(limit) : limit
      if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_INPUT", "Limit must be between 1 and 100")
      }
    }

    if (offset !== undefined) {
      const offsetNum = typeof offset === "string" ? Number.parseInt(offset) : offset
      if (Number.isNaN(offsetNum) || offsetNum < 0) {
        throw new AppError(400, "INVALID_INPUT", "Offset must be 0 or greater")
      }
    }
  }

  static validateDatabaseName(name: string): void {
    if (!name || typeof name !== "string") {
      throw new AppError(400, "INVALID_INPUT", "Database name is required and must be a string")
    }

    if (name.length < 1 || name.length > 255) {
      throw new AppError(400, "INVALID_INPUT", "Database name must be between 1 and 255 characters")
    }
  }

  static validateId(id: string, fieldName = "ID"): void {
    if (!id || typeof id !== "string") {
      throw new AppError(400, "INVALID_INPUT", `${fieldName} is required and must be a string`)
    }

    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      throw new AppError(400, "INVALID_INPUT", `${fieldName} must be a valid UUID`)
    }
  }
}
