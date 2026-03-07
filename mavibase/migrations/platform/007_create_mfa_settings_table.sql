-- Migration: Create mfa_settings table
-- Description: Multi-factor authentication settings for platform users

CREATE TABLE IF NOT EXISTS mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  
  -- TOTP settings
  enabled BOOLEAN DEFAULT FALSE,
  secret VARCHAR(255),
  backup_codes TEXT[], -- Encrypted backup codes
  
  -- Timestamps
  enabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX idx_mfa_settings_enabled ON mfa_settings(enabled);

CREATE TRIGGER update_mfa_settings_updated_at
  BEFORE UPDATE ON mfa_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
