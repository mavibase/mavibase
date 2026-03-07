import type { IdentityContext } from "../../types/identity"
import type { Collection } from "../../types/collection"
import type { Document } from "../../types/document"
import { AppError } from "@mavibase/core"
import { PermissionRuleEvaluator } from "./PermissionEvaluator"

/**
 * Authorization Policy Engine
 * Evaluates data-level permissions based on:
 * - Project-level isolation (already enforced by middleware)
 * - Permission rules (flexible RLS)
 * - Collection visibility rules (fallback)
 * - Document ownership (fallback)
 * - User roles (fallback)
 */
export class AuthorizationPolicy {
  private ruleEvaluator = new PermissionRuleEvaluator()

  /**
   * Policy Evaluation Order:
   * 1. Project-level (enforced by middleware) 
   * 2. Scope-based (read/write permissions) 
   * 3. Role permission strings (coarse-grained gate — e.g. "documents.create")
   * 4. Permission rules (flexible RLS)
   * 5. Collection-level visibility (fallback)
   * 6. Document-level ownership (fallback)
   * 7. Role-based access (fallback)
   */

  /**
   * Coarse-grained gate: check if the identity's role permission strings
   * allow the given resource.action (e.g. "collections.read").
   *
   * - Service accounts bypass this gate (scoped by API key scopes instead).
   * - Team owners/admins bypass this gate (they have full access).
   * - Users with NO project_roles assigned also bypass (legacy / un-roled users).
   * - Only users who HAVE been assigned custom project roles are gated.
   *
   * Returns true if the action is allowed (or the gate doesn't apply).
   */
  private hasRolePermission(identity: IdentityContext, requiredPermission: string): boolean {
    // Service accounts are not gated by role permissions
    if (identity.type === "service" || identity.type === "api_key") {
      return true
    }

    // Team owners/admins always bypass the role permission gate
    const teamRole = identity.roles?.find(r => r === "owner" || r === "admin")
    if (teamRole) {
      return true
    }

    // If the user has no custom project roles assigned, they are un-roled — bypass
    if (!identity.project_roles || identity.project_roles.length === 0) {
      return true
    }

    // User has custom roles assigned — they MUST have the permission string
    if (!identity.permissions || identity.permissions.length === 0) {
      return false
    }

    return identity.permissions.includes(requiredPermission)
  }

  /**
   * Check if identity is a team owner, admin, or service account.
   * These identities always bypass collection/document RLS rules.
   */
  private isOwnerOrAdmin(identity: IdentityContext): boolean {
    if (identity.type === "service" || identity.type === "api_key") {
      return true
    }
    return identity.roles?.includes("owner") === true || identity.roles?.includes("admin") === true
  }

  /**
   * UPDATED: Check if API key/user has required scope
   * Supports both old and new scope formats
   */
  private hasScope(identity: IdentityContext, ...requiredScopes: string[]): boolean {
    // Check for wildcard
    if (identity.scopes && identity.scopes.includes("*")) {
      return true
    }

    // Check if identity has any of the required scopes
    return requiredScopes.some(scope => identity.scopes && identity.scopes.includes(scope))
  }

