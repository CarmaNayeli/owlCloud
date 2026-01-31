-- Safe Migration: Add timeout and cleanup functionality WITHOUT dropping table
-- Run this in your Supabase SQL Editor to add command timeout and cleanup features safely

-- Step 1: Add expires_at column for command timeout (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_commands' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.owlcloud_commands ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added expires_at column to owlcloud_commands';
    ELSE
        RAISE NOTICE 'expires_at column already exists in owlcloud_commands';
    END IF;
END $$;

-- Step 2: Add processed_at column for tracking when commands were actually processed (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_commands' AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE public.owlcloud_commands ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added processed_at column to owlcloud_commands';
    ELSE
        RAISE NOTICE 'processed_at column already exists in owlcloud_commands';
    END IF;
END $$;

-- Step 3: Add indexes for performance (if not exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'owlcloud_commands' AND indexname = 'idx_owlcloud_commands_expires_at'
    ) THEN
        CREATE INDEX idx_owlcloud_commands_expires_at ON public.owlcloud_commands(expires_at);
        RAISE NOTICE 'Created index on expires_at';
    ELSE
        RAISE NOTICE 'Index on expires_at already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'owlcloud_commands' AND indexname = 'idx_owlcloud_commands_processed_at'
    ) THEN
        CREATE INDEX idx_owlcloud_commands_processed_at ON public.owlcloud_commands(processed_at);
        RAISE NOTICE 'Created index on processed_at';
    ELSE
        RAISE NOTICE 'Index on processed_at already exists';
    END IF;
END $$;

-- Step 4: Create cleanup function for expired and old commands (or replace if exists)
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
    DELETE FROM public.owlcloud_commands 
    WHERE expires_at < NOW() 
    AND status IN ('pending', 'processing');
    
    GET DIAGNOSTICS expired_commands = ROW_COUNT;
    
    -- Delete old pending commands (stuck)
    DELETE FROM public.owlcloud_commands 
    WHERE created_at < NOW() - INTERVAL '1 hour'
    AND status = 'pending';
    
    GET DIAGNOSTICS old_pending_commands = ROW_COUNT;
    
    -- Delete old completed/failed commands (cleanup)
    DELETE FROM public.owlcloud_commands
    WHERE created_at < NOW() - (INTERVAL '1 day' * cleanup_days)
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS old_failed_commands = ROW_COUNT;
    
    -- Log the cleanup results
    RAISE NOTICE 'Command cleanup completed: expired=%, old_pending=%, old_failed=%', 
                  expired_commands, old_pending_commands, old_failed_commands;
    
    RETURN QUERY SELECT expired_commands, old_pending_commands, old_failed_commands;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to mark expired commands as failed (or replace if exists)
CREATE OR REPLACE FUNCTION mark_expired_commands_failed()
RETURNS INTEGER AS $$
DECLARE
    marked_count INTEGER;
BEGIN
    -- Mark expired pending commands as failed
    UPDATE public.owlcloud_commands 
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

-- Step 6: Create automatic trigger to set expires_at on insert (only if trigger doesn't exist)

-- First, create the function (safe to replace)
CREATE OR REPLACE FUNCTION set_command_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set expiration time (5 minutes from creation)
    NEW.expires_at = NOW() + INTERVAL '5 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then, create the trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'set_owlcloud_command_expires_at' 
        AND event_object_table = 'owlcloud_commands'
    ) THEN
        CREATE TRIGGER set_owlcloud_command_expires_at
            BEFORE INSERT ON public.owlcloud_commands
            FOR EACH ROW
            EXECUTE FUNCTION set_command_expires_at();
        
        RAISE NOTICE 'Created expires_at trigger';
    ELSE
        RAISE NOTICE 'expires_at trigger already exists';
    END IF;
END $$;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.owlcloud_commands.expires_at IS 'Command expiration time (5 minutes after creation)';
COMMENT ON COLUMN public.owlcloud_commands.processed_at IS 'When the command was actually processed by the extension';
COMMENT ON FUNCTION public.cleanup_old_commands() IS 'Cleans up expired and old commands to prevent database clutter';
COMMENT ON FUNCTION public.mark_expired_commands_failed() IS 'Marks expired pending commands as failed';
COMMENT ON FUNCTION public.set_command_expires_at() IS 'Automatically sets expiration time for new commands';

-- Step 8: Verify the migration worked
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'owlcloud_commands' 
AND column_name IN ('expires_at', 'processed_at')
ORDER BY column_name;

-- Step 9: Show current table structure (for verification)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'owlcloud_commands' 
ORDER BY ordinal_position;
