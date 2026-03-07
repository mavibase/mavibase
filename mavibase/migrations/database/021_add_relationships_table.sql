-- Migration: Add relationships table
-- This table stores metadata about relationships between collections

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY,

  source_collection_id UUID NOT NULL
    REFERENCES collections(id)
    ON DELETE CASCADE,

  source_attribute VARCHAR(255) NOT NULL,

  target_collection_id UUID NOT NULL
    REFERENCES collections(id)
    ON DELETE CASCADE,

  target_attribute VARCHAR(255), -- For two-way relationships

  type VARCHAR(50) NOT NULL CHECK (
    type IN ('oneToOne', 'oneToMany', 'manyToOne', 'manyToMany')
  ),

  on_delete VARCHAR(50) NOT NULL CHECK (
    on_delete IN ('cascade', 'setNull', 'restrict')
  ),

  two_way BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Ensure unique relationship per source attribute
  CONSTRAINT unique_source_relationship
    UNIQUE (source_collection_id, source_attribute)
);

-- ============================
-- Indexes (PostgreSQL-style)
-- ============================

CREATE INDEX IF NOT EXISTS idx_relationships_source
  ON relationships (source_collection_id, source_attribute);

CREATE INDEX IF NOT EXISTS idx_relationships_target
  ON relationships (target_collection_id);

CREATE INDEX IF NOT EXISTS idx_relationships_two_way
  ON relationships (source_collection_id, target_collection_id, two_way);

-- ============================
-- Comments / Documentation
-- ============================

COMMENT ON TABLE relationships
IS 'Stores relationship metadata between collections';

COMMENT ON COLUMN relationships.source_collection_id
IS 'Collection where the relationship originates';

COMMENT ON COLUMN relationships.source_attribute
IS 'Attribute in the source collection representing the relationship';

COMMENT ON COLUMN relationships.target_collection_id
IS 'Target collection being referenced';

COMMENT ON COLUMN relationships.target_attribute
IS 'Optional back-reference attribute in target collection';

COMMENT ON COLUMN relationships.type
IS 'Relationship type: oneToOne, oneToMany, manyToOne, manyToMany';

COMMENT ON COLUMN relationships.on_delete
IS 'Action when referenced document is deleted: cascade, setNull, restrict';

COMMENT ON COLUMN relationships.two_way
IS 'Whether this relationship has a back-reference in the target collection';
