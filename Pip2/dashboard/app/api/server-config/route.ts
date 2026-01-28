import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Available commands that can be toggled
// This is the source of truth for what commands exist
const AVAILABLE_COMMANDS = [
  { name: 'rollcloud', description: 'Connect your RollCloud extension to Discord', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'character', description: 'Check character status and Discord integration', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'characters', description: 'List your synced characters', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'roll20', description: 'Check Roll20 connection status', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'sheet', description: 'View detailed character sheet information', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'roll', description: 'Roll dice or make ability checks from your character sheet', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'use', description: 'Use character abilities and spells', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'cast', description: 'Cast spells from your character sheet', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'stats', description: 'Quick stat lookup and rolls', category: 'RollCloud', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'ping', description: 'Check bot responsiveness', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'help', description: 'Show help information', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'coin', description: 'Flip a coin for random decisions', category: 'Utility', defaultPermissions: ['USE_APPLICATION_COMMANDS'] },
  { name: 'reactionrole', description: 'Configure reaction roles', category: 'Moderation', defaultPermissions: ['MANAGE_ROLES'] },
  { name: 'changelog', description: 'Manage changelog entries', category: 'Moderation', defaultPermissions: ['MANAGE_MESSAGES'] },
  { name: 'ticket', description: 'Create and manage tickets', category: 'Moderation', defaultPermissions: ['MANAGE_CHANNELS'] },
];

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const guildId = request.nextUrl.searchParams.get('guild_id');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guild_id parameter' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Fetch the config for this guild
  const { data: config, error } = await supabase
    .from('guild_command_config')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  // If no config exists (PGRST116), that's fine - all commands are enabled by default
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching server config:', error);
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
  }

  // Build command list with enabled status
  const disabledCommands: string[] = config?.disabled_commands || [];
  const commands = AVAILABLE_COMMANDS.map(cmd => ({
    ...cmd,
    enabled: !disabledCommands.includes(cmd.name)
  }));

  return NextResponse.json({
    success: true,
    guild_id: guildId,
    commands,
    config: config || null
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = (session.user as any).discordId;
  const discordUsername = session.user.name;

  try {
    const body = await request.json();
    const { guild_id, disabled_commands } = body;

    if (!guild_id) {
      return NextResponse.json({ error: 'Missing guild_id' }, { status: 400 });
    }

    if (!Array.isArray(disabled_commands)) {
      return NextResponse.json({ error: 'disabled_commands must be an array' }, { status: 400 });
    }

    // Validate that all disabled commands are valid command names
    const validCommandNames = AVAILABLE_COMMANDS.map(c => c.name);
    const invalidCommands = disabled_commands.filter((c: string) => !validCommandNames.includes(c));
    if (invalidCommands.length > 0) {
      return NextResponse.json({
        error: `Invalid command names: ${invalidCommands.join(', ')}`
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Upsert the configuration
    const { data: config, error } = await supabase
      .from('guild_command_config')
      .upsert({
        guild_id,
        disabled_commands,
        modified_by_discord_id: discordId,
        modified_by_username: discordUsername,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving server config:', error);
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }

    // Return updated command list
    const commands = AVAILABLE_COMMANDS.map(cmd => ({
      ...cmd,
      enabled: !disabled_commands.includes(cmd.name)
    }));

    return NextResponse.json({
      success: true,
      guild_id,
      commands,
      config
    });
  } catch (err) {
    console.error('Error parsing request:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
