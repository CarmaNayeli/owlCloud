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
    const owlbearPlayerId = url.searchParams.get('owlbear_player_id')

    if (!userId && !pairingCode && !owlbearPlayerId) {
      return new Response(
        JSON.stringify({ error: 'Either user_id, pairing_code, or owlbear_player_id is required' }),
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

    let charactersData = []

    if (owlbearPlayerId) {
      // Get all characters by Owlbear player ID
      const { data, error } = await supabaseClient
        .from('rollcloud_characters')
        .select('*')
        .eq('owlbear_player_id', owlbearPlayerId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error querying by owlbear_player_id:', error)
        throw error
      }

      charactersData = data || []
    } else if (pairingCode) {
      // Get Discord user ID from pairing code
      const { data: pairing, error: pairingError } = await supabaseClient
        .from('rollcloud_pairings')
        .select('discord_user_id')
        .eq('pairing_code', pairingCode)
        .eq('status', 'connected')
        .maybeSingle()

      if (pairingError) {
        console.error('Error querying pairing:', pairingError)
        throw pairingError
      }

      if (!pairing) {
        return new Response(
          JSON.stringify({ error: 'Invalid or disconnected pairing code' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Get all characters for this Discord user
      const { data, error } = await supabaseClient
        .from('rollcloud_characters')
        .select('*')
        .eq('discord_user_id', pairing.discord_user_id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error querying by discord_user_id:', error)
        throw error
      }

      charactersData = data || []
    } else {
      // Get all characters by DiceCloud user ID
      const { data, error } = await supabaseClient
        .from('rollcloud_characters')
        .select('*')
        .eq('user_id_dicecloud', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error querying by user_id_dicecloud:', error)
        throw error
      }

      charactersData = data || []
    }

    // Transform characters data to include full raw data if available
    const characters = charactersData.map(characterData => {
      let fullCharacterData: any = {}

      // If raw_dicecloud_data exists, use it as the base (contains all character details)
      if (characterData.raw_dicecloud_data && typeof characterData.raw_dicecloud_data === 'object') {
        fullCharacterData = characterData.raw_dicecloud_data
      }

      // Overlay/ensure basic fields are present (for backward compatibility and non-raw sources)
      return {
        ...fullCharacterData,
        id: characterData.dicecloud_character_id,
        name: characterData.character_name,
        class: characterData.class,
        race: characterData.race,
        level: characterData.level,
        hitPoints: characterData.hit_points || fullCharacterData.hitPoints || { current: 0, max: 0 },
        armorClass: characterData.armor_class || fullCharacterData.armorClass || 10,
        proficiencyBonus: characterData.proficiency_bonus || fullCharacterData.proficiencyBonus || 2,
        // Ensure portrait fields are preserved from raw data
        picture: fullCharacterData.picture,
        avatarPicture: fullCharacterData.avatarPicture,
        updatedAt: characterData.updated_at,
        isActive: characterData.is_active || false,
        source: 'database'
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        characters: characters,
        count: characters.length
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
