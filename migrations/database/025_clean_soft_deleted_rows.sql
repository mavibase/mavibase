-- Migration: Clean up legacy soft-deleted rows
-- Physically remove databases, collections, and documents that were previously
-- marked as deleted via deleted_at but kept for soft-delete semantics.

-- Delete soft-deleted documents first (they depend on collections).
DELETE FROM documents
WHERE deleted_at IS NOT NULL;

-- Delete soft-deleted collections (they depend on databases).
DELETE FROM collections
WHERE deleted_at IS NOT NULL;

-- Delete soft-deleted databases (root entities).
DELETE FROM databases
WHERE deleted_at IS NOT NULL;

