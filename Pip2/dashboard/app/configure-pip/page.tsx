'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';

interface DiscordServer {
  id: string;
  name: string;
  icon?: string;
  permissions: string[];
  botMember: boolean;
  owner: boolean;
  features: string[];
}

interface ServerSettings {
  id: string;
  welcomeChannel?: string;
  logChannel?: string;
  adminRole?: string;
  modRole?: string;
  autoRoles: string[];
}

interface SlashCommand {
  name: string;
  description: string;
  category: string;
  defaultPermissions: string[];
  enabled: boolean;
}

export default function ConfigurePip() {
  const { data: session, status } = useSession();
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DiscordServer | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchingServers, setFetchingServers] = useState(false);
  const [showServersWithoutPip, setShowServersWithoutPip] = useState(false);
  const [loadingCommands, setLoadingCommands] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      loadServers();
    } else {
      setLoading(false);
    }
  }, [status]);

  // Additional check for Discord access token
  useEffect(() => {
    if (status === 'authenticated' && session) {
      // Check both session level and session.user level for access token
      const hasAccessToken = !!(session as any)?.accessToken || !!(session as any)?.user?.accessToken;
      console.log('🔍 Session debug:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAccessToken: hasAccessToken,
        sessionAccessToken: (session as any)?.accessToken ? 'present' : 'missing',
        userAccessToken: (session as any)?.user?.accessToken ? 'present' : 'missing',
        discordId: (session as any)?.discordId || (session as any)?.user?.discordId,
        userName: session?.user?.name
      });

      if (!hasAccessToken) {
        console.log('⚠️ Discord access token missing, showing error message');
        setError('Discord access token missing. Please sign in again to access your Discord servers.');
        // Don't auto-redirect immediately - let user see the error first
      }
    }
  }, [status, session]);

  const loadServers = async () => {
    try {
      setFetchingServers(true);
      
      // Fetch real Discord servers via API
      const response = await fetch('/api/discord/servers');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          if (errorData.requiresAuth) {
            // User needs to sign in
            throw new Error('requires_auth');
          } else if (errorData.tokenExpired) {
            // Token expired, need to re-authenticate
            throw new Error('token_expired');
          }
          throw new Error('Discord authentication failed');
        }
        
        throw new Error(errorData.error || 'Failed to fetch servers');
      }
      
      const userServers = await response.json();
      console.log('📊 Received servers:', userServers.length);
      
      // First filter to only admin servers
      const adminServers = userServers.filter((server: DiscordServer) => 
        server.permissions.includes('ADMINISTRATOR') || 
        server.permissions.includes('MANAGE_GUILD')
      );
      
      console.log('👑 Admin servers:', adminServers.length);
      
      // Then check which admin servers have the bot (with rate limiting)
      const serversWithBotStatus = await Promise.all(
        adminServers.map(async (server: DiscordServer) => {
          // Check if bot is in server (with rate limiting)
          const botInServer = await checkBotInServerWithRateLimit(server.id);
          return { ...server, botMember: botInServer };
        })
      );
      
      console.log('📋 Admin servers with bot status:', serversWithBotStatus.length);

      setServers(serversWithBotStatus);
      // Commands will be loaded when a server is selected
    } catch (error: unknown) {
      console.error('Error loading servers:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message === 'requires_auth') {
          // User needs to sign in - show error but don't auto-redirect
          setError('Discord authentication required. Please sign in with Discord to access your servers.');
          return;
        } else if (error.message === 'token_expired') {
          // Token expired - show message but don't auto-redirect
          setError('Your Discord session has expired. Please sign in again to refresh your access.');
          return;
        } else {
          // Other errors
          setError(error.message || 'Failed to load Discord servers');
        }
      } else {
        setError('An unknown error occurred while loading servers');
      }
      
      // If we can't fetch real servers, don't show mock data
      setServers([]);
      setCommands([]);
    } finally {
      setLoading(false);
      setFetchingServers(false);
    }
  };
const botCheckQueue: Promise<boolean>[] = [];
const BOT_CHECK_DELAY = 1000; // 1 second between requests (increased from 100ms)

