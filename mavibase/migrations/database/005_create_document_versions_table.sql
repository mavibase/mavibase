-- Create document_versions table (append-only, no updates)
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  schema_version INTEGER,
  version INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id, version DESC);
CREATE INDEX idx_document_versions_collection_id ON document_versions(collection_id);
CREATE INDEX idx_document_versions_created_at ON document_versions(created_at DESC);

-- Create unique constraint on document_id + version
CREATE UNIQUE INDEX idx_document_versions_unique_version ON document_versions(document_id, version);