  /**
   * Check if user can read a collection
   */
  canReadCollection(identity: IdentityContext, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "collections.read")) {
      return false
    }

    // Team owners/admins always bypass collection-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    if (collection.permission_rules) {
      return this.ruleEvaluator.evaluate("read", collection.permission_rules, identity, {
        created_by: collection.created_by,
      })
    }

    // Service accounts can read if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity, 
        "read:databases", 
        "database:read",
        "databases:read"
      )
    }

    // User access depends on collection visibility
    switch (collection.visibility) {
      case "public":
        return true // Anyone in project can read

      case "internal":
        return true // Anyone in project (internal) can read

      case "team":
        return true // Anyone in team can read

      case "private":
        // Only creator can read private collections
        return collection.created_by === identity.user_id

      default:
        return false
    }
  }

  /**
   * Check if user can write to a collection
   */
  canWriteCollection(identity: IdentityContext, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "collections.update")) {
      return false
    }

    // Team owners/admins always bypass collection-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    if (collection.permission_rules) {
      return this.ruleEvaluator.evaluate("update", collection.permission_rules, identity, {
        created_by: collection.created_by,
      })
    }

    // Service accounts can write if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity,
        "write:databases",
        "database:write",
        "database:update",
        "databases:write"
      )
    }

    // User access depends on collection visibility and role
    switch (collection.visibility) {
      case "public":
        // Public collections: any team member can write
        return true

      case "internal":
        // Internal collections: any team member can write
        return true

      case "team":
        // Team collections: any team member can write
        return true

      case "private":
        // Private collections: only creator can write
        return collection.created_by === identity.user_id

      default:
        return false
    }
  }

  /**
   * Check if user can delete a collection
   */
  canDeleteCollection(identity: IdentityContext, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "collections.delete")) {
      return false
    }

    // Team owners/admins always bypass collection-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    if (collection.permission_rules) {
      return this.ruleEvaluator.evaluate("delete", collection.permission_rules, identity, {
        created_by: collection.created_by,
      })
    }

    // Service accounts can delete if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity,
        "delete:databases",
        "database:delete",
        "databases:delete"
      )
    }

    // Users can only delete collections they created, or if they're admin/owner
    if (collection.created_by === identity.user_id) {
      return true
    }

    // Admins and owners can delete any collection in their project
    return identity.roles?.includes("admin") || identity.roles?.includes("owner")
  }

  /**
   * Check if user can read a document
   */
  canReadDocument(identity: IdentityContext, document: Document, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "documents.read")) {
      return false
    }

    // Team owners/admins always bypass document-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    const effectiveRules = this.ruleEvaluator.getEffectiveRules(document, collection)

    if (effectiveRules) {
      return this.ruleEvaluator.evaluate("read", effectiveRules, identity, {
        created_by: collection.created_by,
        owner_id: document.owner_id,
      })
    }

    // No permission rules on document OR collection — "no RLS" means open
    // Any authenticated team member can read when no RLS rules are defined
    if (identity.type === "user" && identity.user_id) {
      return true
    }

    // Service accounts can read if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity,
        "read:documents",
        "database:read",
        "documents:read"
      )
    }

    // Determine effective visibility
    const effectiveVisibility = document.visibility === "inherit" ? collection.visibility : document.visibility

    switch (effectiveVisibility) {
      case "public":
        return true // Anyone in project can read

      case "internal":
        return true // Anyone in project can read

      case "team":
        return true // Anyone in team can read

      case "private":
        // Only owner can read private documents
        return document.owner_id === identity.user_id

      default:
        return false
    }
  }

  /**
   * Check if user can write (update) a document
   */
  canWriteDocument(identity: IdentityContext, document: Document, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "documents.update")) {
      return false
    }

    // Team owners/admins always bypass document-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    const effectiveRules = this.ruleEvaluator.getEffectiveRules(document, collection)

    if (effectiveRules) {
      return this.ruleEvaluator.evaluate("update", effectiveRules, identity, {
        created_by: collection.created_by,
        owner_id: document.owner_id,
      })
    }

    // Service accounts can write if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity,
        "write:documents",
        "database:write",
        "database:update",
        "documents:write"
      )
    }

    // Check if collection is writable first
    if (!this.canWriteCollection(identity, collection)) {
      return false
    }

    // If document has an owner, only owner can write
    if (document.owner_id) {
      return document.owner_id === identity.user_id
    }

    // If no owner, follow collection visibility rules
    const effectiveVisibility = document.visibility === "inherit" ? collection.visibility : document.visibility

    switch (effectiveVisibility) {
      case "public":
      case "internal":
      case "team":
        return true // Any team member can write

      case "private":
        return false // Can't write to private doc without ownership

      default:
        return false
    }
  }

  /**
   * Check if user can delete a document
   */
  canDeleteDocument(identity: IdentityContext, document: Document, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "documents.delete")) {
      return false
    }

    // Team owners/admins always bypass document-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    const effectiveRules = this.ruleEvaluator.getEffectiveRules(document, collection)

    if (effectiveRules) {
      return this.ruleEvaluator.evaluate("delete", effectiveRules, identity, {
        created_by: collection.created_by,
        owner_id: document.owner_id,
      })
    }

    // Service accounts can delete if they have scope
    if (identity.type === "service") {
      // UPDATED: Support both old and new scope formats
      return this.hasScope(identity,
        "delete:documents",
        "database:delete",
        "documents:delete"
      )
    }

    // Document owner can always delete
    if (document.owner_id === identity.user_id) {
      return true
    }

    // Collection creator can delete any document in their collection
    if (collection.created_by === identity.user_id) {
      return true
    }

    // Admins and owners can delete any document
    return identity.roles?.includes("admin") || identity.roles?.includes("owner")
  }

  /**
   * Check if user can create documents in a collection
   */
  canCreateDocument(identity: IdentityContext, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "documents.create")) {
      return false
    }

    // Team owners/admins always bypass collection-level RLS rules
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    if (collection.permission_rules) {
      return this.ruleEvaluator.evaluate("create", collection.permission_rules, identity, {
        created_by: collection.created_by,
      })
    }

    // If the user passed the role permission gate (they have documents.create
    // in their project role permissions, or they have no custom roles assigned),
    // allow creation for any authenticated team member regardless of collection
    // visibility. Collection visibility primarily governs READ access.
    if (identity.type === "user" && identity.user_id) {
      return true
    }

    // Fallback to write permission for service accounts
    return this.canWriteCollection(identity, collection)
  }

  /**
   * Enforce collection read access
   */
  enforceCollectionRead(identity: IdentityContext, collection: Collection): void {
    if (!this.canReadCollection(identity, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to read this collection", {
        collectionId: collection.id,
        visibility: collection.visibility,
      })
    }
  }

  /**
   * Check if user can list documents in a collection.
   * This is less strict than canReadCollection for collections without RLS:
   * any authenticated user with documents.read permission can list.
   * Collections WITH RLS rules are still enforced.
   */
  canListDocuments(identity: IdentityContext, collection: Collection): boolean {
    // Coarse-grained gate
    if (!this.hasRolePermission(identity, "documents.read")) {
      return false
    }

    // Team owners/admins always bypass
    if (this.isOwnerOrAdmin(identity)) {
      return true
    }

    // If the collection has explicit RLS rules, evaluate read rules
    if (collection.permission_rules && collection.permission_rules.read) {
      return this.ruleEvaluator.evaluate("read", collection.permission_rules, identity, {
        created_by: collection.created_by,
      })
    }

    // No RLS rules: any authenticated team member can list documents
    if (identity.type === "user" && identity.user_id) {
      return true
    }

    // Service accounts: check scopes
    if (identity.type === "service") {
      return this.hasScope(identity, "read:documents", "database:read", "documents:read")
    }

    return false
  }

  /**
   * Enforce document listing access
   */
  enforceDocumentList(identity: IdentityContext, collection: Collection): void {
    if (!this.canListDocuments(identity, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to list documents in this collection", {
        collectionId: collection.id,
      })
    }
  }

  /**
   * Enforce collection write access
   */
  enforceCollectionWrite(identity: IdentityContext, collection: Collection): void {
    if (!this.canWriteCollection(identity, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to write to this collection", {
        collectionId: collection.id,
        visibility: collection.visibility,
      })
    }
  }

  /**
   * Enforce collection delete access
   */
  enforceCollectionDelete(identity: IdentityContext, collection: Collection): void {
    if (!this.canDeleteCollection(identity, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to delete this collection", {
        collectionId: collection.id,
        visibility: collection.visibility,
      })
    }
  }

  /**
   * Enforce document read access
   */
  enforceDocumentRead(identity: IdentityContext, document: Document, collection: Collection): void {
    if (!this.canReadDocument(identity, document, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to read this document", {
        documentId: document.id,
        visibility: document.visibility,
      })
    }
  }

  /**
   * Enforce document write access
   */
  enforceDocumentWrite(identity: IdentityContext, document: Document, collection: Collection): void {
    if (!this.canWriteDocument(identity, document, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to write to this document", {
        documentId: document.id,
        ownerId: document.owner_id,
      })
    }
  }

  /**
   * Enforce document delete access
   */
  enforceDocumentDelete(identity: IdentityContext, document: Document, collection: Collection): void {
    if (!this.canDeleteDocument(identity, document, collection)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to delete this document", {
        documentId: document.id,
        ownerId: document.owner_id,
      })
    }
  }

  /**
   * Get default visibility for new collections
   */
  getDefaultCollectionVisibility(identity: IdentityContext): "public" | "private" | "internal" {
    // Service accounts create public collections by default
    if (identity.type === "service" || identity.type === "api_key") {
      return "public"
    }

    // Users create private collections by default
    return "private"
  }

  /**
   * Get default visibility for new documents
   */
  getDefaultDocumentVisibility(): "inherit" {
    // Documents inherit from their collection by default
    return "inherit"
  }

  /**
   * Get creator identifier from identity
   */
  getCreatorId(identity: IdentityContext): string | undefined {
    if (identity.type === "user" && identity.user_id) {
      return identity.user_id
    }

    if (identity.type === "service" && identity.api_key_id) {
      return identity.api_key_id
    }

    return undefined
  }

  /**
   * Get owner identifier from identity (for documents)
   */
  getOwnerId(identity: IdentityContext): string | undefined {
    // Only users can own documents
    if (identity.type === "user" && identity.user_id) {
      return identity.user_id
    }

    return undefined
  }
}
