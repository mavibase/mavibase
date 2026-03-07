-- Migration: Create slow_query_logs table
-- Stores slow query events for monitoring and optimization

CREATE TABLE IF NOT EXISTS slow_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  project_id TEXT,
  query_sql TEXT NOT NULL,
  query_params TEXT,
  duration_ms INTEGER NOT NULL,
  threshold_ms INTEGER NOT NULL DEFAULT 1000,
  operation TEXT,          -- e.g. 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  resource TEXT,           -- e.g. table/collection name
  suggestion TEXT,         -- auto-generated optimization suggestion
  in_transaction BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_database ON slow_query_logs(database_id);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_collection ON slow_query_logs(collection_id);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_project ON slow_query_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_created ON slow_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_duration ON slow_query_logs(duration_ms DESC);

-- Automatically purge old logs (keep last 30 days)
-- This can be run as a scheduled job
CREATE OR REPLACE FUNCTION purge_old_slow_query_logs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM slow_query_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE slow_query_logs IS 'Stores slow query events detected by QueryExecutor for monitoring and optimization';
