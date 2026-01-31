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
    // Get query parameters
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const pairingCode = url.searchParams.get('pairing_code')

    if (!userId && !pairingCode) {
      return new Response(
        JSON.stringify({ error: 'Either user_id or pairing_code is required' }),
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

    let characterData = null

    if (pairingCode) {
      // Get Discord user ID from pairing code
      const { data: pairing, error: pairingError } = await supabaseClient
        .from('rollcloud_pairings')
        .select('discord_user_id')
        .eq('pairing_code', pairingCode)
        .eq('status', 'connected')
        .single()

      if (pairingError || !pairing) {
        return new Response(
          JSON.stringify({ error: 'Invalid or disconnected pairing code' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Get active character for this Discord user
      const { data, error } = await supabaseClient
        .from('rollcloud_characters')
        .select('*')
        .eq('discord_user_id', pairing.discord_user_id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      characterData = data
    } else {
      // Get active character by DiceCloud user ID
      const { data, error } = await supabaseClient
        .from('rollcloud_characters')
        .select('*')
        .eq('user_id_dicecloud', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      characterData = data
    }

    if (!characterData) {
      return new Response(
        JSON.stringify({
          success: true,
          character: null,
          message: 'No active character found'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return character data
    return new Response(
      JSON.stringify({
        success: true,
        character: {
          id: characterData.dicecloud_character_id,
          name: characterData.character_name,
          class: characterData.class,
          race: characterData.race,
          level: characterData.level,
          hitPoints: {
            current: characterData.hp_current,
            max: characterData.hp_max
          },
          armorClass: characterData.ac,
          proficiencyBonus: characterData.proficiency_bonus,
          updatedAt: characterData.updated_at
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
