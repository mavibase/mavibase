-- Add project_id to api_keys for better tracking
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS project_id UUID;

CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id) WHERE revoked_at IS NULL;
