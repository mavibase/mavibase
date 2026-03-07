-- Add support for multi-field indexes and index types
ALTER TABLE index_metadata 
  ADD COLUMN IF NOT EXISTS field_names JSONB,
  ADD COLUMN IF NOT EXISTS index_type VARCHAR(50) DEFAULT 'btree',
  ADD COLUMN IF NOT EXISTS is_unique BOOLEAN DEFAULT FALSE;

-- Update existing records to have field_names as array
UPDATE index_metadata SET field_names = jsonb_build_array(field_name) WHERE field_names IS NULL;

-- Drop the old unique constraint and add a new one without field_name
ALTER TABLE index_metadata DROP CONSTRAINT IF EXISTS unique_index_per_field;

-- Add index on field_names for better query performance
CREATE INDEX IF NOT EXISTS idx_index_metadata_field_names ON index_metadata USING GIN (field_names);

COMMIT;
