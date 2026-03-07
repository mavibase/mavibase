-- Migration: Create project_members table
-- Description: Project-level RBAC (separate from team roles)
-- This is CRITICAL: Team role ≠ Project role
-- Team roles control billing/governance, Project roles control operational permissions

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  
  -- Project-specific role (NOT inherited from team)
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
  
  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- A user can only have one role per project
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);

CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent removing last owner
CREATE OR REPLACE FUNCTION prevent_last_project_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    -- Check if there are other owners
    IF (SELECT COUNT(*) FROM project_members 
        WHERE project_id = OLD.project_id AND role = 'owner' AND id != OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner from a project';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_last_project_owner
  BEFORE DELETE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_project_owner_removal();

-- Also prevent role change if last owner
CREATE OR REPLACE FUNCTION prevent_last_project_owner_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    -- Check if there are other owners
    IF (SELECT COUNT(*) FROM project_members 
        WHERE project_id = OLD.project_id AND role = 'owner' AND id != OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot change role of the last owner. Promote another member first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_last_project_owner_role_change
  BEFORE UPDATE OF role ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_project_owner_role_change();
