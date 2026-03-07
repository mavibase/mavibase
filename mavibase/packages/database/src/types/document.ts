import type { PermissionRules } from './permission';

export interface Document {
  id: string;
  collection_id: string;
  team_id?: string;
  data: Record<string, any>;
  schema_version?: number;
  version: number;
  owner_id?: string;
  visibility?: 'public' | 'private' | 'internal' | 'inherit';
  permission_rules?: PermissionRules;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  collection_id: string;
  data: Record<string, any>;
  schema_version?: number;
  version: number;
  created_at: Date;
}
