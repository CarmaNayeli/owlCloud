-- Clean up duplicate auth_tokens records
-- This script removes the duplicate record (ID 63) and keeps the original (ID 16)

-- First, let's see what we have
SELECT 
    id,
    user_id,
    user_id_dicecloud,
    discord_user_id,
    discord_username,
    discord_global_name,
    created_at,
    updated_at
FROM public.auth_tokens 
WHERE id IN (16, 63)
ORDER BY created_at;

-- Remove the duplicate record (ID 63) - it was created by mistake
-- Only run this after verifying the above query shows ID 16 as the original
DELETE FROM public.auth_tokens 
WHERE id = 63;

-- Verify the cleanup worked
SELECT COUNT(*) as total_records,
       COUNT(CASE WHEN discord_user_id IS NOT NULL THEN 1 END) as discord_linked
FROM public.auth_tokens;
