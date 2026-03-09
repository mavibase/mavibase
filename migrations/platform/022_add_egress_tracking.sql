-- Migration: Add egress tracking for API-key authenticated requests
-- Description: Track bandwidth egress per project for billing and monitoring

-- Create egress_events table for detailed tracking
CREATE TABLE IF NOT EXISTS egress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Egress data
  bytes BIGINT NOT NULL DEFAULT 0,
  endpoint VARCHAR(255), -- e.g., '/api/v1/db/databases/:id/collections/:id/documents'
  method VARCHAR(10), -- GET, POST, etc.
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Period tracking (for monthly rollups)
  year INTEGER GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC')::INTEGER
  ) STORED,
  month INTEGER GENERATED ALWAYS AS (
    EXTRACT(MONTH FROM created_at AT TIME ZONE 'UTC')::INTEGER
  ) STORED
);

-- Indexes for egress_events
CREATE INDEX IF NOT EXISTS idx_egress_events_project ON egress_events(project_id);
CREATE INDEX IF NOT EXISTS idx_egress_events_api_key ON egress_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_egress_events_period ON egress_events(project_id, year, month);
CREATE INDEX IF NOT EXISTS idx_egress_events_created ON egress_events(created_at);

-- Add current_egress_bytes column to teams table for quick access
ALTER TABLE teams 
  ADD COLUMN IF NOT EXISTS current_egress_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS egress_reset_at TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', CURRENT_TIMESTAMP);

-- Comments
COMMENT ON TABLE egress_events IS 'Detailed egress events from API-key authenticated requests';
COMMENT ON COLUMN egress_events.bytes IS 'Response body size in bytes';
COMMENT ON COLUMN teams.current_egress_bytes IS 'Current monthly egress in bytes (reset monthly)';
