-- Migration: Add project_services table
-- This table tracks which services are enabled for each project

CREATE TABLE IF NOT EXISTS project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Service name: 'database', 'auth', 'storage', etc.
  service_name VARCHAR(50) NOT NULL,
  
  -- Is this service enabled?
  enabled BOOLEAN DEFAULT true,
  
  -- Service-specific configuration (JSONB for flexibility)
  config JSONB DEFAULT '{}',
  
  -- Using TIMESTAMP WITH TIME ZONE for consistency with other tables
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(project_id, service_name)
);

-- Indexes
CREATE INDEX idx_project_services_project ON project_services(project_id);
CREATE INDEX idx_project_services_enabled ON project_services(project_id, enabled) WHERE enabled = true;

-- Trigger for updated_at
CREATE TRIGGER update_project_services_updated_at
  BEFORE UPDATE ON project_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE project_services IS 'Tracks which services (database, auth, storage) are enabled per project';
COMMENT ON COLUMN project_services.service_name IS 'Service identifier: database, auth, storage, etc.';
COMMENT ON COLUMN project_services.config IS 'Service-specific configuration in JSON format';
