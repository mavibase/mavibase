-- Add permission_rules JSONB column to collections table
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS permission_rules JSONB DEFAULT NULL;

-- Add permission_rules JSONB column to documents table (optional override)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS permission_rules JSONB DEFAULT NULL;

-- Create indexes for permission rules queries
CREATE INDEX IF NOT EXISTS idx_collections_permission_rules ON collections USING gin(permission_rules) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_permission_rules ON documents USING gin(permission_rules) WHERE deleted_at IS NULL;

-- Add comment explaining the permission_rules structure
COMMENT ON COLUMN collections.permission_rules IS 'JSONB permission rules: {"read": ["any"], "create": ["user:{user_id}"], "update": ["role:admin"], "delete": ["owner"]}';
COMMENT ON COLUMN documents.permission_rules IS 'JSONB permission rules (optional override): {"read": ["any"], "update": ["user:{user_id}"], "delete": ["owner"]}';
