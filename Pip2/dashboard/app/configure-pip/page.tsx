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

  // Mock data - replace with actual API calls
  const mockCommands: SlashCommand[] = [
    {
      name: 'rollcloud',
      description: 'Connect your RollCloud extension to Discord',
      category: 'RollCloud',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'character',
      description: 'Set your active character for rolls',
      category: 'RollCloud',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'characters',
      description: 'List your synced characters',
      category: 'RollCloud',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'sheet',
      description: 'View character sheet information',
      category: 'RollCloud',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'stats',
      description: 'Quick stat lookup and rolls',
      category: 'RollCloud',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'roll',
      description: 'Roll dice with modifiers',
      category: 'Utility',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'ping',
      description: 'Check bot responsiveness',
      category: 'Utility',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'help',
      description: 'Show help information',
      category: 'Utility',
      defaultPermissions: ['USE_APPLICATION_COMMANDS'],
      enabled: true
    },
    {
      name: 'reactionrole',
      description: 'Configure reaction roles',
      category: 'Moderation',
      defaultPermissions: ['MANAGE_ROLES'],
      enabled: false
    },
    {
      name: 'changelog',
      description: 'Manage changelog entries',
      category: 'Moderation',
      defaultPermissions: ['MANAGE_MESSAGES'],
      enabled: false
    },
    {
      name: 'ticket',
      description: 'Create and manage tickets',
      category: 'Moderation',
      defaultPermissions: ['MANAGE_CHANNELS'],
      enabled: false
    }
  ];

  useEffect(() => {
    if (status === 'authenticated') {
      loadServers();
    } else {
      setLoading(false);
    }
  }, [status]);

  const loadServers = async () => {
    try {
      // Mock API call - replace with actual Discord API call
      const mockServers: DiscordServer[] = [
        {
          id: '123456789',
          name: 'RollCloud Community',
          icon: undefined,
          permissions: ['ADMINISTRATOR'],
          botMember: true,
          owner: false,
          features: []
        },
        {
          id: '987654321',
          name: 'D&D Adventures',
          icon: undefined,
          permissions: ['MANAGE_GUILD', 'MANAGE_CHANNELS'],
          botMember: true,
          owner: false,
          features: []
        },
        {
          id: '456789123',
          name: 'Gaming Hub',
          icon: undefined,
          permissions: ['USE_APPLICATION_COMMANDS'],
          botMember: false,
          owner: false,
          features: []
        }
      ];
      
      setServers(mockServers.filter(server => 
        server.permissions.includes('ADMINISTRATOR') || 
        server.permissions.includes('MANAGE_GUILD')
      ));
      setCommands(mockCommands);
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBotInServer = async (serverId: string): Promise<boolean> => {
    // Mock implementation - replace with actual bot check
    return serverId === '123456789'; // Only in first server
  };

  const inviteBot = async (serverId: string) => {
    setInviting(serverId);
    try {
      // Generate Discord OAuth2 invite URL with proper permissions
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_BOT_CLIENT_ID';
      const permissions = [
        'VIEW_CHANNEL',
        'SEND_MESSAGES',
        'USE_APPLICATION_COMMANDS',
        'MANAGE_ROLES',
        'MANAGE_CHANNELS',
        'MANAGE_MESSAGES',
        'EMBED_LINKS',
        'ATTACH_FILES',
        'READ_MESSAGE_HISTORY'
      ].join('%20');

      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands&guild_id=${serverId}`;
      
      window.open(inviteUrl, '_blank');
      
      // Poll to check if bot was added (in real implementation)
      setTimeout(() => {
        loadServers(); // Refresh server list
        setInviting(null);
      }, 5000);
    } catch (error) {
      console.error('Error inviting bot:', error);
      setInviting(null);
    }
  };

  const handleServerSelect = (server: DiscordServer) => {
    setSelectedServer(server);
    loadServerSettings(server.id);
  };

  const loadServerSettings = async (serverId: string) => {
    try {
      // Mock server settings - replace with API call
      const mockSettings: ServerSettings = {
        id: serverId,
        welcomeChannel: 'welcome-channel',
        logChannel: 'logs',
        adminRole: 'Admin',
        modRole: 'Moderator',
        autoRoles: ['Member']
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
      // Mock API call - replace with actual save logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const enabledCommands = commands.filter(cmd => cmd.enabled);
      console.log(`Saving configuration for server ${selectedServer.name}:`, enabledCommands);
      
      alert(`Configuration saved for ${selectedServer.name}!\n\nEnabled commands: ${enabledCommands.length}/${commands.length}`);
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
        
        {servers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No servers found where you have admin permissions.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Make sure Pip is in your server and you have Administrator or Manage Server permissions.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {servers.map((server) => (
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
                        <span className={server.botMember ? 'text-green-600' : 'text-red-600'}>
                          {server.botMember ? '✅ Pip is in server' : '❌ Pip not in server'}
                        </span>
                        <span>
                          {server.permissions.includes('ADMINISTRATOR') ? 'Administrator' : 'Manage Server'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!server.botMember && (
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
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

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
