'use client';

import { useState, useEffect } from 'react';

type Tab = 'reaction-roles' | 'changelog' | 'bot-stats';

interface ReactionRole {
  messageId: string;
  emoji: string;
  roleId: string;
}

export default function PipSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('reaction-roles');
  const [reactionRoles, setReactionRoles] = useState<Record<string, Record<string, string>>>({});
  const [changelog, setChangelog] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'reaction-roles') {
      fetchReactionRoles();
    } else if (activeTab === 'changelog') {
      fetchChangelog();
    }
  }, [activeTab]);

  const fetchReactionRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reaction-roles');
      const data = await response.json();
      setReactionRoles(data.messages || {});
    } catch (error) {
      console.error('Failed to fetch reaction roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChangelog = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/changelog');
      const data = await response.json();
      setChangelog(data.content || 'No changelog available');
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
      setChangelog('Failed to load changelog');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'reaction-roles', label: 'Reaction Roles' },
    { id: 'changelog', label: 'Changelog' },
    { id: 'bot-stats', label: 'Bot Stats' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pip 2 Settings</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Reaction Roles Tab */}
        {activeTab === 'reaction-roles' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Reaction Roles</h2>
              <button
                onClick={fetchReactionRoles}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition text-sm"
              >
                Refresh
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">How to Use</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Use <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">/reactionrole create</code> to create a message</li>
                <li>Use <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">/reactionrole add</code> to add emoji-to-role mappings</li>
                <li>Users react to the message to self-assign roles</li>
              </ol>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div>
              </div>
            ) : Object.keys(reactionRoles).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="mb-2">No reaction roles configured yet</p>
                <code className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded inline-block text-sm">
                  /reactionrole create title:"Choose Your Roles"
                </code>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(reactionRoles).map(([messageId, roles]) => (
                  <div key={messageId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        Message: {messageId}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(messageId)}
                        className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Copy ID
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(roles).map(([emoji, roleId]) => (
                        <div key={emoji} className="flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                          <span className="mr-2">{emoji.match(/^\d+$/) ? '⬡' : emoji}</span>
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{roleId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Changelog Tab */}
        {activeTab === 'changelog' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Changelog</h2>
              <button
                onClick={fetchChangelog}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition text-sm"
              >
                Refresh
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">Post to Discord</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">/changelog post</code> to post updates to your announcement channel.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {changelog}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Bot Stats Tab */}
        {activeTab === 'bot-stats' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Bot Stats</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">--</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Servers</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">--</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Pairings</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">--</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Turns Posted</p>
              </div>
            </div>

            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Bot statistics coming soon</p>
              <p className="text-sm mt-2">Stats will show server count, active pairings, and usage metrics</p>
            </div>
          </div>
        )}
      </div>

      {/* Command Reference */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">Command Reference</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">Reaction Roles</h3>
            <ul className="space-y-1 font-mono text-gray-600 dark:text-gray-400">
              <li>/reactionrole create</li>
              <li>/reactionrole add</li>
              <li>/reactionrole remove</li>
              <li>/reactionrole list</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">Changelog</h3>
            <ul className="space-y-1 font-mono text-gray-600 dark:text-gray-400">
              <li>/changelog view</li>
              <li>/changelog post</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
