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


-- ============================================================================
-- RollCloud Commands Table
-- Enables Discord → Extension communication (button clicks, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rollcloud_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the pairing (identifies which extension should receive this)
  pairing_id UUID REFERENCES rollcloud_pairings(id) ON DELETE CASCADE,

  -- Discord context
  discord_user_id VARCHAR(20) NOT NULL,
  discord_username VARCHAR(100),
  discord_message_id VARCHAR(20), -- The message with the button that was clicked

  -- Command details
  command_type VARCHAR(50) NOT NULL, -- 'roll', 'use_action', 'use_bonus', 'end_turn', etc.
  command_data JSONB DEFAULT '{}',   -- Flexible payload for command-specific data

  -- Targeting (which character/action)
  character_name VARCHAR(100),
  action_name VARCHAR(200),

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  result JSONB DEFAULT NULL,            -- Result from extension after execution
  error_message TEXT DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ DEFAULT NULL,

  -- Auto-expire unprocessed commands after 5 minutes
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Fast lookups for extension polling (pending commands for a pairing)
CREATE INDEX IF NOT EXISTS idx_commands_pending
  ON rollcloud_commands(pairing_id, status, created_at)
  WHERE status = 'pending';

-- Fast lookups by Discord message (for updating button states)
CREATE INDEX IF NOT EXISTS idx_commands_message
  ON rollcloud_commands(discord_message_id);

-- RLS Policies
ALTER TABLE rollcloud_commands ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read (extension polls for pending commands)
CREATE POLICY "Allow anonymous read commands" ON rollcloud_commands
  FOR SELECT USING (true);

-- Allow anonymous insert (Pip Bot creates commands from button clicks)
CREATE POLICY "Allow anonymous insert commands" ON rollcloud_commands
  FOR INSERT WITH CHECK (true);

-- Allow anonymous update (extension marks commands as completed)
CREATE POLICY "Allow anonymous update commands" ON rollcloud_commands
  FOR UPDATE USING (true);

-- Cleanup expired commands (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_commands()
RETURNS void AS $$
BEGIN
  DELETE FROM rollcloud_commands
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- RollCloud Turns Table
-- Extension writes turn data here, Pip Bot posts to Discord with buttons
-- ============================================================================

CREATE TABLE IF NOT EXISTS rollcloud_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the pairing (identifies which Discord channel to post to)
  pairing_id UUID REFERENCES rollcloud_pairings(id) ON DELETE CASCADE,

  -- Turn event type
  event_type VARCHAR(30) NOT NULL, -- 'turn_start', 'turn_end', 'round_change', 'combat_start', 'combat_end'

  -- Character info
  character_name VARCHAR(100),
  character_id VARCHAR(50),       -- DiceCloud character ID

  -- Combat state
  round_number INTEGER,
  initiative INTEGER,

  -- Action economy (for turn_start)
  action_available BOOLEAN DEFAULT true,
  bonus_available BOOLEAN DEFAULT true,
  movement_available BOOLEAN DEFAULT true,
  reaction_available BOOLEAN DEFAULT true,

  -- Character abilities (JSON array of available actions for buttons)
  -- Format: [{ "name": "Longsword", "type": "action", "roll": "1d20+5" }, ...]
  available_actions JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, posted, expired
  discord_message_id VARCHAR(20),       -- Filled after Pip Bot posts

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ DEFAULT NULL,

  -- Auto-expire after 1 minute if not posted
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 minute')
);

-- Fast lookups for Pip Bot polling (pending turns to post)
CREATE INDEX IF NOT EXISTS idx_turns_pending
  ON rollcloud_turns(pairing_id, status, created_at)
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE rollcloud_turns ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read (Pip Bot reads pending turns)
CREATE POLICY "Allow anonymous read turns" ON rollcloud_turns
  FOR SELECT USING (true);

-- Allow anonymous insert (extension creates turn events)
CREATE POLICY "Allow anonymous insert turns" ON rollcloud_turns
  FOR INSERT WITH CHECK (true);

-- Allow anonymous update (Pip Bot marks as posted)
CREATE POLICY "Allow anonymous update turns" ON rollcloud_turns
  FOR UPDATE USING (true);

-- Cleanup old turns (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_turns()
RETURNS void AS $$
BEGIN
  DELETE FROM rollcloud_turns
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- RollCloud Rolls Table
-- Enables Discord → Extension roll communication for real-time Roll20 integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS rollcloud_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the pairing (identifies which extension should receive this)
  pairing_id UUID REFERENCES rollcloud_pairings(id) ON DELETE CASCADE,

  -- Discord context
  discord_user_id VARCHAR(20) NOT NULL,
  discord_username VARCHAR(100),
  discord_message_id VARCHAR(20),

  -- Roll details
  roll_type VARCHAR(50) NOT NULL, -- 'dice', 'ability_check', 'skill_check', 'saving_throw', 'spell_attack', 'attack'
  roll_formula VARCHAR(100) NOT NULL, -- e.g., '1d20+5', '2d6', '1d20+7(stealth)'
  roll_result JSONB NOT NULL, -- { "total": 23, "rolls": [15, 8], "modifier": 0 }
  
  -- Character context (if available)
  character_name VARCHAR(100),
  character_id VARCHAR(50),
  meteor_character_id VARCHAR(50), -- DiceCloud Meteor ID for Roll20 integration
  ability_score VARCHAR(20), -- 'strength', 'dexterity', etc.
  skill_name VARCHAR(50), -- 'perception', 'stealth', etc.
  spell_name VARCHAR(100), -- for spell attacks
  weapon_name VARCHAR(100), -- for weapon attacks
  advantage_type VARCHAR(20), -- 'normal', 'advantage', 'disadvantage'

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, delivered, failed, timeout
  error_message TEXT DEFAULT NULL,
  roll20_result JSONB DEFAULT NULL, -- Result from Roll20 execution

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ DEFAULT NULL,
  processed_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 seconds') -- Short timeout for fallback
);

-- Fast lookups for extension polling (pending rolls for a pairing)
CREATE INDEX IF NOT EXISTS idx_rolls_pending
  ON rollcloud_rolls(pairing_id, status, created_at)
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE rollcloud_rolls ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read (extension polls for pending rolls)
CREATE POLICY "Allow anonymous read rolls" ON rollcloud_rolls
  FOR SELECT USING (true);

-- Allow anonymous insert (Pip Bot creates rolls from Discord commands)
CREATE POLICY "Allow anonymous insert rolls" ON rollcloud_rolls
  FOR INSERT WITH CHECK (true);

-- Allow anonymous update (extension marks rolls as delivered)
CREATE POLICY "Allow anonymous update rolls" ON rollcloud_rolls
  FOR UPDATE USING (true);

-- Cleanup expired rolls (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rolls()
RETURNS void AS $$
BEGIN
  DELETE FROM rollcloud_rolls
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Enable Realtime for Pip Bot
-- ============================================================================

-- Enable realtime for the turns table so Pip Bot can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE rollcloud_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE rollcloud_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE rollcloud_rolls;
