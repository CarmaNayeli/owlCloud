// Edge Function to insert command and broadcast to Realtime channel
// This replaces the DB trigger approach for more reliability

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { command } = await req.json()

    if (!command || !command.pairing_id) {
      return new Response(
        JSON.stringify({ error: 'Missing command or pairing_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert command into database
    const { data, error: insertError } = await supabase
      .from('rollcloud_commands')
      .insert(command)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to insert command', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Broadcast to the pairing-specific channel
    const channelName = `rollcloud_commands:pairing:${command.pairing_id}`

    const channel = supabase.channel(channelName)

    const broadcastResult = await channel.send({
      type: 'broadcast',
      event: 'INSERT',
      payload: data
    })

    console.log('Broadcast result:', broadcastResult)

    // Unsubscribe from channel after sending
    await supabase.removeChannel(channel)

    return new Response(
      JSON.stringify({ success: true, command: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
