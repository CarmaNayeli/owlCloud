-- Manual Discord Link Update
-- This script manually updates the Discord fields for an existing auth_tokens record
-- Run this in your Supabase SQL Editor

-- STEP 1: Get your Discord information using the /mydiscordinfo command in Discord
-- This will give you your Discord User ID, Username, and Global Name

-- STEP 2: Replace the placeholder values below with your actual Discord information
-- Then run this UPDATE statement

UPDATE public.auth_tokens 
SET 
    discord_user_id = 'REPLACE_WITH_YOUR_DISCORD_USER_ID',
    discord_username = 'REPLACE_WITH_YOUR_DISCORD_USERNAME',
    discord_global_name = 'REPLACE_WITH_YOUR_DISCORD_GLOBAL_NAME',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 16;

-- STEP 3: Verify the update worked correctly
SELECT 
    id,
    user_id,
    username,
    user_id_dicecloud,
    discord_user_id,
    discord_username,
    discord_global_name,
    updated_at
FROM public.auth_tokens 
WHERE id = 16;

-- EXAMPLE (replace with your actual values):
-- UPDATE public.auth_tokens 
-- SET 
--     discord_user_id = '123456789012345678',
--     discord_username = 'your_username',
--     discord_global_name = 'Your Display Name',
--     updated_at = CURRENT_TIMESTAMP
-- WHERE id = 16;
