-- Migration: Create platform_users table
-- Description: Platform admins who manage teams, projects, and resources
-- This is the control plane - NOT end-user auth

CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  username VARCHAR(50) UNIQUE,
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  -- Added default_team_id to track user's personal team
  default_team_id UUID,
  
  -- UI/UX state management (which team/project user is currently viewing)
  selected_team_id UUID,
  selected_project_id UUID,
  
  -- Account status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  
  -- Security
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_login_ip INET,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_platform_users_email ON platform_users(email);
CREATE INDEX idx_platform_users_status ON platform_users(status);
CREATE INDEX idx_platform_users_selected_team ON platform_users(selected_team_id);
CREATE INDEX idx_platform_users_selected_project ON platform_users(selected_project_id);
-- Added index for default_team_id
CREATE INDEX idx_platform_users_default_team ON platform_users(default_team_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_users_updated_at
  BEFORE UPDATE ON platform_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
