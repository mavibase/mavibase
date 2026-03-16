-- Migration: Create audit_logs table
-- Description: Central audit logging for platform + data plane actions

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope of the event (user/team/project/database/collection/document/system)
  scope VARCHAR(50) NOT NULL,

  -- Actor who performed the action (user id, api key id, or system)
  actor_id TEXT,

  -- Primary target of the action (e.g., teamId, projectId, databaseId, collectionId, documentId, userId)
  target_id TEXT,

  -- Action string (e.g., "user.login", "team.member.invite", "document.delete")
  action VARCHAR(120) NOT NULL,

  -- Arbitrary structured metadata (message, actor type USER/SYSTEM, request context, diffs, etc.)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Event time
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for querying and cleanup
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_scope_timestamp ON audit_logs(scope, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_scope_target_timestamp ON audit_logs(scope, target_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_rotation ON audit_logs(scope, actor_id, "timestamp" DESC);

-- Automatically purge old logs (keep last N days for non-user scopes)
-- NOTE: User scope rotation is enforced by application logic to allow per-user max counts.
CREATE OR REPLACE FUNCTION purge_old_audit_logs(retention_days INTEGER DEFAULT 30)
RETURNS VOID AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE scope <> 'user'
    AND "timestamp" < CURRENT_TIMESTAMP - make_interval(days => retention_days);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE audit_logs IS 'Central audit logs for control plane and data plane operations';
