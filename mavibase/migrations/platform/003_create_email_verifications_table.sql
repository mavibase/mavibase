-- Migration: Create email_verifications table
-- Description: Email verification tokens for new platform user signups

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_token_hash ON email_verifications(token_hash);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