// Global cache for bot guilds
let botGuildsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to fetch bot guilds via backend API
const fetchBotGuilds = async (): Promise<any[]> => {
  const now = Date.now();
  
  // Return cached data if available and not expired
  if (botGuildsCache && (now - botGuildsCache.timestamp) < CACHE_DURATION) {
    console.log(`📋 Using cached bot guilds data (${botGuildsCache.data.length} guilds)`);
    return botGuildsCache.data;
  }

  // Fetch fresh data via backend API
  console.log('🔄 Fetching bot guilds data via backend API');
  
  try {
    const response = await fetch('/api/discord/bot-guilds');
    if (!response.ok) {
      console.error('❌ Backend API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error('❌ Backend API error:', data.error);
      return [];
    }
    
    const botGuilds = data.guilds || [];
    console.log(`📊 Bot is in ${botGuilds.length} servers`);
    
    // Update cache
    botGuildsCache = {
      data: botGuilds,
      timestamp: now
    };
    
    return botGuilds;
  } catch (error) {
    console.error('❌ Error fetching bot guilds via backend:', error);
    return [];
  }
};

const checkBotInServerWithRateLimit = async (serverId: string): Promise<boolean> => {
  // Add to queue
  const promise = new Promise<boolean>((resolve) => {
    setTimeout(async () => {
      try {
        // Get bot guilds from cache or fetch fresh data
        const botGuilds = await fetchBotGuilds();
        const botInServer = botGuilds.some((guild: any) => guild.id === serverId);
        console.log(`🔍 Bot in server ${serverId}: ${botInServer}`);
        resolve(botInServer);
      } catch (error) {
        console.error(`Error checking bot presence for ${serverId}:`, error);
        resolve(false);
      }
    }, botCheckQueue.length * BOT_CHECK_DELAY);
  });
  
  botCheckQueue.push(promise);
  return promise;
};

  const inviteBot = async (serverId: string) => {
    setInviting(serverId);
    try {
      // Use the same working invite URL from the setup page
      const inviteUrl = "https://discord.com/api/oauth2/authorize?client_id=1464771468452827380&permissions=536870912&scope=bot%20applications.commands";
      
      // Open Discord authorization in new tab
      window.open(inviteUrl, '_blank');
      
      // Show user feedback
      alert(`Discord authorization opened in a new tab!\n\nPlease authorize Pip to join the server, then refresh this page to see the updated status.`);
      
      // Don't poll for server addition - just refresh after a delay
      setTimeout(async () => {
        setFetchingServers(true); // Show loading state during refresh
        await loadServers(); // Refresh server list
        setInviting(null);
      }, 5000);
    } catch (error) {
      console.error('Error inviting bot:', error);
      setInviting(null);
      alert('Failed to open Discord authorization. Please try again.');
    }
  };

  const checkBotAndCreateInstance = async (serverId: string) => {
    try {
      // Check if bot is now in server
      const botInServer = await checkBotInServerWithRateLimit(serverId);
      
      if (botInServer) {
        // Find the server details
        const server = servers.find(s => s.id === serverId);
        if (!server) return;
        
        // Fetch server channels
        const channelsResponse = await fetch(`/api/discord/channels/${serverId}`);
        let channels = [];
        
        if (channelsResponse.ok) {
          const data = await channelsResponse.json();
          channels = data.channels || [];
        }
        
        // Use the first available text channel, or fallback to default
        const firstChannel = channels.find((ch: any) => ch.type === 0);
        const channelId = firstChannel?.id || 'default-channel';
        const channelName = firstChannel?.name || 'general';
        
        // Create instance
        const instanceData = {
          guild_id: serverId,
          guild_name: server.name,
          channel_id: channelId,
          channel_name: channelName
        };
        
        const response = await fetch('/api/instances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(instanceData),
        });
        
        if (response.ok) {
          console.log('Instance created successfully');
          const instance = await response.json();
          console.log('Instance data:', instance);
        } else {
          const errorText = await response.text();
          console.error('Failed to create instance:', errorText);
        }
      }
    } catch (error) {
      console.error('Error checking bot and creating instance:', error);
    }
  };

  const handleServerSelect = (server: DiscordServer) => {
    setSelectedServer(server);
    loadServerSettings(server.id);
    loadServerCommands(server.id);
  };

  const loadServerCommands = async (serverId: string) => {
    setLoadingCommands(true);
    try {
      const response = await fetch(`/api/server-config?guild_id=${serverId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch command configuration');
      }
      const data = await response.json();
      if (data.success && data.commands) {
        setCommands(data.commands);
        console.log(`📋 Loaded ${data.commands.length} commands for server ${serverId}`);
      }
    } catch (error) {
      console.error('Error loading server commands:', error);
      // On error, show empty commands rather than stale data
      setCommands([]);
    } finally {
      setLoadingCommands(false);
    }
  };

  const loadServerSettings = async (serverId: string) => {
    try {
      // Server settings (channels, roles) - keeping as placeholder for future implementation
      const mockSettings: ServerSettings = {
        id: serverId,
        welcomeChannel: '',
        logChannel: '',
        adminRole: '',
        modRole: '',
        autoRoles: []
      };
      setServerSettings(mockSettings);
    } catch (error) {
      console.error('Error loading server settings:', error);
    }
  };

  const toggleCommand = (commandName: string) => {
    setCommands(prev => prev.map(cmd => 
      cmd.name === commandName ? { ...cmd, enabled: !cmd.enabled } : cmd
    ));
  };

  const saveConfiguration = async () => {
    if (!selectedServer) return;

    setSaving(true);
    try {
      // Build list of disabled commands (we store what's disabled, not what's enabled)
      const disabledCommands = commands.filter(cmd => !cmd.enabled).map(cmd => cmd.name);

      const response = await fetch('/api/server-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guild_id: selectedServer.id,
          disabled_commands: disabledCommands,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      const data = await response.json();
      if (data.success) {
        const enabledCommands = commands.filter(cmd => cmd.enabled);
        console.log(`✅ Saved configuration for server ${selectedServer.name}:`, enabledCommands.length, 'enabled');
        // Update local state with server response
        if (data.commands) {
          setCommands(data.commands);
        }
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, SlashCommand[]>);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-green-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 bg-[#5865F2] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4">Configure Pip</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Connect with Discord to manage Pip's slash commands and server settings
          </p>
          <button
            onClick={() => signIn('discord')}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-3 mx-auto"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Sign in with Discord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Configure Pip</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage slash commands and settings for servers where you're an admin
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <img 
              src={session.user?.image || ''} 
              alt={session.user?.name || ''} 
              className="w-10 h-10 rounded-full"
            />
            <span className="text-gray-600 dark:text-gray-400">{session.user?.name}</span>
          </div>
        </div>
      </div>

      {/* Server Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">Select Server</h2>
        
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M8.011 3.015h.01M16 4v.01M12 16v.01M3.015 8.011h.01M8.015 12.015h.01M16 20.01v-.01" />
                </svg>
                <span className="text-red-800 dark:text-red-200 font-medium">{error}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    // Clear NextAuth session
                    window.location.href = '/api/auth/signout';
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition"
                >
                  Clear Session
                </button>
              </div>
            </div>
          </div>
        )}
        
        {fetchingServers ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Fetching Servers</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Checking your Discord servers and Pip's presence...
                </p>
              </div>
            </div>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Servers Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don't have any Discord servers where you have admin permissions, or Pip isn't in any of your servers yet.
            </p>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Want to add Pip to a server?</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  You can invite Pip to any Discord server where you have admin permissions.
                </p>
                <a
                  href="https://discord.com/api/oauth2/authorize?client_id=1464771468452827380&permissions=536870912&scope=bot%20applications.commands"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  Invite Pip to Server
                </a>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Create a new server</h4>
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  Don't have a server yet? Create a new Discord server to get started with Pip.
                </p>
                <button
                  onClick={() => window.open('https://discord.com/new', '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  Create New Server
                </button>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>After adding Pip to a server or creating a new one, refresh this page to see your servers.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Servers with Pip - Always visible */}
            {(() => {
              const serversWithPip = servers.filter(server => server.botMember);
              const serversWithoutPip = servers.filter(server => !server.botMember);
              
              return (
                <>
                  {/* Servers with Pip */}
                  {serversWithPip.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Servers with Pip ({serversWithPip.length})
                      </h3>
                      <div className="grid gap-4">
                        {serversWithPip.map((server) => (
                          <div
                            key={server.id}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedServer?.id === server.id
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                            onClick={() => handleServerSelect(server)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                  {server.icon ? (
                                    <img src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} alt={server.name} className="w-12 h-12 rounded-full" />
                                  ) : (
                                    <span className="text-gray-600 dark:text-gray-300 font-bold">
                                      {server.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-semibold flex items-center gap-2">
                                    {server.name}
                                    {server.owner && <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">Owner</span>}
                                  </h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="text-green-600">
                                      ✅ Pip is in server
                                    </span>
                                    <span>
                                      {server.permissions.includes('ADMINISTRATOR') ? 'Administrator' : 'Manage Server'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Servers without Pip - Collapsible */}
                  {serversWithoutPip.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowServersWithoutPip(!showServersWithoutPip)}
                        className="w-full flex items-center justify-between text-lg font-semibold text-gray-600 dark:text-gray-400 mb-4 hover:text-gray-800 dark:hover:text-gray-200 transition"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Servers without Pip ({serversWithoutPip.length})
                        </div>
                        <svg
                          className={`w-5 h-5 transition-transform ${showServersWithoutPip ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showServersWithoutPip && (
                        <div className="grid gap-4">
                          {serversWithoutPip.map((server) => (
                            <div
                              key={server.id}
                              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                selectedServer?.id === server.id
                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                              onClick={() => handleServerSelect(server)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                    {server.icon ? (
                                      <img src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} alt={server.name} className="w-12 h-12 rounded-full" />
                                    ) : (
                                      <span className="text-gray-600 dark:text-gray-300 font-bold">
                                        {server.name.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold flex items-center gap-2">
                                      {server.name}
                                      {server.owner && <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">Owner</span>}
                                    </h3>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                      <span className="text-red-600">
                                        ❌ Pip not in server
                                      </span>
                                      <span>
                                        {server.permissions.includes('ADMINISTRATOR') ? 'Administrator' : 'Manage Server'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      inviteBot(server.id);
                                    }}
                                    disabled={inviting === server.id}
                                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded text-sm font-medium transition disabled:opacity-50"
                                  >
                                    {inviting === server.id ? 'Inviting...' : 'Invite Pip'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Command Configuration */}
      {selectedServer && selectedServer.botMember && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Slash Commands for {selectedServer.name}</h2>
              <button
                onClick={saveConfiguration}
                disabled={saving || loadingCommands}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

            {loadingCommands ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <span className="text-gray-600 dark:text-gray-400">Loading command configuration...</span>
                </div>
              </div>
            ) : commands.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                No commands available. Please try refreshing the page.
              </div>
            ) : (
            <div className="space-y-6">
              {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category}>
                  <h3 className="font-semibold text-lg mb-3 text-green-600 dark:text-green-400">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryCommands.map((command: SlashCommand) => (
                      <div
                        key={command.name}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
                              /{command.name}
                            </code>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {command.description}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Requires: {command.defaultPermissions.join(', ')}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={command.enabled}
                            onChange={() => toggleCommand(command.name)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Server Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6">Server Settings for {selectedServer.name}</h2>
            
            {serverSettings ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Channel Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Welcome Channel
                      </label>
                      <input
                        type="text"
                        value={serverSettings.welcomeChannel || ''}
                        onChange={(e) => setServerSettings(prev => prev ? {...prev, welcomeChannel: e.target.value} : null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="#welcome"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Log Channel
                      </label>
                      <input
                        type="text"
                        value={serverSettings.logChannel || ''}
                        onChange={(e) => setServerSettings(prev => prev ? {...prev, logChannel: e.target.value} : null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="#logs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Role Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Admin Role
                      </label>
                      <input
                        type="text"
                        value={serverSettings.adminRole || ''}
                        onChange={(e) => setServerSettings(prev => prev ? {...prev, adminRole: e.target.value} : null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Admin"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Moderator Role
                      </label>
                      <input
                        type="text"
                        value={serverSettings.modRole || ''}
                        onChange={(e) => setServerSettings(prev => prev ? {...prev, modRole: e.target.value} : null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Moderator"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Changes may take a few minutes to take effect in Discord. 
                    Some features require specific bot permissions to function properly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">Loading server settings...</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
