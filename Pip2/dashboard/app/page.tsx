export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold mb-4">🎲 RollCloud Dashboard</h1>
        <p className="text-xl opacity-90">
          Manage your Discord integration for RollCloud combat tracking
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-3xl mb-4">⚙️</div>
          <h2 className="text-xl font-bold mb-2">Setup Guide</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Learn how to set up RollCloud Discord integration
          </p>
          <a
            href="/setup"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            Get Started
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-3xl mb-4">🎭</div>
          <h2 className="text-xl font-bold mb-2">Reaction Roles</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create and manage self-assignable roles via emoji reactions
          </p>
          <a
            href="/reaction-roles"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            Manage Roles
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-3xl mb-4">📋</div>
          <h2 className="text-xl font-bold mb-2">Changelog</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            View and post RollCloud updates to Discord
          </p>
          <a
            href="/changelog"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            View Changelog
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-3xl mb-4">📊</div>
          <h2 className="text-xl font-bold mb-2">Bot Stats</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Monitor bot performance and usage statistics
          </p>
          <button
            disabled
            className="inline-block bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>
      </div>

      {/* Bot Commands Reference */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">📖 Available Commands</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Reaction Roles</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/reactionrole create</code> - Create reaction role message</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/reactionrole add</code> - Add role to message</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/reactionrole list</code> - List roles on message</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/reactionrole remove</code> - Remove role from message</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Changelog</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/changelog view</code> - View latest updates</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/changelog post</code> - Post to announcements</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Fun Commands</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/roll [dice]</code> - Roll dice (e.g., 2d6+3)</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/coin [count]</code> - Flip coins</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Utility</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/ping</code> - Check bot responsiveness</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/help</code> - Show help information</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🔗 Quick Links</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://github.com/CarmaNayeli/rollCloud/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            ⬇️ Download RollCloud
          </a>
          <a
            href="https://github.com/CarmaNayeli/rollCloud"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            GitHub Repository
          </a>
          <a
            href="/api/health"
            target="_blank"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            API Health Check
          </a>
        </div>
      </div>
    </div>
  );
}
