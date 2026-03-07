-- Add project_id to databases table to establish ownership chain
-- Platform User -> Project -> Database

ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS project_id UUID;

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_databases_project_id ON databases(project_id) WHERE deleted_at IS NULL;

-- Note: Foreign key constraint would require cross-database reference
-- In production with separate databases per service, enforce at application level
-- If same database, uncomment below:
-- ALTER TABLE databases 
-- ADD CONSTRAINT fk_databases_project 
-- FOREIGN KEY (project_id) 
-- REFERENCES projects(id) 
-- ON DELETE CASCADE;
