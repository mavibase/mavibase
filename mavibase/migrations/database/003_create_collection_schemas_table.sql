-- Create collection_schemas table
CREATE TABLE IF NOT EXISTS collection_schemas (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  definition JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enforce ONLY ONE active schema per collection (partial unique index)
CREATE UNIQUE INDEX idx_unique_active_schema_per_collection
ON collection_schemas (collection_id)
WHERE is_active = true;

-- Indexes
CREATE INDEX idx_collection_schemas_collection_id
ON collection_schemas (collection_id);

CREATE INDEX idx_collection_schemas_collection_is_active
ON collection_schemas (collection_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_collection_schemas_updated_at
BEFORE UPDATE ON collection_schemas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key to collections table
ALTER TABLE collections
ADD CONSTRAINT fk_collections_schema_id
FOREIGN KEY (schema_id)
REFERENCES collection_schemas(id)
ON DELETE SET NULL;
