-- Migration: Create teams table
-- Description: Teams (organizations) that own projects

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  
  -- Team details
  description TEXT,
  avatar_url TEXT,
  is_personal BOOLEAN DEFAULT FALSE,
  
  -- Resource tier (determines quota limits)
  tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise', 'custom')),
  
  -- Quota limits (enforced at team level, tracked per project)
  quota_projects INTEGER DEFAULT 3,
  quota_api_requests_monthly BIGINT DEFAULT 1000000,
  quota_storage_gb INTEGER DEFAULT 10,
  quota_bandwidth_gb INTEGER DEFAULT 100,
  
  -- Usage tracking (aggregated from all projects)
  current_projects_count INTEGER DEFAULT 0,
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_tier ON teams(tier);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Added trigger to update project count when projects are created/deleted
CREATE OR REPLACE FUNCTION update_team_project_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE teams SET current_projects_count = current_projects_count + 1 WHERE id = NEW.team_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    UPDATE teams SET current_projects_count = current_projects_count - 1 WHERE id = OLD.team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
