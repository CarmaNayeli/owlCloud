import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await context.params;

    // Get bot token
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      // For development, return mock channels
      return NextResponse.json({
        channels: [
          { id: 'general-channel', name: 'general', type: 0 },
          { id: 'text-channel', name: 'text-chat', type: 0 },
        ]
      });
    }

    // Fetch server channels from Discord API
    const response = await fetch(`https://discord.com/api/guilds/${serverId}/channels`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Discord API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: response.status });
    }

    const channels = await response.json();
    
    // Filter for text channels only
    const textChannels = channels.filter((channel: any) => channel.type === 0);
    
    return NextResponse.json({ channels: textChannels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
