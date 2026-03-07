-- Migration: Add comprehensive size tracking to databases
-- Tracks storage usage across all resources (documents, collections, indexes, schemas, relationships, versions)

-- Add granular size tracking columns to databases table
ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS size_documents_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_collections_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_indexes_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_schemas_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_relationships_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_versions_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_total_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_last_calculated_at TIMESTAMP;

-- Add size column to individual tables for tracking per-entity sizes
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

ALTER TABLE collection_schemas
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

ALTER TABLE index_metadata
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

ALTER TABLE relationships
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

ALTER TABLE document_versions
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_databases_size_total ON databases(size_total_bytes);
CREATE INDEX IF NOT EXISTS idx_databases_size_documents ON databases(size_documents_bytes);
CREATE INDEX IF NOT EXISTS idx_collections_size ON collections(size_bytes);
CREATE INDEX IF NOT EXISTS idx_documents_size ON documents(size_bytes);

-- Function to calculate size of JSONB data
CREATE OR REPLACE FUNCTION calculate_jsonb_size(data JSONB)
RETURNS BIGINT AS $$
BEGIN
  -- Returns approximate size in bytes (length of JSONB text representation)
  RETURN LENGTH(data::TEXT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate size of text data
CREATE OR REPLACE FUNCTION calculate_text_size(data TEXT)
RETURNS BIGINT AS $$
BEGIN
  RETURN COALESCE(LENGTH(data), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update database total size
CREATE OR REPLACE FUNCTION update_database_total_size(db_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE databases
  SET 
    size_total_bytes = COALESCE(size_documents_bytes, 0) + 
                       COALESCE(size_collections_bytes, 0) + 
                       COALESCE(size_indexes_bytes, 0) + 
                       COALESCE(size_schemas_bytes, 0) + 
                       COALESCE(size_relationships_bytes, 0) + 
                       COALESCE(size_versions_bytes, 0),
    size_last_calculated_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = db_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for documents size tracking
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
    
    -- Update database size
    UPDATE databases
    SET size_documents_bytes = size_documents_bytes + new_size
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_size := OLD.size_bytes;
    new_size := calculate_jsonb_size(NEW.data) + 
                calculate_text_size(NEW.id::TEXT) + 
                100;
    
    NEW.size_bytes := new_size;
    
    -- Update database size (add difference)
    UPDATE databases
    SET size_documents_bytes = size_documents_bytes + (new_size - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    -- Decrease database size
    UPDATE databases
    SET size_documents_bytes = GREATEST(0, size_documents_bytes - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for document_versions size tracking
CREATE OR REPLACE FUNCTION update_document_version_size()
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
    new_size := calculate_jsonb_size(NEW.data) + 50;
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_versions_bytes = size_versions_bytes + new_size
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    UPDATE databases
    SET size_versions_bytes = GREATEST(0, size_versions_bytes - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for collections size tracking
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
    
    UPDATE databases
    SET size_collections_bytes = size_collections_bytes + new_size
    WHERE id = NEW.database_id;
    
    PERFORM update_database_total_size(NEW.database_id);
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_size := OLD.size_bytes;
    new_size := calculate_text_size(NEW.name) + 
                calculate_text_size(NEW.key) + 
                COALESCE(calculate_text_size(NEW.description), 0) + 
                200;
    
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_collections_bytes = size_collections_bytes + (new_size - old_size)
    WHERE id = NEW.database_id;
    
    PERFORM update_database_total_size(NEW.database_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    UPDATE databases
    SET size_collections_bytes = GREATEST(0, size_collections_bytes - old_size)
    WHERE id = OLD.database_id;
    
    PERFORM update_database_total_size(OLD.database_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for collection_schemas size tracking
CREATE OR REPLACE FUNCTION update_schema_size()
RETURNS TRIGGER AS $$
DECLARE
  old_size BIGINT := 0;
  new_size BIGINT := 0;
  db_id UUID;
BEGIN
  SELECT c.database_id INTO db_id
  FROM collections c
  WHERE c.id = COALESCE(NEW.collection_id, OLD.collection_id);

  IF TG_OP = 'INSERT' THEN
    new_size := calculate_jsonb_size(NEW.definition) + 100;
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_schemas_bytes = size_schemas_bytes + new_size
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_size := OLD.size_bytes;
    new_size := calculate_jsonb_size(NEW.definition) + 100;
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_schemas_bytes = size_schemas_bytes + (new_size - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    UPDATE databases
    SET size_schemas_bytes = GREATEST(0, size_schemas_bytes - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for index_metadata size tracking
CREATE OR REPLACE FUNCTION update_index_size()
RETURNS TRIGGER AS $$
DECLARE
  old_size BIGINT := 0;
  new_size BIGINT := 0;
  db_id UUID;
BEGIN
  SELECT c.database_id INTO db_id
  FROM collections c
  WHERE c.id = COALESCE(NEW.collection_id, OLD.collection_id);

  IF TG_OP = 'INSERT' THEN
    new_size := calculate_text_size(NEW.field_name) + 
                calculate_text_size(NEW.index_name) + 
                150; -- Index overhead
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_indexes_bytes = size_indexes_bytes + new_size
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_size := OLD.size_bytes;
    new_size := calculate_text_size(NEW.field_name) + 
                calculate_text_size(NEW.index_name) + 
                150;
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_indexes_bytes = size_indexes_bytes + (new_size - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    UPDATE databases
    SET size_indexes_bytes = GREATEST(0, size_indexes_bytes - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for relationships size tracking
CREATE OR REPLACE FUNCTION update_relationship_size()
RETURNS TRIGGER AS $$
DECLARE
  old_size BIGINT := 0;
  new_size BIGINT := 0;
  db_id UUID;
BEGIN
  SELECT c.database_id INTO db_id
  FROM collections c
  WHERE c.id = COALESCE(NEW.source_collection_id, OLD.source_collection_id);

  IF TG_OP = 'INSERT' THEN
    new_size := calculate_text_size(NEW.source_attribute) + 
                COALESCE(calculate_text_size(NEW.target_attribute), 0) + 
                calculate_text_size(NEW.type) + 
                150; -- Relationship metadata overhead
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_relationships_bytes = size_relationships_bytes + new_size
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_size := OLD.size_bytes;
    new_size := calculate_text_size(NEW.source_attribute) + 
                COALESCE(calculate_text_size(NEW.target_attribute), 0) + 
                calculate_text_size(NEW.type) + 
                150;
    NEW.size_bytes := new_size;
    
    UPDATE databases
    SET size_relationships_bytes = size_relationships_bytes + (new_size - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
    
  ELSIF TG_OP = 'DELETE' THEN
    old_size := OLD.size_bytes;
    
    UPDATE databases
    SET size_relationships_bytes = GREATEST(0, size_relationships_bytes - old_size)
    WHERE id = db_id;
    
    PERFORM update_database_total_size(db_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_document_size ON documents;
CREATE TRIGGER trigger_document_size
  BEFORE INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_size();

DROP TRIGGER IF EXISTS trigger_document_version_size ON document_versions;
CREATE TRIGGER trigger_document_version_size
  BEFORE INSERT OR DELETE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_version_size();

DROP TRIGGER IF EXISTS trigger_collection_size ON collections;
CREATE TRIGGER trigger_collection_size
  BEFORE INSERT OR UPDATE OR DELETE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_size();

DROP TRIGGER IF EXISTS trigger_schema_size ON collection_schemas;
CREATE TRIGGER trigger_schema_size
  BEFORE INSERT OR UPDATE OR DELETE ON collection_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_size();

DROP TRIGGER IF EXISTS trigger_index_size ON index_metadata;
CREATE TRIGGER trigger_index_size
  BEFORE INSERT OR UPDATE OR DELETE ON index_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_index_size();

DROP TRIGGER IF EXISTS trigger_relationship_size ON relationships;
CREATE TRIGGER trigger_relationship_size
  BEFORE INSERT OR UPDATE OR DELETE ON relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_relationship_size();

-- Comments for documentation
COMMENT ON COLUMN databases.size_documents_bytes IS 'Total size of document data in bytes';
COMMENT ON COLUMN databases.size_collections_bytes IS 'Total size of collection metadata in bytes';
COMMENT ON COLUMN databases.size_indexes_bytes IS 'Total size of index metadata in bytes';
COMMENT ON COLUMN databases.size_schemas_bytes IS 'Total size of schema definitions in bytes';
COMMENT ON COLUMN databases.size_relationships_bytes IS 'Total size of relationship definitions in bytes';
COMMENT ON COLUMN databases.size_versions_bytes IS 'Total size of document version history in bytes';
COMMENT ON COLUMN databases.size_total_bytes IS 'Total storage used across all resources in bytes';
COMMENT ON COLUMN databases.size_last_calculated_at IS 'Timestamp of last size calculation';
