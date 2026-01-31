-- Cleanup script: Remove duplicate characters from the database
-- This script keeps only the most recently updated record for each user + character name

-- Step 1: View duplicates (optional - run this first to see what will be cleaned)
-- SELECT user_id_dicecloud, character_name, COUNT(*) as count,
--        array_agg(id) as ids, array_agg(dicecloud_character_id) as char_ids
-- FROM public.owlcloud_characters
-- GROUP BY user_id_dicecloud, character_name
-- HAVING COUNT(*) > 1;

-- Step 2: Delete older duplicates (keeps the most recently updated)
DELETE FROM public.owlcloud_characters a
USING public.owlcloud_characters b
WHERE a.user_id_dicecloud = b.user_id_dicecloud
  AND a.character_name = b.character_name
  AND a.id <> b.id
  AND a.updated_at < b.updated_at;

-- Verify cleanup
SELECT user_id_dicecloud, character_name, COUNT(*) as count
FROM public.owlcloud_characters
GROUP BY user_id_dicecloud, character_name
HAVING COUNT(*) > 1;
-- Should return no rows if cleanup was successful
