-- Add index_type column to index_metadata table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'index_metadata' AND column_name = 'index_type'
  ) THEN
    ALTER TABLE index_metadata 
    ADD COLUMN index_type VARCHAR(50) DEFAULT 'btree';
  END IF;
END $$;

-- Add is_unique column to index_metadata table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'index_metadata' AND column_name = 'is_unique'
  ) THEN
    ALTER TABLE index_metadata 
    ADD COLUMN is_unique BOOLEAN DEFAULT false;
  END IF;
END $$;
