import type { IdentityContext } from "../../types/identity"
import type { Collection } from "../../types/collection"
import type { Document } from "../../types/document"
import type { PermissionRules, PermissionRule } from "../../types/permission"

// Export PermissionTarget type for legacy code
export type PermissionTarget = 'any' | 'none' | 'owner' | `user:${string}` | `team:${string}` | `role:${string}` | `scope:${string}`;

// Re-export types for convenience
export type { Document } from "../../types/document"
export type { PermissionRules, PermissionRule } from "../../types/permission"

/**
 * Permission Rule Evaluator
 * Evaluates flexible permission rules for RLS (Row-Level Security)
 *
 * Supports TWO formats:
 * 
 * Format 1 (Internal/Recommended):
 * {
 *   "read": ["any"],
 *   "create": ["user:{user_id}", "team:{team_id}"],
 *   "update": ["user:{user_id}", "role:admin"],
 *   "delete": ["owner", "role:owner"]
 * }
 *
 * Format 2 (Appwrite-style):
 * {
 *   "$permissions": [
 *     "read(\"any\")",
 *     "create(\"user:alice\")",
 *     "update(\"owner\")",
 *     "delete(\"role:admin\")"
 *   ]
 * }
 */
export class PermissionRuleEvaluator {
  /**
   * Evaluate if identity can perform action based on permission rules
   */
  evaluate(
    action: "read" | "create" | "update" | "delete",
    rules: PermissionRules | undefined,
    identity: IdentityContext,
    resource: { created_by?: string; owner_id?: string },
  ): boolean {
    // If no rules defined, deny by default (secure by default)
    if (!rules || !rules[action]) {
      return false
    }

    const permissionRules = rules[action]!

    // Evaluate each permission rule (supports both PermissionRule objects and string targets)
    return permissionRules.some((rule) => {
      if (typeof rule === 'string') {
        return this.evaluateTarget(rule as any, identity, resource)
      }
      return this.evaluateRule(rule, identity, resource)
    })
  }

  /**
   * Evaluate a single permission rule object
   */
  private evaluateRule(
    rule: PermissionRule,
    identity: IdentityContext,
    resource: { created_by?: string; owner_id?: string },
  ): boolean {
    // Check role-based permission
    if (rule.role) {
      // Handle special roles
      if (rule.role === "any" || rule.role === "*") {
        return true
      }

      if (rule.role === "none") {
        return false
      }

      if (rule.role === "owner") {
        const identityId = identity.user_id || identity.userId || identity.api_key_id || identity.apiKeyId
        return identityId === resource.owner_id || identityId === resource.created_by
      }

      // Check if identity has the required role
      if (identity.roles?.includes(rule.role)) {
        return true
      }

      // Check user-specific role
      if (rule.role.startsWith("user:")) {
        const userId = rule.role.replace("user:", "")
        if (userId === "{user_id}") {
          return identity.type === "user" && (identity.user_id || identity.userId) !== undefined
        }
        return (identity.user_id || identity.userId) === userId
      }

      // Check team-specific role
      if (rule.role.startsWith("team:")) {
        const teamId = rule.role.replace("team:", "")
        if (teamId === "{team_id}") {
          return (identity.team_id || identity.teamId) !== undefined
        }
        return (identity.team_id || identity.teamId) === teamId
      }

      // Check scope-specific role
      if (rule.role.startsWith("scope:")) {
        const scope = rule.role.replace("scope:", "")
        return identity.scopes?.includes(scope) || identity.scopes?.includes("*") || false
      }

      return false
    }

    // If no role specified but has condition, evaluate condition
    if (rule.condition) {
      return this.evaluateCondition(rule.condition, identity, resource)
    }

    // No role or condition, deny
    return false
  }

