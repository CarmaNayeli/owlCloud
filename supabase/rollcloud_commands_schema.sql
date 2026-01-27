-- Create rollcloud_commands table for Discord command processing
-- This table stores commands from Discord that need to be executed in Roll20

-- Drop table if it exists (for testing)
DROP TABLE IF EXISTS rollcloud_commands;

-- Create the commands table
CREATE TABLE rollcloud_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID NOT NULL,
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

-- Grant permissions (simplified - no complex RLS for now)
GRANT ALL ON rollcloud_commands TO authenticated;
GRANT ALL ON rollcloud_commands TO service_role;
GRANT SELECT ON rollcloud_commands TO anon;
