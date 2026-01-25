import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any)?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session as any).accessToken;

    // Fetch user's Discord servers
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Discord API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch servers from Discord' }, { status: response.status });
    }

    const guilds = await response.json();
    
    // Transform Discord guild data to our interface
    const servers = guilds.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      permissions: guild.permissions,
      botMember: false, // Will be checked separately
      owner: guild.owner,
      features: guild.features || []
    }));

    return NextResponse.json(servers);
  } catch (error) {
    console.error('Error fetching Discord servers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
