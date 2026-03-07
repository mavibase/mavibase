-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  description TEXT,
  schema_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  CONSTRAINT unique_collection_key_per_database UNIQUE(database_id, key)
);

-- Create indexes
CREATE INDEX idx_collections_database_id ON collections(database_id);
CREATE INDEX idx_collections_deleted_at ON collections(deleted_at);
CREATE INDEX idx_collections_key ON collections(database_id, key) WHERE deleted_at IS NULL;

-- Create trigger for collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
