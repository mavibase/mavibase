-- Migration 014: Add document-level permissions
-- This enables Row-Level Security (RLS) with Appwrite-style permissions

ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS permission_rules JSONB DEFAULT NULL;

-- Create GIN index for efficient permission queries
CREATE INDEX IF NOT EXISTS idx_documents_permission_rules 
  ON documents USING GIN(permission_rules) 
  WHERE permission_rules IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN documents.permission_rules IS 'Document-level permission rules in format: {"read": ["any"], "update": ["owner"], "delete": ["user:xyz"]}';
