-- Migration: Create sessions table
-- Description: JWT session tracking for platform users

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  
  -- Session tokens (hashed)
  access_token_hash VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
  
  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Expiration
  access_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token_hash ON sessions(access_token_hash) WHERE NOT revoked;
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash) WHERE NOT revoked;
CREATE INDEX idx_sessions_expires_at ON sessions(refresh_token_expires_at);
CREATE INDEX idx_sessions_revoked ON sessions(revoked);
