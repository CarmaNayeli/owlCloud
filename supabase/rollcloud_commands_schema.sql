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
  expires_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result_data JSONB
);

-- Create indexes for performance
CREATE INDEX idx_rollcloud_commands_pairing_id ON rollcloud_commands(pairing_id);
CREATE INDEX idx_rollcloud_commands_status ON rollcloud_commands(status);
CREATE INDEX idx_rollcloud_commands_created_at ON rollcloud_commands(created_at);
CREATE INDEX idx_rollcloud_commands_discord_user_id ON rollcloud_commands(discord_user_id);
CREATE INDEX idx_rollcloud_commands_discord_message_id ON rollcloud_commands(discord_message_id);
CREATE INDEX idx_rollcloud_commands_expires_at ON rollcloud_commands(expires_at);
CREATE INDEX idx_rollcloud_commands_processed_at ON rollcloud_commands(processed_at);

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

-- Create expires_at trigger
CREATE OR REPLACE FUNCTION set_command_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set expiration time (5 minutes from creation)
  NEW.expires_at = NOW() + INTERVAL '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rollcloud_command_expires_at
  BEFORE INSERT ON rollcloud_commands
  FOR EACH ROW
  EXECUTE FUNCTION set_command_expires_at();

-- Create cleanup function for expired and old commands
CREATE OR REPLACE FUNCTION cleanup_old_commands()
RETURNS TABLE(
    expired_count INTEGER,
    old_pending_count INTEGER,
    old_failed_count INTEGER
) AS $$
DECLARE
    expired_commands INTEGER;
    old_pending_commands INTEGER;
    old_failed_commands INTEGER;
    cleanup_days INTEGER := 7; -- Clean up commands older than 7 days
BEGIN
    -- Delete expired commands (timeout)
    DELETE FROM public.rollcloud_commands 
    WHERE expires_at < NOW() 
    AND status IN ('pending', 'processing');
    
    GET DIAGNOSTICS expired_commands = ROW_COUNT;
    
    -- Delete old pending commands (stuck)
    DELETE FROM public.rollcloud_commands 
    WHERE created_at < NOW() - INTERVAL '1 hour'
    AND status = 'pending';
    
    GET DIAGNOSTICS old_pending_commands = ROW_COUNT;
    
    -- Delete old completed/failed commands (cleanup)
    DELETE FROM public.rollcloud_commands 
    WHERE created_at < NOW() - INTERVAL '%s days' % format('%s', cleanup_days)
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS old_failed_commands = ROW_COUNT;
    
    -- Log the cleanup results
    RAISE NOTICE 'Command cleanup completed: expired=%, old_pending=%, old_failed=%', 
                  expired_commands, old_pending_commands, old_failed_commands;
    
    RETURN QUERY SELECT expired_commands, old_pending_commands, old_failed_commands;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark expired commands as failed
CREATE OR REPLACE FUNCTION mark_expired_commands_failed()
RETURNS INTEGER AS $$
DECLARE
    marked_count INTEGER;
BEGIN
    -- Mark expired pending commands as failed
    UPDATE public.rollcloud_commands 
    SET status = 'failed',
        error_message = 'Command timed out',
        updated_at = NOW()
    WHERE expires_at < NOW() 
    AND status = 'pending';
    
    GET DIAGNOSTICS marked_count = ROW_COUNT;
    
    RAISE NOTICE 'Marked % commands as failed due to timeout', marked_count;
    
    RETURN marked_count;
END;
$$ LANGUAGE plpgsql;

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
COMMENT ON COLUMN public.rollcloud_commands.expires_at IS 'Command expiration time (5 minutes after creation)';
COMMENT ON COLUMN public.rollcloud_commands.processed_at IS 'When the command was actually processed by the extension';
COMMENT ON COLUMN public.rollcloud_commands.error_message IS 'Error message if command failed';
COMMENT ON COLUMN public.rollcloud_commands.result_data IS 'Result data from command execution';
COMMENT ON FUNCTION public.cleanup_old_commands() IS 'Cleans up expired and old commands to prevent database clutter';
COMMENT ON FUNCTION public.mark_expired_commands_failed() IS 'Marks expired pending commands as failed';

-- Grant permissions (simplified - no complex RLS for now)
GRANT ALL ON rollcloud_commands TO authenticated;
GRANT ALL ON rollcloud_commands TO service_role;
GRANT SELECT ON rollcloud_commands TO anon;
