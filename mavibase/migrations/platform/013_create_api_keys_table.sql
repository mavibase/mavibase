-- Migration: Create api_keys table
-- Description: API keys scoped to projects (this is the security boundary)

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- API key details
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- e.g., "sk_live_XXXX", "pk_test_XXXX"
  
  -- Using HMAC-SHA256 with server pepper for security
  -- key_hash = HMAC-SHA256(SERVER_PEPPER, raw_key)
  -- This prevents offline brute-force attacks
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  
  -- Scopes and permissions
  scopes TEXT[] DEFAULT '{}', -- e.g., ['database:read', 'storage:write']
  
  -- Key type
  key_type VARCHAR(50) NOT NULL CHECK (key_type IN ('public', 'secret', 'service')),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Added expiration support
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
