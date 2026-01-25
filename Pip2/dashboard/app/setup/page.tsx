export default function SetupPage() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold mb-4">Setup Guide</h1>
        <p className="text-xl opacity-90">
          Connect DiceCloud V2 to Roll20 with Discord turn notifications
        </p>
      </div>

      {/* Step 1: Download */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">1️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Download RollCloud</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Download the RollCloud browser extension installer for your platform.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <a
                href="https://github.com/CarmaNayeli/rollCloud/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ⬇️ Download Latest Release
              </a>
              <a
                href="https://github.com/CarmaNayeli/rollCloud"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition font-semibold"
              >
                📦 View on GitHub
              </a>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
              <h3 className="font-semibold mb-2">What's Included</h3>
              <ul className="text-sm space-y-1">
                <li>Browser extension for Roll20 + DiceCloud V2</li>
                <li>Character sync from DiceCloud to Roll20</li>
                <li>Discord turn notifications via Pip 2 bot</li>
                <li>Action economy buttons in Discord</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Install Extension */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">2️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Install the Extension</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Run the installer and it will automatically install the extension to your browsers.
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
              <h3 className="font-semibold mb-2">⚠️ Supported Browsers</h3>
              <ul className="text-sm space-y-1">
                <li>✅ Google Chrome</li>
                <li>✅ Microsoft Edge</li>
                <li>✅ Brave</li>
                <li>✅ Other Chromium-based browsers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Connect Discord */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">3️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Connect to Discord</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Use the <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/rollcloud pair</code> command in Discord to link a channel to your DiceCloud character.
            </p>

            <ol className="space-y-3 text-sm">
              <li className="flex items-start space-x-2">
                <span className="font-bold">1.</span>
                <div>Open Discord and go to your game channel</div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">2.</span>
                <div>Type <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/rollcloud pair</code></div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">3.</span>
                <div>Enter your DiceCloud character ID</div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold">4.</span>
                <div>Combat turns will now post to this channel!</div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Step 4: Test */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">4️⃣</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Test the Integration</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start a combat in DiceCloud V2 and watch the turn notifications appear in Discord!
            </p>

            <div className="space-y-2 font-mono text-sm">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                <code>/rollcloud status</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-sans">Check your pairing status</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                <code>/roll 1d20+5</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-sans">Roll dice directly in Discord</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Installation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🛠️ Manual Installation</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          For developers or if the installer doesn't work for your setup:
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Step 1: Clone the Repository</h3>
            <code className="block bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm overflow-x-auto">
              git clone https://github.com/CarmaNayeli/rollCloud.git
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 2: Build the Extension</h3>
            <code className="block bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm overflow-x-auto">
              cd rollCloud && npm install && npm run build
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 3: Load in Chrome</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside text-gray-600 dark:text-gray-400">
              <li>Open <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">chrome://extensions</code></li>
              <li>Enable "Developer mode" (top right)</li>
              <li>Click "Load unpacked"</li>
              <li>Select the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">dist</code> folder</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🔧 Troubleshooting</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Extension not detecting DiceCloud?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Make sure you're on dicecloud.com and refresh the page after installing.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Discord notifications not appearing?</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li>Check your pairing status with <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/rollcloud status</code></li>
              <li>Make sure the bot has permission to post in the channel</li>
              <li>Verify your character ID is correct</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Buttons not working?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Discord buttons expire after 15 minutes. Start a new turn to get fresh buttons.
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
            href="/pip-settings"
            className="bg-white/20 text-white px-4 py-2 rounded hover:bg-white/30 transition font-semibold"
          >
            Pip 2 Settings
          </a>
        </div>
      </div>
    </div>
  );
}
