-- Create index_metadata table to track dynamic indexes
CREATE TABLE IF NOT EXISTS index_metadata (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  index_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, creating, active, failed
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_index_per_field UNIQUE(collection_id, field_name)
);

-- Create indexes
CREATE INDEX idx_index_metadata_collection_id ON index_metadata(collection_id);
CREATE INDEX idx_index_metadata_status ON index_metadata(status);

-- Create trigger for index_metadata
CREATE TRIGGER update_index_metadata_updated_at
  BEFORE UPDATE ON index_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
