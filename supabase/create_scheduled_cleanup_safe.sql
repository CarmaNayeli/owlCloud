-- Safe Scheduled Cleanup for owlcloud_commands (NO DROPPING)
-- This creates cleanup functions and monitoring without dropping existing objects

-- Step 1: Create a function that can be called from the extension for cleanup
CREATE OR REPLACE FUNCTION cleanup_and_maintain_commands()
RETURNS TABLE(
    expired_count INTEGER,
    old_pending_count INTEGER,
    old_failed_count INTEGER,
    timeout_marked_count INTEGER,
    total_remaining INTEGER
) AS $$
DECLARE
    expired_commands INTEGER;
    old_pending_commands INTEGER;
    old_failed_commands INTEGER;
    timeout_marked_count INTEGER;
    total_remaining INTEGER;
BEGIN
    -- First, mark expired commands as failed
    SELECT mark_expired_commands_failed() INTO timeout_marked_count;
    
    -- Then run the cleanup
    SELECT * INTO expired_commands, old_pending_commands, old_failed_commands 
    FROM cleanup_old_commands();
    
    -- Get total remaining commands
    SELECT COUNT(*) INTO total_remaining 
    FROM public.owlcloud_commands;
    
    -- Log comprehensive results
    RAISE NOTICE 'Command maintenance completed: timeout_marked=%, expired_deleted=%, old_pending_deleted=%, old_failed_deleted=%, total_remaining=%', 
                  timeout_marked_count, expired_commands, old_pending_commands, old_failed_commands, total_remaining;
    
    RETURN QUERY SELECT timeout_marked_count, expired_commands, old_pending_commands, old_failed_commands, total_remaining;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Try to create a pg_cron job (only works if pg_cron extension is available)
-- This is optional - the extension can call the cleanup function manually
DO $$
BEGIN
    -- Check if pg_cron extension exists
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Check if job already exists
        IF NOT EXISTS (
            SELECT 1 FROM cron.job 
            WHERE schedule = '*/10 * * * *' 
            AND database = current_database() 
            AND command LIKE '%cleanup_and_maintain_commands%'
        ) THEN
            -- Create new scheduled job
            SELECT cron.schedule(
                'owlcloud-command-cleanup',
                '*/10 * * * *', -- Every 10 minutes
                'SELECT cleanup_and_maintain_commands();'
            );
            
            RAISE NOTICE 'Created pg_cron job for automatic command cleanup (every 10 minutes)';
        ELSE
            RAISE NOTICE 'pg_cron job already exists for command cleanup';
        END IF;
    ELSE
        RAISE NOTICE 'pg_cron extension not available - cleanup must be called manually';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create pg_cron job: %', SQLERRM;
END $$;

-- Step 3: Create or replace view for monitoring command status
CREATE OR REPLACE VIEW owlcloud_command_stats AS
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest_created,
    MAX(created_at) as newest_created,
    CASE 
        WHEN status = 'pending' THEN COUNT(*) FILTER (WHERE expires_at < NOW())
        ELSE 0
    END as expired_count
FROM public.owlcloud_commands 
GROUP BY status
UNION ALL
SELECT 
    'total' as status,
    COUNT(*) as count,
    MIN(created_at) as oldest_created,
    MAX(created_at) as newest_created,
    COUNT(*) FILTER (WHERE expires_at < NOW() AND status = 'pending') as expired_count
FROM public.owlcloud_commands;

-- Step 4: Create or replace function to get command health metrics
CREATE OR REPLACE FUNCTION get_command_health_metrics()
RETURNS TABLE(
    total_commands INTEGER,
    pending_commands INTEGER,
    processing_commands INTEGER,
    completed_commands INTEGER,
    failed_commands INTEGER,
    expired_pending INTEGER,
    avg_processing_time_seconds NUMERIC,
    cleanup_needed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH command_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE status = 'pending' AND expires_at < NOW()) as expired_pending,
            EXTRACT(EPOCH FROM (AVG(CASE 
                WHEN processed_at IS NOT NULL 
                THEN processed_at - created_at 
                ELSE NULL 
            END))) as avg_processing_time
        FROM public.owlcloud_commands
    )
    SELECT 
        total,
        pending,
        processing,
        completed,
        failed,
        expired_pending,
        COALESCE(avg_processing_time, 0) as avg_processing_time_seconds,
        (expired_pending > 0 OR pending > 100 OR failed > 50) as cleanup_needed
    FROM command_stats;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comments for documentation
COMMENT ON FUNCTION public.cleanup_and_maintain_commands() IS 'Comprehensive cleanup and maintenance function for commands';
COMMENT ON VIEW public.owlcloud_command_stats IS 'Statistics view for monitoring command status';
COMMENT ON FUNCTION public.get_command_health_metrics() IS 'Returns health metrics for command processing';

-- Step 6: Test the functions (optional - uncomment to test)
-- SELECT * FROM cleanup_and_maintain_commands();
-- SELECT * FROM owlcloud_command_stats;
-- SELECT * FROM get_command_health_metrics();

-- Step 7: Show current status
RAISE NOTICE 'Safe cleanup migration completed. Current command count: %', (SELECT COUNT(*) FROM public.owlcloud_commands);
