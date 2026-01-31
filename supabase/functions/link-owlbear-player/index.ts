import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { owlbearPlayerId, dicecloudUserId } = await req.json()

    if (!owlbearPlayerId || !dicecloudUserId) {
      return new Response(
        JSON.stringify({ error: 'owlbearPlayerId and dicecloudUserId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Update all characters for this DiceCloud user to include the Owlbear player ID
    const { data, error } = await supabaseClient
      .from('rollcloud_characters')
      .update({
        owlbear_player_id: owlbearPlayerId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id_dicecloud', dicecloudUserId)
      .select()

    if (error) {
      console.error('Error updating characters:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Linked ${data?.length || 0} character(s) to Owlbear player ${owlbearPlayerId}`)

    return new Response(
      JSON.stringify({
        success: true,
        linkedCharacters: data?.length || 0,
        message: `Successfully linked ${data?.length || 0} character(s) to Owlbear`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
