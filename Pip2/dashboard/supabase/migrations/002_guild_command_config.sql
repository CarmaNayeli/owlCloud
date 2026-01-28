-- Guild Command Configuration Table
-- Stores which slash commands are enabled/disabled per guild

CREATE TABLE IF NOT EXISTS guild_command_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,

  -- Store disabled commands as an array (all commands enabled by default)
  -- This approach means new commands are automatically enabled
  disabled_commands TEXT[] DEFAULT '{}',

  -- Who last modified the config
  modified_by_discord_id TEXT,
  modified_by_username TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One config per guild
  CONSTRAINT unique_guild_config UNIQUE (guild_id)
);

-- Fast lookup by guild_id
CREATE INDEX IF NOT EXISTS idx_guild_command_config_guild
  ON guild_command_config(guild_id);

-- Enable Row Level Security
ALTER TABLE guild_command_config ENABLE ROW LEVEL SECURITY;

-- Allow reads (bot and dashboard need to check config)
CREATE POLICY "Allow read guild command config" ON guild_command_config
  FOR SELECT USING (true);

-- Allow inserts (dashboard creates configs)
CREATE POLICY "Allow insert guild command config" ON guild_command_config
  FOR INSERT WITH CHECK (true);

-- Allow updates (dashboard updates configs)
CREATE POLICY "Allow update guild command config" ON guild_command_config
  FOR UPDATE USING (true);

-- Auto-update updated_at on changes
CREATE TRIGGER update_guild_command_config_updated_at
  BEFORE UPDATE ON guild_command_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
