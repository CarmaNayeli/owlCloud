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
    const { owlbearPlayerId, characterId, hitPoints } = await req.json()

    if (!owlbearPlayerId || !characterId || !hitPoints) {
      return new Response(
        JSON.stringify({ error: 'owlbearPlayerId, characterId, and hitPoints are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate hitPoints structure
    if (typeof hitPoints.current !== 'number' || typeof hitPoints.max !== 'number') {
      return new Response(
        JSON.stringify({ error: 'hitPoints must contain current and max numeric values' }),
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

    // Update character HP
    const { data, error } = await supabaseClient
      .from('rollcloud_characters')
      .update({
        hit_points: hitPoints,
        updated_at: new Date().toISOString()
      })
      .eq('owlbear_player_id', owlbearPlayerId)
      .eq('dicecloud_character_id', characterId)
      .select()
      .single()

    if (error) {
      console.error('Error updating HP:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Character not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        character: data
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
