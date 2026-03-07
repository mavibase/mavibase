-- Migration: Create usage_events table
-- Description: Detailed usage tracking for resource monitoring and analytics

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Event details
  metric VARCHAR(100) NOT NULL, -- Same as project_usage.metric
  delta BIGINT NOT NULL, -- Amount to add/subtract
  
  -- Optional context
  resource_type VARCHAR(100), -- e.g., 'database', 'storage', 'function'
  resource_id UUID,
  
  -- Metadata for debugging/analytics
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_usage_events_project_id ON usage_events(project_id);
CREATE INDEX idx_usage_events_metric ON usage_events(metric);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_resource ON usage_events(resource_type, resource_id);

-- Partitioning by month for better performance (optional, for scale)
-- ALTER TABLE usage_events PARTITION BY RANGE (created_at);
