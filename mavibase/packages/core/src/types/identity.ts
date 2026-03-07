export interface IdentityContext {
  type: 'api_key' | 'user'
  api_key_id?: string
  user_id?: string
  project_id: string
  team_id?: string
  scopes: string[]
  roles?: string[]
  project_roles?: string[]
  created_at?: Date
}
