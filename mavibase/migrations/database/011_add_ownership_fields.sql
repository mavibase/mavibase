-- Add ownership and visibility fields to collections
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'team'));

-- Add ownership and visibility fields to documents  
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'inherit' CHECK (visibility IN ('public', 'private', 'inherit'));

-- Create indexes for ownership queries
CREATE INDEX IF NOT EXISTS idx_collections_created_by ON collections(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_visibility ON collections(visibility) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility) WHERE deleted_at IS NULL;

-- Add composite indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_collections_database_visibility ON collections(database_id, visibility) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_collection_owner ON documents(collection_id, owner_id) WHERE deleted_at IS NULL;
