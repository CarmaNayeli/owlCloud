import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
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
        success: false, 
        error: 'Bot token not configured' 
      });
    }

    console.log('🔍 Fetching bot guilds from Discord API');

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
        success: false, 
        error: `Bot API error: ${response.status} ${response.statusText}` 
      });
    }

    const botGuilds = await response.json();
    console.log(`📊 Bot is in ${botGuilds.length} servers`);

    return NextResponse.json({ 
      success: true,
      guilds: botGuilds
    });
  } catch (error: unknown) {
    console.error('Error fetching bot guilds:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    });
  }
}
