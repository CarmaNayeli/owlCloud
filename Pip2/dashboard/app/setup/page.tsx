export default function SetupPage() {
  const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268454928&scope=bot%20applications.commands";

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold mb-4">⚙️ Setup Guide</h1>
        <p className="text-xl opacity-90">
          Get Pip Bot up and running in your Discord server
        </p>
      </div>

      {/* Step 1: Invite Bot */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">1️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Invite Pip Bot to Your Server</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Click the button below to invite Pip Bot. You must have "Manage Server" permission.
            </p>
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              🎲 Invite Pip Bot
            </a>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4">
              <h3 className="font-semibold mb-2">Required Permissions</h3>
              <ul className="text-sm space-y-1">
                <li>✅ Send Messages</li>
                <li>✅ Embed Links</li>
                <li>✅ Add Reactions</li>
                <li>✅ Manage Roles (for reaction roles)</li>
                <li>✅ Read Message History</li>
                <li>✅ Use Slash Commands</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Configure Roles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">2️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Configure Role Hierarchy</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              For reaction roles to work, Pip Bot's role must be <strong>higher</strong> than any roles it will assign.
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
              <h3 className="font-semibold mb-2">⚠️ Important</h3>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Go to Server Settings → Roles</li>
                <li>Drag Pip Bot's role above any roles you want it to assign</li>
                <li>Save changes</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Enable Intents */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">3️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Enable Required Intents (For Bot Hosts)</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              If you're hosting Pip Bot yourself, enable these intents in the Discord Developer Portal:
            </p>

            <ol className="space-y-3 text-sm">
              <li className="flex items-start space-x-2">
                <span className="font-bold">1.</span>
                <div>
                  Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Discord Developer Portal</a>
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">2.</span>
                <div>Select your application → Bot → Privileged Gateway Intents</div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">3.</span>
                <div>Enable: <strong>Server Members Intent</strong>, <strong>Message Content Intent</strong></div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">4.</span>
                <div>Save changes and restart your bot</div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Step 4: Test Commands */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">4️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Test the Bot</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try these commands to make sure everything works:
            </p>

            <div className="space-y-2 font-mono text-sm">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                <code>/ping</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-sans">Check if bot is responsive</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                <code>/help</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-sans">View all available commands</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                <code>/roll 2d6</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-sans">Roll two 6-sided dice</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reaction Roles Setup */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🎭 Setting Up Reaction Roles</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Step 1: Create a Reaction Role Message</h3>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
              /reactionrole create title:"Choose Your Roles" description:"React to get roles!"
            </code>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              This creates an embed message and gives you a message ID.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 2: Add Roles to the Message</h3>
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
              /reactionrole add message_id:123456789 emoji:🎲 role:@Dice Players
            </code>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Replace 123456789 with your message ID from Step 1.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 3: Users React to Get Roles</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Users can now click the emoji reactions to self-assign roles. Click again to remove the role.
            </p>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🔧 Troubleshooting</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Slash commands not showing up?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Wait a few minutes after inviting the bot. Discord can take up to 1 hour to sync slash commands.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Reaction roles not working?</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li>Check that Pip Bot's role is above the roles it's trying to assign</li>
              <li>Ensure the bot has "Manage Roles" permission</li>
              <li>Verify you used the correct message ID</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Bot not responding?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check that the bot is online (green status). If hosting yourself, check your bot logs.
            </p>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-2">✅ All Set!</h2>
        <p className="mb-4">
          Your bot should now be working. Use <code className="bg-white/20 px-2 py-1 rounded">/help</code> to see all available commands.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="/"
            className="bg-white text-green-600 px-4 py-2 rounded hover:bg-gray-100 transition font-semibold"
          >
            Go to Dashboard
          </a>
          <a
            href="/reaction-roles"
            className="bg-white/20 text-white px-4 py-2 rounded hover:bg-white/30 transition font-semibold"
          >
            View Reaction Roles
          </a>
        </div>
      </div>
    </div>
  );
}
