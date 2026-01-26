-- Manual Discord Link Update for Existing User
-- This script updates your existing auth_tokens record with Discord information
-- Run this in your Supabase SQL Editor

-- Your specific record (ID: 16) needs Discord information
-- Replace these values with your actual Discord details

UPDATE public.auth_tokens 
SET 
    discord_user_id = 'YOUR_DISCORD_USER_ID',
    discord_username = 'YOUR_DISCORD_USERNAME', 
    discord_global_name = 'YOUR_DISCORD_GLOBAL_NAME',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 16;

-- Verify the update
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

-- To get your Discord information, run this command in Discord:
-- /mydiscordinfo (if you deploy the new command I created)
-- Or check your Discord profile:

-- Discord User ID: Right-click your profile in Discord -> Copy User ID
-- Discord Username: Your username without the #1234
-- Discord Global Name: Your display name in Discord
