-- Migration: Create login_attempts table
-- Description: Track failed login attempts for brute-force protection

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rate limiting queries
CREATE INDEX idx_login_attempts_email_created ON login_attempts(email, created_at);
CREATE INDEX idx_login_attempts_ip_created ON login_attempts(ip_address, created_at);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);
