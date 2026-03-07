// Relationship types and interfaces

export type RelationshipType = "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany"

export type OnDeleteAction = "cascade" | "setNull" | "restrict"

export interface RelationshipAttribute extends BaseAttribute {
  type: "relationship"
  relationship: RelationshipConfig
}

export interface RelationshipConfig {
  type: RelationshipType
  relatedCollection: string  // Collection ID or key to link to
  twoWay: boolean  // Create back-reference in related collection
  twoWayKey?: string  // Name of the back-reference field
  onDelete: OnDeleteAction  // What to do when referenced document is deleted
  side: "parent" | "child"  // Which side of the relationship this is
}

interface BaseAttribute {
  name: string
  required?: boolean
  indexed?: boolean
}

// Relationship metadata stored in schema
export interface RelationshipMeta {
  id: string
  source_collection_id: string
  source_attribute: string
  target_collection_id: string
  target_attribute?: string  // For two-way relationships
  type: RelationshipType
  on_delete: OnDeleteAction
  two_way: boolean
  created_at: Date
}
