-- Add quota and usage columns to databases table
ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS max_collections INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_documents_per_collection INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS max_storage_bytes BIGINT DEFAULT 104857600, -- 100MB default
ADD COLUMN IF NOT EXISTS current_collections INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_documents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_storage_bytes BIGINT DEFAULT 0;

-- Create indexes for quota checks
CREATE INDEX IF NOT EXISTS idx_databases_quotas ON databases(current_collections, current_documents, current_storage_bytes);
