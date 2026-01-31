-- Migration: Add Discord fields to owlcloud_commands table
-- Run this in your Supabase SQL Editor to fix Discord button command creation

-- Step 1: Add discord_user_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_commands' AND column_name = 'discord_user_id'
    ) THEN
        ALTER TABLE public.owlcloud_commands ADD COLUMN discord_user_id VARCHAR(255);
        RAISE NOTICE 'Added discord_user_id column to owlcloud_commands';
    ELSE
        RAISE NOTICE 'discord_user_id column already exists in owlcloud_commands';
    END IF;
END $$;

-- Step 2: Add discord_username column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_commands' AND column_name = 'discord_username'
    ) THEN
        ALTER TABLE public.owlcloud_commands ADD COLUMN discord_username VARCHAR(255);
        RAISE NOTICE 'Added discord_username column to owlcloud_commands';
    ELSE
        RAISE NOTICE 'discord_username column already exists in owlcloud_commands';
    END IF;
END $$;

-- Step 3: Add discord_message_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_commands' AND column_name = 'discord_message_id'
    ) THEN
        ALTER TABLE public.owlcloud_commands ADD COLUMN discord_message_id VARCHAR(255);
        RAISE NOTICE 'Added discord_message_id column to owlcloud_commands';
    ELSE
        RAISE NOTICE 'discord_message_id column already exists in owlcloud_commands';
    END IF;
END $$;

-- Step 4: Add indexes for performance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'owlcloud_commands' AND indexname = 'idx_owlcloud_commands_discord_user_id'
    ) THEN
        CREATE INDEX idx_owlcloud_commands_discord_user_id ON public.owlcloud_commands(discord_user_id);
        RAISE NOTICE 'Created index on discord_user_id';
    ELSE
        RAISE NOTICE 'Index on discord_user_id already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'owlcloud_commands' AND indexname = 'idx_owlcloud_commands_discord_message_id'
    ) THEN
        CREATE INDEX idx_owlcloud_commands_discord_message_id ON public.owlcloud_commands(discord_message_id);
        RAISE NOTICE 'Created index on discord_message_id';
    ELSE
        RAISE NOTICE 'Index on discord_message_id already exists';
    END IF;
END $$;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.owlcloud_commands.discord_user_id IS 'Discord user ID who sent the command';
COMMENT ON COLUMN public.owlcloud_commands.discord_username IS 'Discord username who sent the command';
COMMENT ON COLUMN public.owlcloud_commands.discord_message_id IS 'Discord message ID for tracking';

-- Step 6: Verify the migration worked
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'owlcloud_commands' 
AND column_name IN ('discord_user_id', 'discord_username', 'discord_message_id')
ORDER BY column_name;

-- Step 7: Show current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'owlcloud_commands' 
ORDER BY ordinal_position;
