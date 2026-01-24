-- RollCloud Discord Pairing Table
-- Links DiceCloud users to Discord webhooks via short pairing codes

CREATE TABLE IF NOT EXISTS rollcloud_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pairing code (6 chars, shown in extension, typed in Discord)
  pairing_code VARCHAR(6) NOT NULL UNIQUE,

  -- DiceCloud user info (from extension)
  dicecloud_user_id VARCHAR(50),
  dicecloud_username VARCHAR(100),

  -- Discord info (filled in by Pip Bot after /setupmyrollcloud)
  discord_guild_id VARCHAR(20),
  discord_guild_name VARCHAR(100),
  discord_channel_id VARCHAR(20),
  discord_channel_name VARCHAR(100),
  discord_user_id VARCHAR(20),

  -- The webhook URL (filled in by Pip Bot)
  webhook_url TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- pending, connected, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookups by pairing code
CREATE INDEX IF NOT EXISTS idx_pairing_code ON rollcloud_pairings(pairing_code);

-- Fast lookups by DiceCloud user (for reconnection)
CREATE INDEX IF NOT EXISTS idx_dicecloud_user ON rollcloud_pairings(dicecloud_user_id);

-- Fast lookups by Discord guild (one webhook per guild)
CREATE INDEX IF NOT EXISTS idx_discord_guild ON rollcloud_pairings(discord_guild_id);

-- RLS Policies
ALTER TABLE rollcloud_pairings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads (extension needs to poll for webhook_url)
CREATE POLICY "Allow anonymous read" ON rollcloud_pairings
  FOR SELECT USING (true);

-- Allow anonymous inserts (extension creates pairing codes)
CREATE POLICY "Allow anonymous insert" ON rollcloud_pairings
  FOR INSERT WITH CHECK (true);

-- Allow anonymous updates (Pip Bot updates with webhook_url)
CREATE POLICY "Allow anonymous update" ON rollcloud_pairings
  FOR UPDATE USING (true);

-- Cleanup expired pairings (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_pairings()
RETURNS void AS $$
BEGIN
  DELETE FROM rollcloud_pairings
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
