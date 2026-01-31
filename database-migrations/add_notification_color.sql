-- Add notification_color column to owlcloud_characters table
-- This column stores the user's preferred notification color for the character

ALTER TABLE owlcloud_characters 
ADD COLUMN notification_color TEXT DEFAULT '#3498db';

-- Add comment for documentation
COMMENT ON COLUMN owlcloud_characters.notification_color IS 'User-selected notification color for Discord messages (hex format)';

-- Optional: Create index for faster queries if you plan to filter by color
-- CREATE INDEX idx_owlcloud_characters_notification_color ON owlcloud_characters(notification_color);
