import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = (session.user as any).discordId;
  const { id: instanceId } = await params;

  if (!discordId) {
    return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // First verify the instance belongs to this user
    const { data: existing } = await supabase
      .from('pip2_instances')
      .select('id')
      .eq('id', instanceId)
      .eq('discord_user_id', discordId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Update the instance
    const { data: instance, error } = await supabase
      .from('pip2_instances')
      .update({ is_active: body.is_active })
      .eq('id', instanceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating instance:', error);
      return NextResponse.json({ error: 'Failed to update instance' }, { status: 500 });
    }

    return NextResponse.json({ instance });
  } catch (err) {
    console.error('Error parsing request:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = (session.user as any).discordId;
  const { id: instanceId } = await params;

  if (!discordId) {
    return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
  }

  // First verify the instance belongs to this user
  const { data: existing } = await supabase
    .from('pip2_instances')
    .select('id')
    .eq('id', instanceId)
    .eq('discord_user_id', discordId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  // Delete the instance
  const { error } = await supabase
    .from('pip2_instances')
    .delete()
    .eq('id', instanceId);

  if (error) {
    console.error('Error deleting instance:', error);
    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
