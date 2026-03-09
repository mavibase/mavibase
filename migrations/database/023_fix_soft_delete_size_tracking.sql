-- Migration: Fix size tracking for soft-deleted documents and collections
-- Ensures that when resources are soft-deleted (deleted_at set), their size
-- is no longer counted towards database size_* metrics.

-- Update document size trigger function to treat deleted_at changes as
-- logical deletes/restores for size accounting.
CREATE OR REPLACE FUNCTION update_document_size()
RETURNS TRIGGER AS $$
DECLARE
  old_size BIGINT := 0;
  new_size BIGINT := 0;
  db_id UUID;
BEGIN
  -- Get database_id through collection
  SELECT c.database_id INTO db_id
  FROM collections c
  WHERE c.id = COALESCE(NEW.collection_id, OLD.collection_id);

  IF TG_OP = 'INSERT' THEN
    -- Calculate size of new document
    new_size := calculate_jsonb_size(NEW.data) +
                calculate_text_size(NEW.id::TEXT) +
                100; -- Overhead for metadata (id, timestamps, etc.)

    NEW.size_bytes := new_size;

    -- Only count non-deleted documents towards size
    IF NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_documents_bytes = size_documents_bytes + new_size
      WHERE id = db_id;

      PERFORM update_database_total_size(db_id);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    old_size := COALESCE(OLD.size_bytes, 0);
    new_size := calculate_jsonb_size(NEW.data) +
                calculate_text_size(NEW.id::TEXT) +
                100;

    NEW.size_bytes := new_size;

    -- If transitioning from active -> soft-deleted, subtract full old size.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE databases
      SET size_documents_bytes = GREATEST(0, size_documents_bytes - old_size)
      WHERE id = db_id;

      PERFORM update_database_total_size(db_id);

    -- If transitioning from soft-deleted -> active, add full new size.
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_documents_bytes = size_documents_bytes + new_size
      WHERE id = db_id;

      PERFORM update_database_total_size(db_id);

    -- Regular in-place update of an active document: apply size delta.
    ELSIF NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_documents_bytes = size_documents_bytes + (new_size - old_size)
      WHERE id = db_id;

      PERFORM update_database_total_size(db_id);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    old_size := COALESCE(OLD.size_bytes, 0);

    -- Physical delete should always reduce size if it was previously counted.
    UPDATE databases
    SET size_documents_bytes = GREATEST(0, size_documents_bytes - old_size)
    WHERE id = db_id;

    PERFORM update_database_total_size(db_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


-- Update collection size trigger function so soft-deleted collections
-- stop contributing to size_collections_bytes.
CREATE OR REPLACE FUNCTION update_collection_size()
RETURNS TRIGGER AS $$
DECLARE
  old_size BIGINT := 0;
  new_size BIGINT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_size := calculate_text_size(NEW.name) +
                calculate_text_size(NEW.key) +
                COALESCE(calculate_text_size(NEW.description), 0) +
                200; -- Overhead for metadata

    NEW.size_bytes := new_size;

    -- Only count non-deleted collections
    IF NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_collections_bytes = size_collections_bytes + new_size
      WHERE id = NEW.database_id;

      PERFORM update_database_total_size(NEW.database_id);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    old_size := COALESCE(OLD.size_bytes, 0);
    new_size := calculate_text_size(NEW.name) +
                calculate_text_size(NEW.key) +
                COALESCE(calculate_text_size(NEW.description), 0) +
                200;

    NEW.size_bytes := new_size;

    -- Transition active -> soft-deleted
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE databases
      SET size_collections_bytes = GREATEST(0, size_collections_bytes - old_size)
      WHERE id = OLD.database_id;

      PERFORM update_database_total_size(OLD.database_id);

    -- Transition soft-deleted -> active
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_collections_bytes = size_collections_bytes + new_size
      WHERE id = NEW.database_id;

      PERFORM update_database_total_size(NEW.database_id);

    -- Regular update on active collection
    ELSIF NEW.deleted_at IS NULL THEN
      UPDATE databases
      SET size_collections_bytes = size_collections_bytes + (new_size - old_size)
      WHERE id = NEW.database_id;

      PERFORM update_database_total_size(NEW.database_id);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    old_size := COALESCE(OLD.size_bytes, 0);

    UPDATE databases
    SET size_collections_bytes = GREATEST(0, size_collections_bytes - old_size)
    WHERE id = OLD.database_id;

    PERFORM update_database_total_size(OLD.database_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

