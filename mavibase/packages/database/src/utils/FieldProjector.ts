import { AppError } from "@mavibase/core"

export class FieldProjector {
  /**
   * Project specific fields from a document
   * @param document - The document data object
   * @param fields - Comma-separated list of fields to include
   * @returns Projected document with only requested fields
   */
  project(document: any, fields?: string): any {
    if (!fields) {
      return document
    }

    const fieldList = fields.split(",").map((f) => f.trim())

    if (fieldList.length === 0) {
      return document
    }

    // Validate field names
    for (const field of fieldList) {
      if (!/^[a-zA-Z0-9_$.]+$/.test(field)) {
        throw new AppError(400, "INVALID_FIELD_NAME", `Invalid field name: ${field}`, {
          hint: "Field names can only contain letters, numbers, underscores, dots, and dollar signs",
        })
      }
    }

    const projected: any = {}

    for (const field of fieldList) {
      if (field.includes(".")) {
        // Handle nested fields (e.g., "user.name")
        this.projectNestedField(document, projected, field)
      } else {
        // Handle regular fields
        if (field in document) {
          projected[field] = document[field]
        }
      }
    }

    return projected
  }

  /**
   * Project multiple documents
   */
  projectMany(documents: any[], fields?: string): any[] {
    if (!fields) {
      return documents
    }

    return documents.map((doc) => this.project(doc, fields))
  }

  /**
   * Handle nested field projection
   */
  private projectNestedField(source: any, target: any, fieldPath: string): void {
    const parts = fieldPath.split(".")
    let currentSource = source
    let currentTarget = target

    // Navigate to the nested value
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]

      if (!(part in currentSource)) {
        return // Field doesn't exist, skip
      }

      if (!(part in currentTarget)) {
        currentTarget[part] = {}
      }

      currentSource = currentSource[part]
      currentTarget = currentTarget[part]
    }

    // Set the final value
    const finalPart = parts[parts.length - 1]
    if (finalPart in currentSource) {
      currentTarget[finalPart] = currentSource[finalPart]
    }
  }

  /**
   * Check if field projection is being used
   */
  isProjectionRequested(fields?: string): boolean {
    return !!fields && fields.trim().length > 0
  }

  /**
   * Validate field names against schema
   */
  validateFieldsAgainstSchema(fields: string, schema?: any): void {
    if (!schema || !schema.fields) {
      return // No schema to validate against
    }

    const requestedFields = fields.split(",").map((f) => f.trim())
    const schemaFields = schema.fields.map((f: any) => f.name)

    for (const field of requestedFields) {
      // Skip metadata fields (starting with $)
      if (field.startsWith("$")) {
        continue
      }

      // For nested fields, check the root field
      const rootField = field.split(".")[0]

      if (!schemaFields.includes(rootField)) {
        throw new AppError(400, "INVALID_FIELD", `Field '${field}' does not exist in collection schema`, {
          hint: `Valid fields: ${schemaFields.join(", ")}`,
          requestedField: field,
        })
      }
    }
  }
}
