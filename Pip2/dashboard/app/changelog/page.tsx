'use client';

import { useState, useEffect } from 'react';

export default function ChangelogPage() {
  const [changelog, setChangelog] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📋 RollCloud Changelog</h1>
        <button
          onClick={fetchChangelog}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          Refresh
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2">ℹ️ About Changelog</h3>
        <p className="text-sm">
          This page displays the latest updates from RollCloud.
          Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/changelog post</code> in Discord
          to post these updates to your announcement channel.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading changelog...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {changelog}
            </pre>
          </div>
        </div>
      )}

      {/* Command Help */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4">📚 Changelog Commands</h2>
        <div className="space-y-3 text-sm">
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /changelog view
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View the latest changelog in Discord (ephemeral message)
            </p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /changelog post
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Post the changelog to the current channel (Admin only)
            </p>
          </div>
          <div>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              /changelog post #announcements
            </code>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Post the changelog to a specific channel with @everyone ping (Admin only)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
