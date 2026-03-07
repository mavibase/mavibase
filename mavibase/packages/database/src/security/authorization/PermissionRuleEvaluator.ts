import type { IdentityContext } from '../../types/identity';
import type { PermissionRules, PermissionRule, PermissionCondition } from '../../types/permission';

export class PermissionRuleEvaluator {
  /**
   * Evaluate permission rules for an action
   */
  evaluate(
    action: 'read' | 'create' | 'update' | 'delete',
    rules: PermissionRules,
    identity: IdentityContext,
    resource: any
  ): boolean {
    const actionRules = rules[action];
    
    if (!actionRules || actionRules.length === 0) {
      // No rules means no access
      return false;
    }

    // Check if any rule matches
    return actionRules.some(rule => this.evaluateRule(rule, identity, resource));
  }

  /**
   * Evaluate a single permission rule (PermissionRule object or legacy string target)
   */
  private evaluateRule(
    rule: PermissionRule | string,
    identity: IdentityContext,
    resource: any
  ): boolean {
    // Handle legacy string targets (e.g. "any", "owner", "role:admin", "user:xxx")
    if (typeof rule === 'string') {
      return this.evaluateStringTarget(rule, identity, resource);
    }

    // Handle PermissionRule objects
    if (rule.role) {
      // First check special keywords / prefixed targets on the role field
      if (this.isSpecialTarget(rule.role)) {
        const matched = this.evaluateStringTarget(rule.role, identity, resource);
        if (!matched) return false;
        // If there's also a condition, both must pass
        if (rule.condition) {
          return this.evaluateCondition(rule.condition, identity, resource);
        }
        return true;
      }

      // Plain role name -- check identity.roles
      if (!identity.roles || !identity.roles.includes(rule.role)) {
        return false;
      }
    }

    // Check condition
    if (rule.condition) {
      return this.evaluateCondition(rule.condition, identity, resource);
    }

    // If no conditions, role match is enough
    return true;
  }

  /**
   * Check if a target string is a special keyword or prefixed target
   */
  private isSpecialTarget(target: string): boolean {
    return (
      target === 'any' || target === '*' ||
      target === 'none' ||
      target === 'owner' ||
      target.startsWith('user:') ||
      target.startsWith('team:') ||
      target.startsWith('role:') ||
      target.startsWith('scope:')
    );
  }

  /**
   * Evaluate a string-based permission target
   * Handles: "any", "none", "owner", "user:{id}", "team:{id}", "role:{name}", "scope:{name}"
   */
  private evaluateStringTarget(
    target: string,
    identity: IdentityContext,
    resource: any
  ): boolean {
    if (target === 'any' || target === '*') return true;
    if (target === 'none') return false;

    if (target === 'owner') {
      const identityId = identity.user_id || identity.userId || identity.api_key_id || identity.apiKeyId;
      return identityId === resource?.owner_id || identityId === resource?.created_by;
    }

    if (target.startsWith('user:')) {
      const userId = target.replace('user:', '');
      if (userId === '{user_id}') {
        return identity.type === 'user' && !!(identity.user_id || identity.userId);
      }
      return (identity.user_id || identity.userId) === userId;
    }

    if (target.startsWith('team:')) {
      const teamId = target.replace('team:', '');
      if (teamId === '{team_id}') {
        return !!(identity.team_id || identity.teamId);
      }
      return (identity.team_id || identity.teamId) === teamId;
    }

    if (target.startsWith('role:')) {
      const role = target.replace('role:', '');
      return identity.roles?.includes(role) || false;
    }

    if (target.startsWith('scope:')) {
      const scope = target.replace('scope:', '');
      return identity.scopes?.includes(scope) || identity.scopes?.includes('*') || false;
    }

    return false;
  }

  /**
   * Evaluate a permission condition
   */
  private evaluateCondition(
    condition: PermissionCondition,
    identity: IdentityContext,
    resource: any
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, resource, identity, condition.context);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'gt':
        return fieldValue > condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  /**
   * Get field value from resource or context
   */
  private getFieldValue(
    field: string,
    resource: any,
    identity: IdentityContext,
    context?: 'user' | 'team' | 'document'
  ): any {
    switch (context) {
      case 'user':
        return identity.userId;
      case 'team':
        return identity.teamId;
      case 'document':
      default:
        return resource?.[field];
    }
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
        // Handle PermissionRule objects
        if (typeof target === "object" && target !== null) {
          if (target.role) {
            const role = target.role
            const isKeyword = allowedKeywords.includes(role)
            const hasValidPrefix = allowedPrefixes.some((prefix) => role.startsWith(prefix))
            if (!isKeyword && !hasValidPrefix) {
              return {
                valid: false,
                error: `Invalid permission role: ${role}. Must be a keyword (${allowedKeywords.join(", ")}) or start with ${allowedPrefixes.join(", ")}`,
              }
            }
          }
          continue
        }

        // Handle string targets (legacy format)
        if (typeof target !== "string") {
          return { valid: false, error: `Permission target must be a string or object, got: ${typeof target}` }
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
}
