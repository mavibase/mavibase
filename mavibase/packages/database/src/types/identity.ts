export interface IdentityContext {
  type: 'user' | 'api_key' | 'service' | 'anonymous';
  userId?: string;
  user_id?: string;
  teamId?: string;
  team_id?: string;
  projectId?: string;
  project_id?: string;
  apiKeyId?: string;
  api_key_id?: string;
  app_id?: string;
  roles?: string[];
  project_roles?: string[];
  permissions?: string[];
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  project_id?: string;
  database_id?: string;
  team_id?: string;
  scopes: string[];
  rate_limit?: number;
  expires_at?: Date;
  last_used_at?: Date;
  revoked_at?: Date;
  created_at: Date;
  updated_at: Date;
}
