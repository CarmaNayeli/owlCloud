import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await context.params;

    // Check if the bot is in the server by trying to fetch bot's guilds
    // This requires the bot token to be available
    const botToken = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      console.error('❌ No Discord bot token found in environment variables');
      console.log('🔍 Available env vars:', {
        DISCORD_TOKEN: !!process.env.DISCORD_TOKEN,
        DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN
      });
      return NextResponse.json({ botPresent: false });
    }

    // Check if bot is in the server by fetching bot's guilds
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Bot API error:', response.status, response.statusText);
      return NextResponse.json({ botPresent: false });
    }

    const botGuilds = await response.json();
    const botInServer = botGuilds.some((guild: any) => guild.id === serverId);

    return NextResponse.json({ botPresent: botInServer });
  } catch (error) {
    console.error('Error checking bot presence:', error);
    return NextResponse.json({ botPresent: false });
  }
}
