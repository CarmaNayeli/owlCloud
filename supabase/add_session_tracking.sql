-- Add session tracking to auth_tokens table
-- This enables detection of multiple browser logins and automatic logout

-- Add session_id column for unique session identification
ALTER TABLE auth_tokens 
ADD COLUMN session_id TEXT;

-- Add last_seen column for tracking active sessions
ALTER TABLE auth_tokens 
ADD COLUMN last_seen TIMESTAMPTZ;

-- Add browser_info as JSONB for detailed session information
ALTER TABLE auth_tokens 
ADD COLUMN browser_info JSONB;

-- Create index on session_id for efficient lookups
CREATE INDEX idx_auth_tokens_session_id ON auth_tokens(session_id);

-- Create index on last_seen for cleanup of old sessions
CREATE INDEX idx_auth_tokens_last_seen ON auth_tokens(last_seen);

-- Add unique constraint on user_id + session_id to prevent duplicate sessions
ALTER TABLE auth_tokens 
ADD CONSTRAINT unique_user_session UNIQUE (user_id, session_id);

-- Update existing records with default session info
UPDATE auth_tokens 
SET 
    session_id = 'legacy_' || gen_random_uuid(),
    last_seen = NOW(),
    browser_info = jsonb_build_object(
        'userAgent', 'Legacy Session',
        'timestamp', NOW(),
        'sessionId', 'legacy_' || gen_random_uuid()
    )
WHERE session_id IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN auth_tokens.session_id IS 'Unique identifier for each browser session';
COMMENT ON COLUMN auth_tokens.last_seen IS 'Timestamp when this session was last active';
COMMENT ON COLUMN auth_tokens.browser_info IS 'JSON containing browser details and session metadata';
