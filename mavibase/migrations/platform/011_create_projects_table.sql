-- Migration: Create projects table
-- Description: Projects are the primary security boundary (like Supabase projects or Appwrite projects)

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Project details
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Added environment field for prod/staging/dev separation
  environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),
  
  -- Project region/infrastructure
  region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: slug must be unique within a team, not globally
  UNIQUE(team_id, slug)
);

-- Indexes
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_slug ON projects(team_id, slug);
CREATE INDEX idx_projects_environment ON projects(environment);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to platform_users.selected_project_id
ALTER TABLE platform_users
  ADD CONSTRAINT fk_platform_users_selected_project
  FOREIGN KEY (selected_project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Add foreign key constraint to platform_users.selected_team_id
ALTER TABLE platform_users
  ADD CONSTRAINT fk_platform_users_selected_team
  FOREIGN KEY (selected_team_id) REFERENCES teams(id) ON DELETE SET NULL;
