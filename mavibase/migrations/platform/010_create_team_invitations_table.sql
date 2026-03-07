-- Migration: Create team_invitations table
-- Description: Pending team invitations

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  
  -- Invitation management
  invited_by UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint: one pending invitation per email per team
  UNIQUE(team_id, email, status)
);

-- Indexes
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token_hash ON team_invitations(token_hash);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
