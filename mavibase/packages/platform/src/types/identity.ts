export interface IdentityContext {
  type: "user" | "service"
  user_id?: string
  api_key_id?: string
  project_id: string
  team_id: string
  role?: string
  scopes: string[]
  project_roles?: string[]
  /** Unified roles array: team role + custom project roles (used by AuthorizationPolicy) */
  roles?: string[]
  /** Aggregated permission strings from all assigned roles (e.g. "documents.create") */
  permissions?: string[]
}
