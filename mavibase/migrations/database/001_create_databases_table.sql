-- Create databases table
CREATE TABLE IF NOT EXISTS databases (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create index for soft deletes
CREATE INDEX idx_databases_deleted_at ON databases(deleted_at);

-- Create index for key lookups
CREATE INDEX idx_databases_key ON databases(key) WHERE deleted_at IS NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for databases
CREATE TRIGGER update_databases_updated_at
  BEFORE UPDATE ON databases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
