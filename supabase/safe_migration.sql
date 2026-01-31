-- Safe Migration: Add missing columns with proper checks and type casting
-- This script handles existing columns gracefully

-- 1. Add user_id_dicecloud column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_characters' AND column_name = 'user_id_dicecloud'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN user_id_dicecloud VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_user_id_dicecloud ON public.owlcloud_characters(user_id_dicecloud);
        COMMENT ON COLUMN public.owlcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';
        RAISE NOTICE 'Added user_id_dicecloud column';
    ELSE
        RAISE NOTICE 'user_id_dicecloud column already exists';
    END IF;
END $$;

-- 2. Add created_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_characters' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.owlcloud_characters.created_at IS 'When the character was first stored';
        RAISE NOTICE 'Added created_at column';
    ELSE
        RAISE NOTICE 'created_at column already exists';
    END IF;
END $$;

-- 3. Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_characters' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.owlcloud_characters ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN public.owlcloud_characters.updated_at IS 'When the character was last updated';
        RAISE NOTICE 'Added updated_at column';
    ELSE
        RAISE NOTICE 'updated_at column already exists';
    END IF;
END $$;

-- 4. Update existing rows with user_id_dicecloud from auth_tokens (with proper type casting)
UPDATE public.owlcloud_characters
SET user_id_dicecloud = (
    SELECT user_id_dicecloud 
    FROM public.auth_tokens 
    WHERE user_id::text = user_id_dicecloud
    LIMIT 1
)
WHERE user_id_dicecloud IS NULL;

-- 5. Update existing rows with timestamps if null
UPDATE public.owlcloud_characters
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

UPDATE public.owlcloud_characters
SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

-- 6. Update existing rows with Discord placeholder if discord_user_id is null
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owlcloud_characters' AND column_name = 'discord_user_id'
    ) THEN
        UPDATE public.owlcloud_characters
        SET discord_user_id = 'not_linked'
        WHERE discord_user_id IS NULL;
        RAISE NOTICE 'Updated discord_user_id placeholders';
    END IF;
END $$;

-- 7. Enable Row Level Security if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'owlcloud_characters' AND rowsecurity = true
    ) THEN
        ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled Row Level Security';
    ELSE
        RAISE NOTICE 'Row Level Security already enabled';
    END IF;
END $$;

-- 8. Drop and recreate RLS policies if they don't exist with correct user_id_dicecloud reference
DO $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own characters" ON public.owlcloud_characters;
    DROP POLICY IF EXISTS "Users can insert own characters" ON public.owlcloud_characters;
    DROP POLICY IF EXISTS "Users can update own characters" ON public.owlcloud_characters;
    DROP POLICY IF EXISTS "Users can delete own characters" ON public.owlcloud_characters;
    DROP POLICY IF EXISTS "Service role full access" ON public.owlcloud_characters;
    
    -- Create RLS policies that use user_id_dicecloud
    CREATE POLICY "Users can view own characters" ON public.owlcloud_characters
        FOR SELECT USING (
            auth.uid()::text = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id::text = user_id_dicecloud)
        );

    CREATE POLICY "Users can insert own characters" ON public.owlcloud_characters
        FOR INSERT WITH CHECK (
            auth.uid()::text = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id::text = user_id_dicecloud)
        );

    CREATE POLICY "Users can update own characters" ON public.owlcloud_characters
        FOR UPDATE USING (
            auth.uid()::text = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id::text = user_id_dicecloud)
        );

    CREATE POLICY "Users can delete own characters" ON public.owlcloud_characters
        FOR DELETE USING (
            auth.uid()::text = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id::text = user_id_dicecloud)
        );

    CREATE POLICY "Service role full access" ON public.owlcloud_characters
        FOR ALL USING (
            auth.jwt() ->> 'role' = 'service_role'
        );
    
    RAISE NOTICE 'Created RLS policies';
END $$;
