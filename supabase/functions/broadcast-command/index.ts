// Edge Function to insert command and broadcast to Realtime channel
// This replaces the DB trigger approach for more reliability

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Retry a database operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error)

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break
      }

      // Wait before retrying (exponential backoff)
      const delay = initialDelayMs * Math.pow(2, attempt - 1)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { command } = await req.json()

    if (!command || !command.pairing_id) {
      console.error('❌ Missing command or pairing_id')
      return new Response(
        JSON.stringify({ error: 'Missing command or pairing_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📥 Command received:', {
      type: command.command_type,
      action: command.action_name,
      user: command.discord_username,
      pairing: command.pairing_id?.substring(0, 8) + '...'
    })

    // Insert command into database with retry logic
    const data = await retryOperation(async () => {
      const { data, error: insertError } = await supabase
        .from('rollcloud_commands')
        .insert(command)
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Failed to insert command: ${insertError.message}`)
      }

      return data
    }, 3, 500)

    console.log('✅ Command inserted:', {
      id: data.id,
      type: data.command_type,
      status: data.status
    })

    // Broadcast to the pairing-specific channel using Supabase Realtime
    // The extension expects: message.event === 'broadcast' with message.payload.record
    const channelName = `rollcloud_commands:pairing:${command.pairing_id}`

    const channel = supabase.channel(channelName)

    try {
      const broadcastResult = await channel.send({
        type: 'broadcast',
        event: 'INSERT',
        payload: {
          record: data  // Extension looks for message.payload.record
        }
      })

      console.log('📡 Broadcast result:', broadcastResult)
    } catch (broadcastError) {
      console.error('❌ Broadcast error:', broadcastError)
      // Don't fail the whole function if broadcast fails - command is already in DB
    } finally {
      // Clean up the channel
      await supabase.removeChannel(channel)
    }

    return new Response(
      JSON.stringify({ success: true, command: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
