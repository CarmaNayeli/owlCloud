'use client';

import { useState, useEffect } from 'react';

interface ReactionRole {
  messageId: string;
  emoji: string;
  roleId: string;
  roleName?: string;
}

export default function ReactionRolesPage() {
  const [reactionRoles, setReactionRoles] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReactionRoles();
  }, []);

  const fetchReactionRoles = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🎭 Reaction Roles Management</h1>
        <button
          onClick={fetchReactionRoles}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          Refresh
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2">ℹ️ How to Use</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>In Discord, use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/reactionrole create</code> to create a message</li>
          <li>Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/reactionrole add</code> to add emoji-to-role mappings</li>
          <li>Users can then react to the message to self-assign roles</li>
          <li>This dashboard shows all configured reaction roles</li>
        </ol>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading reaction roles...</p>
        </div>
      ) : Object.keys(reactionRoles).length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">🎭</div>
          <h2 className="text-2xl font-bold mb-2">No Reaction Roles Yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by creating a reaction role message in Discord
          </p>
          <code className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded inline-block">
            /reactionrole create title:"Choose Your Roles" description:"React to get roles!"
          </code>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(reactionRoles).map(([messageId, roles]) => (
            <div
              key={messageId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Message ID: {messageId}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {Object.keys(roles).length} role{Object.keys(roles).length !== 1 ? 's' : ''} configured
                  </p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(messageId)}
                  className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Copy ID
                </button>
              </div>

              <div className="space-y-2">
                {Object.entries(roles).map(([emoji, roleId]) => (
                  <div
                    key={emoji}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">{emoji.match(/^\d+$/) ? '🔹' : emoji}</span>
                      <div>
                        <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                          Role ID: {roleId}
                        </p>
                        {emoji.match(/^\d+$/) && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Custom emoji ID: {emoji}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(roleId)}
                      className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                    >
                      Copy Role ID
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>To modify:</strong> Use Discord commands
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 mx-1 rounded">/reactionrole remove</code>
                  or
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 mx-1 rounded">/reactionrole delete</code>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">📚 Command Reference</h2>
        <div className="space-y-3 text-sm">
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /reactionrole create title:"..." description:"..." color:#5865F2
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new reaction role message</p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /reactionrole add message_id:123 emoji:🎲 role:@RoleName
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Add a role to a message</p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /reactionrole list message_id:123
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">List all roles on a message</p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /reactionrole remove message_id:123 emoji:🎲
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Remove a specific role</p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /reactionrole delete message_id:123
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Delete all roles from a message</p>
          </div>
        </div>
      </div>
    </div>
  );
}
