export * from './identity'
export * from './relationship'

// Re-export commonly used types with explicit names for better compatibility
export type { IdentityContext } from './identity'
export type { 
  RelationshipType, 
  OnDeleteAction, 
  RelationshipAttribute, 
  RelationshipConfig, 
  RelationshipMeta 
} from './relationship'

// Export permission types (these can be imported as placeholders; real implementation in database package)
export type PermissionTarget = 'any' | 'none' | 'owner' | `user:${string}` | `team:${string}` | `role:${string}` | `scope:${string}`;

export interface Document {
  id: string;
  collection_id: string;
  team_id?: string;
  data: Record<string, any>;
  schema_version?: number;
  version: number;
  owner_id?: string;
  visibility?: 'public' | 'private' | 'internal' | 'inherit';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}
