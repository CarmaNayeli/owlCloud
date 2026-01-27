-- Add session invalidation columns to auth_tokens table
-- This enables explicit logout when logging in from another browser with the same account

-- Add invalidated_at column for tracking when a session was forcibly logged out
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_tokens' AND column_name = 'invalidated_at'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN invalidated_at TIMESTAMPTZ;
        CREATE INDEX idx_auth_tokens_invalidated_at ON auth_tokens(invalidated_at);
        COMMENT ON COLUMN auth_tokens.invalidated_at IS 'Timestamp when this session was invalidated by another login';
    END IF;
END $$;

-- Add invalidated_by_session column to track which session caused the invalidation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_tokens' AND column_name = 'invalidated_by_session'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN invalidated_by_session TEXT;
        COMMENT ON COLUMN auth_tokens.invalidated_by_session IS 'Session ID of the login that caused this session to be invalidated';
    END IF;
END $$;

-- Add invalidated_reason column for human-readable invalidation reason
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_tokens' AND column_name = 'invalidated_reason'
    ) THEN
        ALTER TABLE auth_tokens ADD COLUMN invalidated_reason TEXT;
        COMMENT ON COLUMN auth_tokens.invalidated_reason IS 'Reason for session invalidation (e.g., logged_in_elsewhere)';
    END IF;
END $$;

-- Add index on user_id_dicecloud for faster lookups when invalidating other sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'auth_tokens' AND indexname = 'idx_auth_tokens_user_id_dicecloud'
    ) THEN
        CREATE INDEX idx_auth_tokens_user_id_dicecloud ON auth_tokens(user_id_dicecloud);
    END IF;
END $$;

-- Function to invalidate all sessions for a DiceCloud user except the current one
CREATE OR REPLACE FUNCTION invalidate_other_sessions(
    p_dicecloud_user_id TEXT,
    p_current_session_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
    invalidated_count INTEGER;
BEGIN
    UPDATE auth_tokens
    SET
        invalidated_at = NOW(),
        invalidated_by_session = p_current_session_id,
        invalidated_reason = 'logged_in_elsewhere'
    WHERE user_id_dicecloud = p_dicecloud_user_id
    AND (session_id IS NULL OR session_id != p_current_session_id)
    AND invalidated_at IS NULL;

    GET DIAGNOSTICS invalidated_count = ROW_COUNT;

    RETURN invalidated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION invalidate_other_sessions(TEXT, TEXT) IS 'Invalidate all sessions for a DiceCloud user except the specified session';

-- Function to clean up invalidated sessions older than 7 days
CREATE OR REPLACE FUNCTION cleanup_invalidated_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth_tokens
    WHERE invalidated_at IS NOT NULL
    AND invalidated_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_invalidated_sessions() IS 'Clean up sessions that were invalidated more than 7 days ago';
