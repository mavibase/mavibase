-- Migration 015: Add collection-level permission rules
-- Collections can have default permission rules that documents inherit

ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS permission_rules JSONB DEFAULT NULL;

-- Create GIN index for permission queries
CREATE INDEX IF NOT EXISTS idx_collections_permission_rules 
  ON collections USING GIN(permission_rules) 
  WHERE permission_rules IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN collections.permission_rules IS 'Collection-level permission rules. Documents can override these or inherit them.';
