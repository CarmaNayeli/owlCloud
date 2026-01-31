-- Simple Migration: Add missing columns to owlcloud_characters table
-- Run these commands one by one in Supabase SQL Editor

-- 1. Add user_id_dicecloud column
ALTER TABLE public.owlcloud_characters ADD COLUMN user_id_dicecloud VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_user_id_dicecloud ON public.owlcloud_characters(user_id_dicecloud);
COMMENT ON COLUMN public.owlcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';

-- 2. Add discord_user_id column  
ALTER TABLE public.owlcloud_characters ADD COLUMN discord_user_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_discord_user_id ON public.owlcloud_characters(discord_user_id);
COMMENT ON COLUMN public.owlcloud_characters.discord_user_id IS 'Discord user ID for linked accounts';

-- 3. Add pairing_id column
ALTER TABLE public.owlcloud_characters ADD COLUMN pairing_id UUID REFERENCES public.owlcloud_pairings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_pairing_id ON public.owlcloud_characters(pairing_id);
COMMENT ON COLUMN public.owlcloud_characters.pairing_id IS 'Discord pairing reference for bot commands';

-- 4. Add created_at column
ALTER TABLE public.owlcloud_characters ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
COMMENT ON COLUMN public.owlcloud_characters.created_at IS 'When the character was first stored';

-- 5. Add updated_at column
ALTER TABLE public.owlcloud_characters ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
COMMENT ON COLUMN public.owlcloud_characters.updated_at IS 'When the character was last updated';

-- 6. Update existing rows with user_id_dicecloud from auth_tokens
UPDATE public.owlcloud_characters
SET user_id_dicecloud = (
    SELECT user_id_dicecloud 
    FROM public.auth_tokens 
    WHERE user_id = user_id_dicecloud
    LIMIT 1
)
WHERE user_id_dicecloud IS NULL;

-- 7. Update existing rows with timestamps
UPDATE public.owlcloud_characters
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

UPDATE public.owlcloud_characters
SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

-- 8. Update existing rows with Discord placeholder
UPDATE public.owlcloud_characters
SET discord_user_id = 'not_linked'
WHERE discord_user_id IS NULL;

-- 9. Enable Row Level Security
ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;

-- 10. Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Users can view own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can insert own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can update own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can delete own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.owlcloud_characters;

-- 11. Create RLS policies
CREATE POLICY "Users can view own characters" ON public.owlcloud_characters
    FOR SELECT USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own characters" ON public.owlcloud_characters
    FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own characters" ON public.owlcloud_characters
    FOR UPDATE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete own characters" ON public.owlcloud_characters
    FOR DELETE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role full access" ON public.owlcloud_characters
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );
