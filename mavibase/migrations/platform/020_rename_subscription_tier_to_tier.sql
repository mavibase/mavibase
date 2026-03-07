-- Migration: Rename subscription_tier to tier
-- Description: Remove billing terminology - this is about resource tiers, not subscriptions
-- NOTE: This migration is now a no-op because the original teams table (008) already uses 'tier'

-- Only rename if the old column exists (for backwards compatibility with older databases)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE teams RENAME COLUMN subscription_tier TO tier;
    DROP INDEX IF EXISTS idx_teams_subscription_tier;
    ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_subscription_tier_check;
  END IF;
END $$;

-- Ensure index exists (idempotent)
CREATE INDEX IF NOT EXISTS idx_teams_tier ON teams(tier);

-- Ensure check constraint exists (drop and recreate to be idempotent)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_tier_check;
ALTER TABLE teams ADD CONSTRAINT teams_tier_check CHECK (tier IN ('free', 'pro', 'enterprise', 'custom'));

-- Update column comment
COMMENT ON COLUMN teams.tier IS 'Resource tier (free, pro, enterprise, custom) - determines quota limits';
