-- Migration: Add project roles tables
-- These tables are for custom project-level roles (separate from team roles)

-- Project roles table
CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name VARCHAR(50) NOT NULL,
  description TEXT,
  
  -- Permissions this role grants (array of permission strings)
  permissions TEXT[] DEFAULT '{}',
  
  -- System roles vs user-created roles
  is_system BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(project_id, name)
);

-- Changed users(id) to platform_users(id) for all references
-- User project role assignments
CREATE TABLE IF NOT EXISTS user_project_roles (
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  
  -- Assignment metadata
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES platform_users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Primary key
  PRIMARY KEY (user_id, project_id, role_name)
);

-- Indexes for project_roles
CREATE INDEX idx_project_roles_project ON project_roles(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_roles_name ON project_roles(project_id, name) WHERE deleted_at IS NULL;

-- Indexes for user_project_roles
CREATE INDEX idx_user_project_roles_user ON user_project_roles(user_id, project_id);
CREATE INDEX idx_user_project_roles_project ON user_project_roles(project_id);
CREATE INDEX idx_user_project_roles_expires ON user_project_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger for project_roles updated_at
CREATE TRIGGER update_project_roles_updated_at
  BEFORE UPDATE ON project_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE project_roles IS 'Custom roles defined per project for fine-grained access control';
COMMENT ON TABLE user_project_roles IS 'Assignment of custom project roles to platform users';
COMMENT ON COLUMN user_project_roles.user_id IS 'Platform user ID (developer/admin)';
COMMENT ON COLUMN user_project_roles.role_name IS 'Custom role name like "content-editor", "moderator", etc.';
