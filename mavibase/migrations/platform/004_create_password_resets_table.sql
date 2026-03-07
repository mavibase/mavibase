-- Migration: Create password_resets table
-- Description: Password reset tokens for platform users

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_expires_at ON password_resets(expires_at);
