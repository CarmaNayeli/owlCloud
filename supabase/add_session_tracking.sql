-- Add session tracking to auth_tokens table
-- This enables detection of multiple browser logins and automatic logout

-- Add session_id column for unique session identification (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN session_id TEXT;
        CREATE INDEX idx_auth_tokens_session_id ON auth_tokens(session_id);
        COMMENT ON COLUMN auth_tokens.session_id IS 'Unique identifier for each browser session';
    END IF;
END $$;

-- Add last_seen column for tracking active sessions (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'last_seen'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN last_seen TIMESTAMPTZ;
        CREATE INDEX idx_auth_tokens_last_seen ON auth_tokens(last_seen);
        COMMENT ON COLUMN auth_tokens.last_seen IS 'Timestamp when this session was last active';
    END IF;
END $$;

-- Ensure browser_info column exists and is JSONB (for detailed session information)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_tokens' AND column_name = 'browser_info'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN browser_info JSONB DEFAULT '{}';
        COMMENT ON COLUMN auth_tokens.browser_info IS 'JSON containing browser details and session metadata';
    END IF;
END $$;

-- Add unique constraint on user_id + session_id to prevent duplicate sessions (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'auth_tokens' AND constraint_name = 'unique_user_session'
    ) THEN
        ALTER TABLE auth_tokens ADD CONSTRAINT unique_user_session UNIQUE (user_id, session_id);
    END IF;
END $$;

-- Update existing records with default session info (for records without session_id)
UPDATE auth_tokens 
SET 
    session_id = 'legacy_' || gen_random_uuid(),
    last_seen = COALESCE(last_seen, NOW()),
    browser_info = COALESCE(
        browser_info, 
        jsonb_build_object(
            'userAgent', COALESCE((browser_info->>'userAgent'), 'Legacy Session'),
            'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
            'sessionId', 'legacy_' || gen_random_uuid()
        )
    )
WHERE session_id IS NULL OR session_id = '';

-- Create a function to clean up old sessions (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete sessions that haven't been seen in 30 days
    DELETE FROM auth_tokens 
    WHERE last_seen < NOW() - INTERVAL '30 days'
    AND session_id NOT LIKE 'legacy_%';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_sessions() IS 'Clean up sessions inactive for 30+ days (excludes legacy sessions)';
