import type { PermissionRules } from './permission';

export interface Collection {
  id: string;
  database_id: string;
  project_id?: string;
  team_id?: string;
  name: string;
  key: string;
  description?: string;
  created_by?: string;
  visibility?: 'public' | 'private' | 'internal' | 'team';
  permission_rules?: PermissionRules;
  schema_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CollectionSchema {
  id: string;
  collection_id: string;
  definition: SchemaDefinition;
  version: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SchemaDefinition {
  fields: SchemaField[];
  strict?: boolean;
  timestamps?: boolean;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'datetime' | 'email' | 'url' | 'ip' | 'enum' | 'object' | 'array' | 'relationship';
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  default?: any;
  array?: boolean;
  validation?: SchemaValidation;
  description?: string;
  // For relationship type
  relationship?: {
    type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
    relatedCollection: string;
    twoWay?: boolean;
    twoWayKey?: string;
    onDelete?: 'cascade' | 'setNull' | 'restrict';
    side?: 'parent' | 'child';
  };
  relationTo?: string;
  relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  // For array type
  arrayOf?: 'string' | 'number' | 'object';
}

export interface ObjectProperty {
  key: string;
  type: 'string' | 'number' | 'integer' | 'float' | 'boolean';
  required?: boolean;
}

export interface SchemaValidation {
  min?: number;
  max?: number;
  size?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  enum?: any[];
  custom?: string;
  customMessage?: string;
  // For object type - define expected properties and their types
  properties?: ObjectProperty[];
  // For array type - define the type of items in the array
  arrayItemType?: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'object';
}

export interface CollectionIndex {
  id: string;
  collection_id: string;
  field_name: string;
  field_names?: string[];
  index_name?: string;
  index_type?: 'btree' | 'hash' | 'gin' | 'gist';
  is_unique?: boolean;
  created_at: Date;
}
