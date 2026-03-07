-- Migration 016: Add project_id to collections for proper isolation
-- This ensures collections are properly scoped to projects

-- Add column (nullable first for backfill)
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

-- Backfill project_id from databases table
UPDATE collections c
SET project_id = d.project_id
FROM databases d
WHERE c.database_id = d.id
AND c.project_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE collections 
  ALTER COLUMN project_id SET NOT NULL;

-- Create index for efficient project-scoped queries
CREATE INDEX IF NOT EXISTS idx_collections_project_id 
  ON collections(project_id) 
  WHERE deleted_at IS NULL;

-- Create composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_collections_project_database 
  ON collections(project_id, database_id) 
  WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN collections.project_id IS 'Project ID from Platform-Auth for isolation and access control';
