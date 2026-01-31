-- Fix OwlCloud Characters RLS Policies for Anonymous Access
-- The extension uses anon key without Supabase Auth, so auth.uid() won't work
-- This migration adds anonymous access policies like the other owlcloud tables
--
-- SECURITY NOTE: Because the extension authenticates via DiceCloud tokens stored
-- in the auth_tokens table (not Supabase Auth), RLS cannot enforce per-user
-- isolation at the database level. User isolation is enforced at the application
-- level by filtering queries with user_id_dicecloud and by refusing to store
-- characters without a valid user_id_dicecloud (see background.js).

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can insert own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can update own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Users can delete own characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.owlcloud_characters;

-- 2. Drop anonymous policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Allow anonymous read characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous insert characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous update characters" ON public.owlcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous delete characters" ON public.owlcloud_characters;

-- 3. Create new anonymous access policies (matching other owlcloud tables)

-- Allow anonymous reads (extension and bot need to query characters)
CREATE POLICY "Allow anonymous read characters" ON public.owlcloud_characters
  FOR SELECT USING (true);

-- Allow anonymous inserts (extension stores characters) - require non-null user_id_dicecloud
CREATE POLICY "Allow anonymous insert characters" ON public.owlcloud_characters
  FOR INSERT WITH CHECK (user_id_dicecloud IS NOT NULL);

-- Allow anonymous updates (extension updates characters)
CREATE POLICY "Allow anonymous update characters" ON public.owlcloud_characters
  FOR UPDATE USING (true);

-- Allow anonymous deletes (extension can remove characters)
CREATE POLICY "Allow anonymous delete characters" ON public.owlcloud_characters
  FOR DELETE USING (true);

-- 4. Verify RLS is still enabled
ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;

-- 5. Add unique constraint on (user_id_dicecloud, dicecloud_character_id) to prevent
-- duplicate rows for the same character. This is required for PostgREST's
-- "Prefer: resolution=merge-duplicates" header to work as an upsert.
-- First deduplicate any existing rows, keeping only the most recently updated one.
DELETE FROM public.owlcloud_characters a
  USING public.owlcloud_characters b
  WHERE a.user_id_dicecloud = b.user_id_dicecloud
    AND a.dicecloud_character_id = b.dicecloud_character_id
    AND a.updated_at < b.updated_at;

-- Now add the unique constraint (if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'owlcloud_characters'
      AND constraint_name = 'unique_user_character'
  ) THEN
    ALTER TABLE public.owlcloud_characters
      ADD CONSTRAINT unique_user_character UNIQUE (user_id_dicecloud, dicecloud_character_id);
  END IF;
END $$;

-- Done! The owlcloud_characters table now:
-- - Allows anonymous access for reads, updates, and deletes
-- - Requires non-null user_id_dicecloud on insert (prevents orphaned characters)
-- - Has a unique constraint preventing duplicate character entries per user
