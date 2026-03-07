-- Add avatar_url column to platform_users table
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
