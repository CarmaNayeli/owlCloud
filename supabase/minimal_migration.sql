-- Minimal Migration: Add only the missing user_id_dicecloud column
-- Run this if other columns already exist

-- 1. Add user_id_dicecloud column (this is the critical missing column)
ALTER TABLE public.owlcloud_characters ADD COLUMN user_id_dicecloud VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_user_id_dicecloud ON public.owlcloud_characters(user_id_dicecloud);
COMMENT ON COLUMN public.owlcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';

-- 2. Update existing rows with user_id_dicecloud from auth_tokens
UPDATE public.owlcloud_characters
SET user_id_dicecloud = (
    SELECT user_id_dicecloud 
    FROM public.auth_tokens 
    WHERE user_id = user_id_dicecloud
    LIMIT 1
)
WHERE user_id_dicecloud IS NULL;

-- 3. Enable Row Level Security (if not already enabled)
ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate RLS policies for user_id_dicecloud
DROP POLICY IF EXISTS "Users can view own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can insert own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can update own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can delete own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.owlcloud_characters;

-- 5. Create RLS policies that use user_id_dicecloud
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
