-- Migration 017: Add team_id to all tables for billing and quota tracking
-- Critical for associating resources with paying customers

-- Add team_id to databases
ALTER TABLE databases 
  ADD COLUMN IF NOT EXISTS team_id VARCHAR(255);

-- Add team_id to collections
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS team_id VARCHAR(255);

-- Add team_id to documents
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS team_id VARCHAR(255);

-- NOTE: Backfill will require calling Platform-Auth API
-- This should be done via a separate script:
-- 1. Get all unique project_ids
-- 2. Call Platform-Auth API: GET /internal/projects/{project_id} -> returns team_id
-- 3. Update all tables with team_id
-- 
-- Example backfill (run after getting team_id mappings):
-- UPDATE databases SET team_id = 'team_xxx' WHERE project_id = 'proj_yyy';
-- UPDATE collections SET team_id = 'team_xxx' WHERE project_id = 'proj_yyy';
-- UPDATE documents d SET team_id = 'team_xxx' FROM collections c WHERE d.collection_id = c.id AND c.project_id = 'proj_yyy';

-- After backfill, uncomment these to make NOT NULL:
-- ALTER TABLE databases ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE collections ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE documents ALTER COLUMN team_id SET NOT NULL;

-- Create indexes for billing and quota queries
CREATE INDEX IF NOT EXISTS idx_databases_team_id ON databases(team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_team_id ON collections(team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_team_id ON documents(team_id) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_databases_team_project ON databases(team_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_team_project ON collections(team_id, project_id) WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN databases.team_id IS 'Team ID from Platform-Auth for billing and quota tracking';
COMMENT ON COLUMN collections.team_id IS 'Team ID from Platform-Auth for billing aggregation';
COMMENT ON COLUMN documents.team_id IS 'Team ID from Platform-Auth for usage tracking';
