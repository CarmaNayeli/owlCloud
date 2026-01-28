-- Create rollcloud_commands table for Discord command processing
-- This table stores commands from Discord that need to be executed in Roll20

-- Drop table if it exists (for testing)
DROP TABLE IF EXISTS rollcloud_commands;

-- Create the commands table
CREATE TABLE rollcloud_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID NOT NULL,
  discord_user_id VARCHAR(255),
  discord_username VARCHAR(255),
  discord_message_id VARCHAR(255),
  command_type TEXT NOT NULL,
  action_name TEXT,
  command_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,
  result_data JSONB
);

-- Create indexes for performance
CREATE INDEX idx_rollcloud_commands_pairing_id ON rollcloud_commands(pairing_id);
CREATE INDEX idx_rollcloud_commands_status ON rollcloud_commands(status);
CREATE INDEX idx_rollcloud_commands_created_at ON rollcloud_commands(created_at);
CREATE INDEX idx_rollcloud_commands_discord_user_id ON rollcloud_commands(discord_user_id);
CREATE INDEX idx_rollcloud_commands_discord_message_id ON rollcloud_commands(discord_message_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rollcloud_commands_updated_at
  BEFORE UPDATE ON rollcloud_commands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.rollcloud_commands IS 'Stores Discord commands that need to be executed in Roll20 via RollCloud extension';
COMMENT ON COLUMN public.rollcloud_commands.pairing_id IS 'Reference to rollcloud_pairings table';
COMMENT ON COLUMN public.rollcloud_commands.discord_user_id IS 'Discord user ID who sent the command';
COMMENT ON COLUMN public.rollcloud_commands.discord_username IS 'Discord username who sent the command';
COMMENT ON COLUMN public.rollcloud_commands.discord_message_id IS 'Discord message ID for tracking';
COMMENT ON COLUMN public.rollcloud_commands.command_type IS 'Type of command (roll, use_action, use_bonus, etc.)';
COMMENT ON COLUMN public.rollcloud_commands.action_name IS 'Name of the action/ability being used';
COMMENT ON COLUMN public.rollcloud_commands.command_data IS 'Additional command data (roll string, spell level, etc.)';
COMMENT ON COLUMN public.rollcloud_commands.status IS 'Command processing status';
COMMENT ON COLUMN public.rollcloud_commands.error_message IS 'Error message if command failed';
COMMENT ON COLUMN public.rollcloud_commands.result_data IS 'Result data from command execution';

-- Grant permissions (simplified - no complex RLS for now)
GRANT ALL ON rollcloud_commands TO authenticated;
GRANT ALL ON rollcloud_commands TO service_role;
GRANT SELECT ON rollcloud_commands TO anon;
