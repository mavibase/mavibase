-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  schema_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_documents_collection_id ON documents(collection_id);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX idx_documents_data_gin ON documents USING GIN(data);
CREATE INDEX idx_documents_collection_active ON documents(collection_id) WHERE deleted_at IS NULL;

-- Create trigger for documents
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
