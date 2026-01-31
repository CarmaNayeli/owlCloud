// Edge Function to manage guild command configuration
// GET: Fetch disabled commands for a guild
// POST: Update disabled commands for a guild

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Available commands that can be toggled
// This is the source of truth for what commands exist
const AVAILABLE_COMMANDS = [
  { name: 'owlcloud', description: 'Connect your OwlCloud extension to Discord', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'character', description: 'Check character status and Discord integration', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'characters', description: 'List your synced characters', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'roll20', description: 'Check Roll20 connection status', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'sheet', description: 'View detailed character sheet information', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'roll', description: 'Roll dice or make ability checks from your character sheet', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'use', description: 'Use character abilities and spells', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'cast', description: 'Cast spells from your character sheet', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'stats', description: 'Quick stat lookup and rolls', category: 'OwlCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'ping', description: 'Check bot responsiveness', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'help', description: 'Show help information', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'coin', description: 'Flip a coin for random decisions', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'reactionrole', description: 'Configure reaction roles', category: 'Moderation', defaultPermissions: ['MANAGE_ROLES'] },
  { name: 'changelog', description: 'Manage changelog entries', category: 'Moderation', defaultPermissions: ['MANAGE_MESSAGES'] },
  { name: 'ticket', description: 'Create and manage tickets', category: 'Moderation', defaultPermissions: ['MANAGE_CHANNELS'] },
]

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const url = new URL(req.url)
    const guildId = url.searchParams.get('guild_id')

    if (!guildId) {
      return new Response(
        JSON.stringify({ error: 'Missing guild_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET: Fetch command configuration for a guild
    if (req.method === 'GET') {
      const { data: config, error } = await supabase
        .from('guild_command_config')
        .select('*')
        .eq('guild_id', guildId)
        .single()

      // If no config exists, return all commands as enabled (default state)
      const disabledCommands = config?.disabled_commands || []

      // Build command list with enabled status
      const commands = AVAILABLE_COMMANDS.map(cmd => ({
        ...cmd,
        enabled: !disabledCommands.includes(cmd.name)
      }))

      return new Response(
        JSON.stringify({
          success: true,
          guild_id: guildId,
          commands,
          config: config || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST: Update command configuration for a guild
    if (req.method === 'POST') {
      const body = await req.json()
      const { disabled_commands, modified_by_discord_id, modified_by_username } = body

      if (!Array.isArray(disabled_commands)) {
        return new Response(
          JSON.stringify({ error: 'disabled_commands must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate that all disabled commands are valid command names
      const validCommandNames = AVAILABLE_COMMANDS.map(c => c.name)
      const invalidCommands = disabled_commands.filter(c => !validCommandNames.includes(c))
      if (invalidCommands.length > 0) {
        return new Response(
          JSON.stringify({ error: `Invalid command names: ${invalidCommands.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Upsert the configuration
      const { data, error } = await supabase
        .from('guild_command_config')
        .upsert({
          guild_id: guildId,
          disabled_commands,
          modified_by_discord_id,
          modified_by_username,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'guild_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Upsert error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to save configuration', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Return updated command list
      const commands = AVAILABLE_COMMANDS.map(cmd => ({
        ...cmd,
        enabled: !disabled_commands.includes(cmd.name)
      }))

      return new Response(
        JSON.stringify({
          success: true,
          guild_id: guildId,
          commands,
          config: data
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
