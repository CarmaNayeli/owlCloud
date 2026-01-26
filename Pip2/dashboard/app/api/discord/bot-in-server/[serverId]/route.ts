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
        DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN,
        NEXT_PUBLIC_DISCORD_CLIENT_ID: !!process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
      });
      return NextResponse.json({ 
        botPresent: false, 
        error: 'Bot token not configured' 
      });
    }

    console.log(`🔍 Checking if bot is in server ${serverId}`);

    // Check if bot is in the server by fetching bot's guilds
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Bot API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error details:', errorText);
      return NextResponse.json({ 
        botPresent: false, 
        error: `Bot API error: ${response.status} ${response.statusText}` 
      });
    }

    const botGuilds = await response.json();
    console.log(`📊 Bot is in ${botGuilds.length} servers`);
    
    const botInServer = botGuilds.some((guild: any) => guild.id === serverId);
    console.log(`🔍 Bot in server ${serverId}: ${botInServer}`);

    return NextResponse.json({ 
      botPresent: botInServer,
      botGuildsCount: botGuilds.length
    });
  } catch (error) {
    console.error('Error checking bot presence:', error);
    return NextResponse.json({ botPresent: false });
  }
}
