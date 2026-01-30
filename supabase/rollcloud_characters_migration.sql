-- Migration: Add missing columns to rollcloud_characters table
-- This script adds the columns that were missing from the existing table

-- Add user_id_dicecloud if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'rollcloud_characters'
        AND column_name = 'user_id_dicecloud'
    ) THEN
        ALTER TABLE public.rollcloud_characters ADD COLUMN user_id_dicecloud VARCHAR(255);
        CREATE INDEX idx_rollcloud_characters_user_id_dicecloud ON public.rollcloud_characters(user_id_dicecloud);
        COMMENT ON COLUMN public.rollcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';
    END IF;
END $$;

-- Add discord_user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'rollcloud_characters'
        AND column_name = 'discord_user_id'
    ) THEN
        ALTER TABLE public.rollcloud_characters ADD COLUMN discord_user_id VARCHAR(255);
        CREATE INDEX idx_rollcloud_characters_discord_user_id ON public.rollcloud_characters(discord_user_id);
        COMMENT ON COLUMN public.rollcloud_characters.discord_user_id IS 'Discord user ID for linked accounts';
    END IF;
END $$;

-- Add pairing_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'rollcloud_characters'
        AND column_name = 'pairing_id'
    ) THEN
        ALTER TABLE public.rollcloud_characters ADD COLUMN pairing_id UUID REFERENCES public.rollcloud_pairings(id) ON DELETE SET NULL;
        CREATE INDEX idx_rollcloud_characters_pairing_id ON public.rollcloud_characters(pairing_id);
        COMMENT ON COLUMN public.rollcloud_characters.pairing_id IS 'Discord pairing reference for bot commands';
    END IF;
END $$;

-- Add created_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'rollcloud_characters'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.rollcloud_characters ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.rollcloud_characters.created_at IS 'When the character was first stored';
    END IF;
END $$;

-- Add updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'rollcloud_characters'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.rollcloud_characters ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.rollcloud_characters.updated_at IS 'When the character was last updated';
    END IF;
END $$;

-- Update existing rows to add user_id_dicecloud from auth_tokens
UPDATE public.rollcloud_characters
SET user_id_dicecloud = (
    SELECT user_id_dicecloud 
    FROM public.auth_tokens 
    WHERE user_id = user_id_dicecloud
    LIMIT 1
)
WHERE user_id_dicecloud IS NULL;

-- Update existing rows to add created_at if null
UPDATE public.rollcloud_characters
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

-- Update existing rows to add updated_at if null
UPDATE public.rollcloud_characters
SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

-- Update existing rows to add discord_user_id placeholder if null
UPDATE public.rollcloud_characters
SET discord_user_id = 'not_linked'
WHERE discord_user_id IS NULL;

-- Update existing rows to add pairing_id placeholder if null
UPDATE public.rollcloud_characters
SET pairing_id = NULL
WHERE pairing_id IS NULL;

-- Enable Row Level Security if not already enabled
ALTER TABLE public.rollcloud_characters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can insert own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can update own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can delete own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.rollcloud_characters;

-- Create RLS policy: Users can only access their own characters
CREATE POLICY "Users can view own characters" ON public.rollcloud_characters
    FOR SELECT USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can insert their own characters
CREATE POLICY "Users can insert own characters" ON public.rollcloud_characters
    FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can update their own characters
CREATE POLICY "Users can update own characters" ON public.rollcloud_characters
    FOR UPDATE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can delete their own characters
CREATE POLICY "Users can delete own characters" ON public.rollcloud_characters
    FOR DELETE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Service role can access all characters (for bot operations)
CREATE POLICY "Service role full access" ON public.rollcloud_characters
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );
