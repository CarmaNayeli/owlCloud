import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Discord servers...');
    
    const session = await getServerSession(authOptions);
    
    console.log('📝 Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasAccessToken: !!(session as any)?.user?.accessToken || !!(session as any)?.accessToken
    });

    // Access token can be on session.user.accessToken or session.accessToken depending on NextAuth config
    const accessToken = (session as any)?.user?.accessToken || (session as any)?.accessToken;

    if (!session || !accessToken) {
      console.log('❌ No session or access token found');
      return NextResponse.json({
        error: 'Unauthorized - Please sign in with Discord first',
        requiresAuth: true
      }, { status: 401 });
    }
    console.log('🔑 Using access token (first 10 chars):', accessToken.substring(0, 10) + '...');

    // Fetch user's Discord servers
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Discord API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Discord API error:', response.status, response.statusText, errorText);
      
      if (response.status === 401) {
        return NextResponse.json({ 
          error: 'Discord token expired - Please sign in again',
          tokenExpired: true 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch servers from Discord',
        discordError: errorText 
      }, { status: response.status });
    }

    const guilds = await response.json();
    console.log('📊 Raw Discord guilds count:', guilds.length);

    // Discord permission bit flags
    const ADMINISTRATOR = BigInt(0x8);
    const MANAGE_GUILD = BigInt(0x20);

    // Helper to convert permission bitfield to array of permission strings
    const parsePermissions = (permissionBits: string | number): string[] => {
      const permissions: string[] = [];
      try {
        const bits = BigInt(permissionBits);
        if ((bits & ADMINISTRATOR) === ADMINISTRATOR) {
          permissions.push('ADMINISTRATOR');
        }
        if ((bits & MANAGE_GUILD) === MANAGE_GUILD) {
          permissions.push('MANAGE_GUILD');
        }
      } catch (e) {
        console.error('Error parsing permissions:', e);
      }
      return permissions;
    };

    // Transform Discord guild data to our interface
    const servers = guilds.map((guild: any) => {
      const permissionStrings = parsePermissions(guild.permissions);
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        permissions: permissionStrings,
        permissionsRaw: guild.permissions, // Keep raw for debugging
        botMember: false, // Will be checked separately
        owner: guild.owner,
        features: guild.features || []
      };
    });

    console.log('✅ Transformed servers:', servers.length);

    // Log admin servers
    const adminServers = servers.filter((server: any) =>
      server.permissions.includes('ADMINISTRATOR') ||
      server.permissions.includes('MANAGE_GUILD')
    );
    console.log('👑 Admin servers count:', adminServers.length);

    if (adminServers.length === 0) {
      console.log('⚠️ No admin servers found - user has permissions in these servers:');
      servers.forEach((server: any) => {
        const hasAdmin = server.permissions.includes('ADMINISTRATOR');
        const hasManageGuild = server.permissions.includes('MANAGE_GUILD');
        console.log(`  - ${server.name}: Raw=${server.permissionsRaw}, Parsed=${server.permissions.join(',')}, Admin=${hasAdmin}, ManageGuild=${hasManageGuild}`);
      });
    }

    return NextResponse.json(servers);
  } catch (error: unknown) {
    console.error('❌ Error fetching Discord servers:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
