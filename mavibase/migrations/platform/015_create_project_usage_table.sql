-- Migration: Create project_usage table
-- Description: Track resource usage and quotas per project (for abuse prevention and fair resource allocation)

CREATE TABLE IF NOT EXISTS project_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Metric being tracked
  metric VARCHAR(100) NOT NULL, -- e.g., 'db_storage_bytes', 'api_calls', 'egress_bytes', 'function_invocations'
  
  -- Current value
  value BIGINT NOT NULL DEFAULT 0,
  
  -- Optional quota limit (NULL = unlimited)
  quota_limit BIGINT,
  
  -- Timestamps
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reset_at TIMESTAMP WITH TIME ZONE, -- For monthly/daily resets
  
  -- Unique constraint: one row per project+metric
  UNIQUE(project_id, metric)
);

-- Indexes
CREATE INDEX idx_project_usage_project_id ON project_usage(project_id);
CREATE INDEX idx_project_usage_metric ON project_usage(metric);
CREATE INDEX idx_project_usage_over_quota ON project_usage(project_id, metric) 
  WHERE quota_limit IS NOT NULL AND value >= quota_limit;

-- Trigger to update timestamp
CREATE TRIGGER update_project_usage_updated_at
  BEFORE UPDATE ON project_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage safely
CREATE OR REPLACE FUNCTION increment_project_usage(
  p_project_id UUID,
  p_metric VARCHAR(100),
  p_delta BIGINT
) RETURNS BIGINT AS $$
DECLARE
  new_value BIGINT;
BEGIN
  INSERT INTO project_usage (project_id, metric, value)
  VALUES (p_project_id, p_metric, p_delta)
  ON CONFLICT (project_id, metric)
  DO UPDATE SET 
    value = project_usage.value + p_delta,
    updated_at = CURRENT_TIMESTAMP
  RETURNING value INTO new_value;
  
  RETURN new_value;
END;
$$ LANGUAGE plpgsql;
