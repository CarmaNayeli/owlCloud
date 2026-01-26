-- Fix RollCloud Characters RLS Policies for Anonymous Access
-- The extension uses anon key without Supabase Auth, so auth.uid() won't work
-- This migration adds anonymous access policies like the other rollcloud tables

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can insert own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can update own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Users can delete own characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Service role full access" ON public.rollcloud_characters;

-- 2. Drop anonymous policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Allow anonymous read characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous insert characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous update characters" ON public.rollcloud_characters;
DROP POLICY IF EXISTS "Allow anonymous delete characters" ON public.rollcloud_characters;

-- 3. Create new anonymous access policies (matching other rollcloud tables)

-- Allow anonymous reads (extension and bot need to query characters)
CREATE POLICY "Allow anonymous read characters" ON public.rollcloud_characters
  FOR SELECT USING (true);

-- Allow anonymous inserts (extension stores characters)
CREATE POLICY "Allow anonymous insert characters" ON public.rollcloud_characters
  FOR INSERT WITH CHECK (true);

-- Allow anonymous updates (extension updates characters)
CREATE POLICY "Allow anonymous update characters" ON public.rollcloud_characters
  FOR UPDATE USING (true);

-- Allow anonymous deletes (extension can remove characters)
CREATE POLICY "Allow anonymous delete characters" ON public.rollcloud_characters
  FOR DELETE USING (true);

-- 4. Verify RLS is still enabled
ALTER TABLE public.rollcloud_characters ENABLE ROW LEVEL SECURITY;

-- Done! The rollcloud_characters table now allows anonymous access like the other tables.
