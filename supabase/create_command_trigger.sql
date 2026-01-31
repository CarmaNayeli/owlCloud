-- Temporarily drop the trigger to test edge function without it
-- The edge function should work even without broadcasting for now

DROP TRIGGER IF EXISTS broadcast_command_to_realtime ON owlcloud_commands;
DROP FUNCTION IF EXISTS broadcast_command_to_realtime();

-- For now, just enable basic Realtime on the table
-- The extension can poll or we can fix the trigger later
