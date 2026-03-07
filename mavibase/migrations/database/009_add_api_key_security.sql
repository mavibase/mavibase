-- Add API key security fields to databases table
ALTER TABLE databases
ADD COLUMN key_hash VARCHAR(255),
ADD COLUMN key_prefix VARCHAR(10),
ADD COLUMN last_used_at TIMESTAMP,
ADD COLUMN revoked_at TIMESTAMP;

-- Create index for key_hash lookups
CREATE INDEX idx_databases_key_hash ON databases(key_hash) WHERE deleted_at IS NULL AND revoked_at IS NULL;

-- Create api_keys table for multiple keys per database
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_keys table
CREATE INDEX idx_api_keys_database_id ON api_keys(database_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_api_keys_name_database ON api_keys(database_id, name) WHERE revoked_at IS NULL;

-- Create trigger for api_keys
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing keys to hashed format (this will require manual key regeneration)
-- For now, we'll keep the plaintext key column for backward compatibility
-- Production deployment should remove this column after migration
