-- Simple Discord fields migration - no RAISE statements
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the existing debug view first
DROP VIEW IF EXISTS public.auth_tokens_debug;

-- Step 2: Add discord_user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'discord_user_id'
    ) THEN
        ALTER TABLE public.auth_tokens ADD COLUMN discord_user_id VARCHAR(255);
    END IF;
END $$;

-- Step 3: Add discord_username column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'discord_username'
    ) THEN
        ALTER TABLE public.auth_tokens ADD COLUMN discord_username VARCHAR(255);
    END IF;
END $$;

-- Step 4: Add discord_global_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'discord_global_name'
    ) THEN
        ALTER TABLE public.auth_tokens ADD COLUMN discord_global_name VARCHAR(255);
    END IF;
END $$;

-- Step 5: Add index for discord_user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_tokens' AND indexname = 'idx_auth_tokens_discord_user_id'
    ) THEN
        CREATE INDEX idx_auth_tokens_discord_user_id ON public.auth_tokens(discord_user_id);
    END IF;
END $$;

-- Step 6: Add comments for the new columns
COMMENT ON COLUMN public.auth_tokens.discord_user_id IS 'Discord user ID (linked account)';
COMMENT ON COLUMN public.auth_tokens.discord_username IS 'Discord username (linked account)';
COMMENT ON COLUMN public.auth_tokens.discord_global_name IS 'Discord global name (display name)';

-- Step 7: Recreate the debug view with Discord fields
CREATE VIEW public.auth_tokens_debug AS
SELECT 
    id,
    user_id,
    username,
    user_id_dicecloud,
    discord_user_id,
    discord_username,
    discord_global_name,
    token_expires,
    browser_info->>'userAgent' as browser,
    browser_info->>'timestamp' as last_seen,
    created_at,
    updated_at,
    CASE 
        WHEN token_expires IS NOT NULL AND token_expires < NOW() THEN 'expired'
        WHEN token_expires IS NULL THEN 'no_expiry'
        ELSE 'active'
    END as status,
    CASE 
        WHEN discord_user_id IS NOT NULL THEN 'discord_linked'
        ELSE 'dicecloud_only'
    END as account_type
FROM public.auth_tokens
ORDER BY updated_at DESC;

COMMENT ON VIEW public.auth_tokens_debug IS 'Debug view for auth tokens with status and Discord linking information';

-- Step 8: Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'auth_tokens' 
AND column_name IN ('discord_user_id', 'discord_username', 'discord_global_name')
ORDER BY column_name;