  /**
   * Evaluate a permission condition
   */
  private evaluateCondition(
    condition: { field: string; operator: string; value: any; context?: string },
    identity: IdentityContext,
    resource: { created_by?: string; owner_id?: string },
  ): boolean {
    // Get the value to compare based on context
    let fieldValue: any
    if (condition.context === 'user') {
      fieldValue = (identity as any)[condition.field]
    } else if (condition.context === 'document') {
      fieldValue = (resource as any)[condition.field]
    } else {
      fieldValue = (resource as any)[condition.field] ?? (identity as any)[condition.field]
    }

    // Evaluate based on operator
    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value
      case 'ne':
        return fieldValue !== condition.value
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue)
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue)
      case 'gt':
        return fieldValue > condition.value
      case 'gte':
        return fieldValue >= condition.value
      case 'lt':
        return fieldValue < condition.value
      case 'lte':
        return fieldValue <= condition.value
      case 'exists':
        return condition.value ? fieldValue !== undefined : fieldValue === undefined
      default:
        return false
    }
  }

  /**
   * Evaluate a single permission target (legacy string-based)
   */
  private evaluateTarget(
    target: PermissionTarget,
    identity: IdentityContext,
    resource: { created_by?: string; owner_id?: string },
  ): boolean {
    // Handle special keywords
    if (target === "any") {
      return true
    }

    if (target === "none") {
      return false
    }

    if (target === "owner") {
      // Check if identity is the owner (document) or creator (collection)
      const identityId = identity.user_id || identity.userId || identity.api_key_id || identity.apiKeyId
      return identityId === resource.owner_id || identityId === resource.created_by
    }

    // Handle pattern-based targets
    if (target.startsWith("user:")) {
      const userId = target.replace("user:", "")
      // Support {user_id} placeholder
      if (userId === "{user_id}") {
        return identity.type === "user" && (identity.user_id || identity.userId) !== undefined
      }
      // Support specific user ID
      return (identity.user_id || identity.userId) === userId
    }

    if (target.startsWith("team:")) {
      const teamId = target.replace("team:", "")
      // Support {team_id} placeholder
      if (teamId === "{team_id}") {
        return (identity.team_id || identity.teamId) !== undefined
      }
      // Support specific team ID
      return (identity.team_id || identity.teamId) === teamId
    }

    if (target.startsWith("role:")) {
      const role = target.replace("role:", "")
      
      // Check roles array
      if (identity.roles?.includes(role)) {
        return true
      }
      
      return false
    }

    if (target.startsWith("scope:")) {
      const scope = target.replace("scope:", "")
      return identity.scopes?.includes(scope) || identity.scopes?.includes("*") || false
    }

    // Unknown target format, deny
    return false
  }

  /**
   * Get effective permission rules for a document
   * Documents can override collection rules
   */
  getEffectiveRules(document: Document | null, collection: Collection): PermissionRules | undefined {
    if (document?.permission_rules) {
      return document.permission_rules
    }
    return collection.permission_rules
  }

  /**
   * ADDED: Convert Appwrite-style permission strings to internal format
   * Supports both quote styles: "read(\"any\")" or "read('any')"
   * 
   * Example:
   * Input: ["read(\"any\")", "update(\"user:alice\")"]
   * Output: { read: ["any"], update: ["user:alice"] }
   */
  parseAppwritePermissions(permissions: string[]): PermissionRules {
    const rules: PermissionRules = {}
    
    for (const perm of permissions) {
      // Parse formats:
      // - read("any") or read('any')
      // - read(\"any\") or read(\'any\')
      const match = perm.match(/^(\w+)\(["'](.*)["']\)$/)
      if (!match) {
        console.warn(`Invalid Appwrite permission format: ${perm}`)
        continue
      }
      
      const [, action, target] = match
      
      // Validate action
      if (!['read', 'create', 'update', 'delete'].includes(action)) {
        console.warn(`Invalid permission action: ${action}`)
        continue
      }
      
      // Initialize array if needed
      if (!rules[action as keyof PermissionRules]) {
        rules[action as keyof PermissionRules] = []
      }
      
      // Add target as a PermissionRule object
      rules[action as keyof PermissionRules]!.push({ role: target } as PermissionRule)
    }
    
    return rules
  }

  /**
   * ADDED: Convert internal format to Appwrite-style strings
   * Example:
   * Input: { read: ["any"], update: ["user:alice"] }
   * Output: ["read(\"any\")", "update(\"user:alice\")"]
   */
  toAppwritePermissions(rules: PermissionRules): string[] {
    const permissions: string[] = []
    
    for (const [action, targets] of Object.entries(rules)) {
      if (!targets || !Array.isArray(targets)) continue
      
      for (const target of targets) {
        permissions.push(`${action}("${target}")`)
      }
    }
    
    return permissions
  }

  /**
   * Validate permission rules structure
   */
  validateRules(rules: any): { valid: boolean; error?: string } {
    if (!rules || typeof rules !== "object") {
      return { valid: false, error: "Permission rules must be an object" }
    }

    const allowedActions = ["read", "create", "update", "delete"]
    const allowedKeywords = ["any", "none", "owner"]
    const allowedPrefixes = ["user:", "team:", "role:", "scope:"]

    for (const action of Object.keys(rules)) {
      if (!allowedActions.includes(action)) {
        return { valid: false, error: `Invalid action: ${action}. Must be one of: ${allowedActions.join(", ")}` }
      }

      const targets = rules[action]
      if (!Array.isArray(targets)) {
        return { valid: false, error: `${action} must be an array of permission targets` }
      }

      for (const target of targets) {
        if (typeof target !== "string") {
          return { valid: false, error: `Permission target must be a string, got: ${typeof target}` }
        }

        const isKeyword = allowedKeywords.includes(target)
        const hasValidPrefix = allowedPrefixes.some((prefix) => target.startsWith(prefix))

        if (!isKeyword && !hasValidPrefix) {
          return {
            valid: false,
            error: `Invalid permission target: ${target}. Must be a keyword (${allowedKeywords.join(", ")}) or start with ${allowedPrefixes.join(", ")}`,
          }
        }
      }
    }

    return { valid: true }
  }

  /**
   * ADDED: Validate Appwrite-style permission strings
   */
  validateAppwritePermissions(permissions: any): { valid: boolean; error?: string } {
    if (!Array.isArray(permissions)) {
      return { valid: false, error: "$permissions must be an array" }
    }

    for (const perm of permissions) {
      if (typeof perm !== "string") {
        return { valid: false, error: "Each permission must be a string" }
      }

      // Validate format
      const match = perm.match(/^(\w+)\(["'](.*)["']\)$/)
      if (!match) {
        return { valid: false, error: `Invalid permission format: ${perm}. Expected format: action("target")` }
      }

      const [, action, target] = match
      if (!['read', 'create', 'update', 'delete'].includes(action)) {
        return { valid: false, error: `Invalid action: ${action}` }
      }

      // Validate target
      const allowedKeywords = ["any", "none", "owner"]
      const allowedPrefixes = ["user:", "team:", "role:", "scope:"]
      const isValid = allowedKeywords.includes(target) || 
                      allowedPrefixes.some(prefix => target.startsWith(prefix))
      
      if (!isValid) {
        return { valid: false, error: `Invalid permission target: ${target}` }
      }
    }

    return { valid: true }
  }
}
