-- Create pip2_instances table for managing user Pip 2 instances
CREATE TABLE IF NOT EXISTS pip2_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL DEFAULT 'Unknown Server',
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL DEFAULT 'unknown',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by discord user
CREATE INDEX IF NOT EXISTS idx_pip2_instances_discord_user
  ON pip2_instances(discord_user_id);

-- Create index for guild lookups
CREATE INDEX IF NOT EXISTS idx_pip2_instances_guild
  ON pip2_instances(guild_id);

-- Create unique constraint to prevent duplicate instances per channel
CREATE UNIQUE INDEX IF NOT EXISTS idx_pip2_instances_unique_channel
  ON pip2_instances(guild_id, channel_id);

-- Enable Row Level Security
ALTER TABLE pip2_instances ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own instances
CREATE POLICY "Users can view their own instances" ON pip2_instances
  FOR SELECT
  USING (true);

-- Create policy for users to insert their own instances
CREATE POLICY "Users can create instances" ON pip2_instances
  FOR INSERT
  WITH CHECK (true);

-- Create policy for users to update their own instances
CREATE POLICY "Users can update their own instances" ON pip2_instances
  FOR UPDATE
  USING (true);

-- Create policy for users to delete their own instances
CREATE POLICY "Users can delete their own instances" ON pip2_instances
  FOR DELETE
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pip2_instances_updated_at
  BEFORE UPDATE ON pip2_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
