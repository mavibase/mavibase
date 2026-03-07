import { AppError } from "@mavibase/core"

export interface PatchOperation {
  $set?: Record<string, any>
  $unset?: string[]
  $increment?: Record<string, number>
  $push?: Record<string, any>
  $pull?: Record<string, any>
}

export class PatchOperator {
  /**
   * Apply patch operations to a document
   */
  applyPatch(currentData: any, patchOps: PatchOperation): any {
    const result = { ...currentData }

    // $set: Set specific fields
    if (patchOps.$set) {
      for (const [key, value] of Object.entries(patchOps.$set)) {
        this.setNestedValue(result, key, value)
      }
    }

    // $unset: Remove specific fields
    if (patchOps.$unset) {
      for (const key of patchOps.$unset) {
        this.unsetNestedValue(result, key)
      }
    }

    // $increment: Increment numeric fields
    if (patchOps.$increment) {
      for (const [key, value] of Object.entries(patchOps.$increment)) {
        if (typeof value !== "number") {
          throw new AppError(400, "INVALID_INCREMENT", `$increment value for '${key}' must be a number`, {
            field: key,
            value,
          })
        }
        const currentValue = this.getNestedValue(result, key)
        if (currentValue === undefined) {
          this.setNestedValue(result, key, value)
        } else if (typeof currentValue === "number") {
          this.setNestedValue(result, key, currentValue + value)
        } else {
          throw new AppError(400, "INVALID_INCREMENT", `Cannot increment non-numeric field '${key}'`, {
            field: key,
            currentType: typeof currentValue,
          })
        }
      }
    }

    // $push: Add item to array
    if (patchOps.$push) {
      for (const [key, value] of Object.entries(patchOps.$push)) {
        const currentValue = this.getNestedValue(result, key)
        if (currentValue === undefined) {
          this.setNestedValue(result, key, [value])
        } else if (Array.isArray(currentValue)) {
          currentValue.push(value)
        } else {
          throw new AppError(400, "INVALID_PUSH", `Cannot push to non-array field '${key}'`, {
            field: key,
            currentType: typeof currentValue,
          })
        }
      }
    }

    // $pull: Remove item from array
    if (patchOps.$pull) {
      for (const [key, value] of Object.entries(patchOps.$pull)) {
        const currentValue = this.getNestedValue(result, key)
        if (Array.isArray(currentValue)) {
          const filtered = currentValue.filter((item) => !this.deepEqual(item, value))
          this.setNestedValue(result, key, filtered)
        } else if (currentValue !== undefined) {
          throw new AppError(400, "INVALID_PULL", `Cannot pull from non-array field '${key}'`, {
            field: key,
            currentType: typeof currentValue,
          })
        }
      }
    }

    return result
  }

  /**
   * Validate patch operations
   */
  validatePatch(patchOps: any): void {
    const validOperators = ["$set", "$unset", "$increment", "$push", "$pull"]
    const providedOperators = Object.keys(patchOps)

    for (const op of providedOperators) {
      if (!validOperators.includes(op)) {
        throw new AppError(400, "INVALID_PATCH_OPERATOR", `Invalid patch operator: ${op}`, {
          validOperators,
          providedOperator: op,
        })
      }
    }

    if (providedOperators.length === 0) {
      throw new AppError(400, "EMPTY_PATCH", "Patch operations cannot be empty", {
        hint: "Include at least one patch operator like $set, $unset, $increment, $push, or $pull",
      })
    }

    // Validate $set
    if (patchOps.$set && typeof patchOps.$set !== "object") {
      throw new AppError(400, "INVALID_SET_OPERATOR", "$set must be an object")
    }

    // Validate $unset
    if (patchOps.$unset && !Array.isArray(patchOps.$unset)) {
      throw new AppError(400, "INVALID_UNSET_OPERATOR", "$unset must be an array of field names")
    }

    // Validate $increment
    if (patchOps.$increment && typeof patchOps.$increment !== "object") {
      throw new AppError(400, "INVALID_INCREMENT_OPERATOR", "$increment must be an object")
    }

    // Validate $push
    if (patchOps.$push && typeof patchOps.$push !== "object") {
      throw new AppError(400, "INVALID_PUSH_OPERATOR", "$push must be an object")
    }

    // Validate $pull
    if (patchOps.$pull && typeof patchOps.$pull !== "object") {
      throw new AppError(400, "INVALID_PULL_OPERATOR", "$pull must be an object")
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split(".")
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      current = current[part]
    }

    return current
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split(".")
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current) || typeof current[part] !== "object") {
        current[part] = {}
      }
      current = current[part]
    }

    current[parts[parts.length - 1]] = value
  }

  /**
   * Unset nested value in object using dot notation
   */
  private unsetNestedValue(obj: any, path: string): void {
    const parts = path.split(".")
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        return // Path doesn't exist, nothing to unset
      }
      current = current[part]
    }

    delete current[parts[parts.length - 1]]
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== "object" || typeof b !== "object") return false

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!this.deepEqual(a[key], b[key])) return false
    }

    return true
  }
}
