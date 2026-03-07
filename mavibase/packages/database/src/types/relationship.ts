export type RelationshipType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
export type OnDeleteAction = 'cascade' | 'setNull' | 'restrict';

export interface Relationship {
  id: string;
  database_id: string;
  source_collection_id: string;
  source_field: string;
  target_collection_id: string;
  target_field?: string;
  type: RelationshipType;
  cascade_delete?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RelationshipConfig {
  type: RelationshipType;
  relatedCollection: string;
  sourceCollection?: string;
  targetCollection?: string;
  sourceField?: string;
  targetField?: string;
  cascadeDelete?: boolean;
  onDelete: OnDeleteAction;
  twoWay: boolean;
  twoWayKey?: string;
  side?: 'parent' | 'child';
}
