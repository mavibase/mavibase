-- 006: Create 2FA Codes Table (Email-based 2FA)
-- This table stores temporary OTP codes sent via email

CREATE TABLE IF NOT EXISTS two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  code_hash VARCHAR(255) NOT NULL, -- Hashed version for verification
  purpose VARCHAR(20) NOT NULL DEFAULT 'login', -- 'login', 'setup', 'disable'
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

-- Indexes
CREATE INDEX idx_2fa_codes_user_id ON two_factor_codes(user_id);
CREATE INDEX idx_2fa_codes_expires ON two_factor_codes(expires_at);
CREATE INDEX idx_2fa_codes_code_hash ON two_factor_codes(code_hash);

-- Auto-delete expired codes (cleanup job)
CREATE INDEX idx_2fa_codes_cleanup ON two_factor_codes(expires_at) WHERE used_at IS NULL;

-- Ensure user exists in platform_users
COMMENT ON TABLE two_factor_codes IS 'Stores email-based 2FA OTP codes with 10-minute expiration';
