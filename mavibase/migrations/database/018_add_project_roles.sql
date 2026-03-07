-- Migration 018: Add custom project-level roles
-- Allows projects to define custom roles beyond the standard Platform-Auth team roles
-- Example: "content-editor", "moderator", "analyst"

-- Project-level custom roles
CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  
  -- Permissions this role grants (for future use)
  permissions TEXT[] DEFAULT '{}',
  
  -- System vs user-defined
  is_system BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  -- Unique role names per project
  CONSTRAINT unique_project_role_name UNIQUE(project_id, name)
);

CREATE INDEX idx_project_roles_project ON project_roles(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_roles_name ON project_roles(project_id, name) WHERE deleted_at IS NULL;

-- User role assignments (which end-users have which project roles)
CREATE TABLE IF NOT EXISTS user_project_roles (
  user_id VARCHAR(255) NOT NULL,  -- End-user ID from Auth Service
  project_id VARCHAR(255) NOT NULL,
  role_name VARCHAR(50) NOT NULL,
  
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(255),  -- Who assigned this role
  expires_at TIMESTAMP,  -- Optional expiry
  
  PRIMARY KEY (user_id, project_id, role_name)
);

CREATE INDEX idx_user_project_roles_user ON user_project_roles(user_id, project_id);
CREATE INDEX idx_user_project_roles_project ON user_project_roles(project_id);
CREATE INDEX idx_user_project_roles_expires ON user_project_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Create trigger for project_roles updated_at
CREATE TRIGGER update_project_roles_updated_at
  BEFORE UPDATE ON project_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE project_roles IS 'Custom roles defined per project for fine-grained access control';
COMMENT ON TABLE user_project_roles IS 'Assignment of custom project roles to end-users';
COMMENT ON COLUMN user_project_roles.user_id IS 'End-user ID from Auth Service (NOT Platform-Auth developer)';
