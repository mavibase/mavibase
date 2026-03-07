-- Migration: Add usage tracking and enhanced quotas
-- This enables resource monitoring and quota enforcement based on actual usage

-- Only adding columns that don't already exist in the teams table
-- Add additional usage tracking columns to teams table (quota columns already exist from 008)
ALTER TABLE teams 
  ADD COLUMN IF NOT EXISTS current_storage_gb DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_database_gb DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_documents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_monthly_active_users INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_api_requests BIGINT DEFAULT 0;

-- Create usage_metrics table for detailed tracking
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service VARCHAR(50) NOT NULL, -- 'database', 'auth', 'storage'
  
  -- Metrics (JSONB for flexibility - each service reports different metrics)
  metrics JSONB NOT NULL,
  
  -- Removed DEFAULT from reported_at and made year/month computed from it
  -- Timestamp
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Period tracking (for monthly rollups)
year INTEGER GENERATED ALWAYS AS (
  EXTRACT(YEAR FROM reported_at AT TIME ZONE 'UTC')::INTEGER
) STORED,
month INTEGER GENERATED ALWAYS AS (
  EXTRACT(MONTH FROM reported_at AT TIME ZONE 'UTC')::INTEGER
) STORED

);

-- Indexes for usage_metrics
CREATE INDEX idx_usage_metrics_team ON usage_metrics(team_id);
CREATE INDEX idx_usage_metrics_project ON usage_metrics(project_id);
CREATE INDEX idx_usage_metrics_service ON usage_metrics(service);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(team_id, year, month);
CREATE INDEX idx_usage_metrics_reported ON usage_metrics(reported_at);

-- Comments
COMMENT ON TABLE usage_metrics IS 'Detailed usage metrics reported by services for resource monitoring and quota enforcement';
COMMENT ON COLUMN teams.current_storage_gb IS 'Current storage usage in gigabytes (updated by Storage Service)';
COMMENT ON COLUMN teams.current_database_gb IS 'Current database storage in gigabytes (updated by Database Service)';
COMMENT ON COLUMN teams.current_monthly_active_users IS 'Current MAU (updated by Auth Service)';
