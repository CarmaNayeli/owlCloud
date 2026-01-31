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
    const { owlbearPlayerId, character } = await req.json()

    if (!owlbearPlayerId || !character) {
      return new Response(
        JSON.stringify({ error: 'owlbearPlayerId and character are required' }),
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

    // First, mark all characters for this player as inactive
    await supabaseClient
      .from('rollcloud_characters')
      .update({ is_active: false })
      .eq('owlbear_player_id', owlbearPlayerId)

    // Then insert or update the active character
    const { data, error } = await supabaseClient
      .from('rollcloud_characters')
      .upsert({
        owlbear_player_id: owlbearPlayerId,
        dicecloud_character_id: character.id,
        character_name: character.name,
        class: character.class,
        race: character.race,
        level: character.level,
        hp_current: character.hitPoints?.current || 0,
        hp_max: character.hitPoints?.max || 0,
        ac: character.armorClass || 10,
        proficiency_bonus: character.proficiencyBonus || 2,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'owlbear_player_id,dicecloud_character_id'
      })
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
