-- Migration: Add missing columns to owlcloud_characters table
-- This script adds the columns that were missing from the existing table

-- Add user_id_dicecloud if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'owlcloud_characters'
        AND column_name = 'user_id_dicecloud'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN user_id_dicecloud VARCHAR(255);
        CREATE INDEX idx_owlcloud_characters_user_id_dicecloud ON public.owlcloud_characters(user_id_dicecloud);
        COMMENT ON COLUMN public.owlcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';
    END IF;
END $$;

-- Add discord_user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'owlcloud_characters'
        AND column_name = 'discord_user_id'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN discord_user_id VARCHAR(255);
        CREATE INDEX idx_owlcloud_characters_discord_user_id ON public.owlcloud_characters(discord_user_id);
        COMMENT ON COLUMN public.owlcloud_characters.discord_user_id IS 'Discord user ID for linked accounts';
    END IF;
END $$;

-- Add pairing_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'owlcloud_characters'
        AND column_name = 'pairing_id'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN pairing_id UUID REFERENCES public.owlcloud_pairings(id) ON DELETE SET NULL;
        CREATE INDEX idx_owlcloud_characters_pairing_id ON public.owlcloud_characters(pairing_id);
        COMMENT ON COLUMN public.owlcloud_characters.pairing_id IS 'Discord pairing reference for bot commands';
    END IF;
END $$;

-- Add created_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'owlcloud_characters'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.owlcloud_characters.created_at IS 'When the character was first stored';
    END IF;
END $$;

-- Add updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'owlcloud_characters'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.owlcloud_characters.updated_at IS 'When the character was last updated';
    END IF;
END $$;

-- Note: user_id_dicecloud cannot be reliably backfilled from existing data
-- New character syncs will populate this field automatically
-- Existing rows will remain NULL until next sync

-- Update existing rows to add created_at if null
UPDATE public.owlcloud_characters
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

-- Update existing rows to add updated_at if null
UPDATE public.owlcloud_characters
SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

-- Update existing rows to add discord_user_id placeholder if null
UPDATE public.owlcloud_characters
SET discord_user_id = 'not_linked'
WHERE discord_user_id IS NULL;

-- Update existing rows to add pairing_id placeholder if null
UPDATE public.owlcloud_characters
SET pairing_id = NULL
WHERE pairing_id IS NULL;

-- Enable Row Level Security
ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for anon key" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Enable insert for anon key" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Enable update for anon key" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Enable delete for anon key" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.owlcloud_characters;

-- Create simple RLS policies for anon key access
-- The extension uses anon key, not authenticated users, so we allow all operations with anon key
CREATE POLICY "Enable read access for anon key" ON public.owlcloud_characters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for anon key" ON public.owlcloud_characters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for anon key" ON public.owlcloud_characters
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for anon key" ON public.owlcloud_characters
    FOR DELETE USING (true);

-- Service role gets full access for bot operations
CREATE POLICY "Service role full access" ON public.owlcloud_characters
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );
