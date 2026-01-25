import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = (session.user as any).discordId;

  if (!discordId) {
    return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
  }

  const { data: instances, error } = await supabase
    .from('pip2_instances')
    .select('*')
    .eq('discord_user_id', discordId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching instances:', error);
    return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
  }

  return NextResponse.json({ instances: instances || [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = (session.user as any).discordId;

  if (!discordId) {
    return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { guild_id, guild_name, channel_id, channel_name } = body;

    if (!guild_id || !channel_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: instance, error } = await supabase
      .from('pip2_instances')
      .insert({
        discord_user_id: discordId,
        guild_id,
        guild_name: guild_name || 'Unknown Server',
        channel_id,
        channel_name: channel_name || 'unknown',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating instance:', error);
      return NextResponse.json({ error: 'Failed to create instance' }, { status: 500 });
    }

    return NextResponse.json({ instance });
  } catch (err) {
    console.error('Error parsing request:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
