-- Migration: Recalculate database quota usage fields
-- Brings current_collections, current_documents, and current_storage_bytes
-- into sync with the actual live (non-soft-deleted) data.

-- Recalculate quotas for all non-deleted databases.
UPDATE databases db
SET
  current_collections = sub.collection_count,
  current_documents   = sub.document_count,
  current_storage_bytes = sub.storage_bytes
FROM (
  SELECT
    d.id AS database_id,
    -- Only count collections that are not soft-deleted
    (
      SELECT COUNT(*)
      FROM collections c
      WHERE c.database_id = d.id
        AND c.deleted_at IS NULL
    ) AS collection_count,
    -- Only count documents whose collection and document are not soft-deleted
    (
      SELECT COUNT(*)
      FROM documents doc
      JOIN collections c2 ON doc.collection_id = c2.id
      WHERE c2.database_id = d.id
        AND doc.deleted_at IS NULL
        AND c2.deleted_at IS NULL
    ) AS document_count,
    -- Approximate storage from live documents only
    (
      SELECT COALESCE(SUM(LENGTH(doc2.data::text)), 0)
      FROM documents doc2
      JOIN collections c3 ON doc2.collection_id = c3.id
      WHERE c3.database_id = d.id
        AND doc2.deleted_at IS NULL
        AND c3.deleted_at IS NULL
    ) AS storage_bytes
  FROM databases d
  WHERE d.deleted_at IS NULL
) AS sub
WHERE db.id = sub.database_id
  AND db.deleted_at IS NULL;

