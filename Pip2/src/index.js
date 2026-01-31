/**
 * Pip 2 - Discord bot for OwlCloud
 */

import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

config();

// Command deployment is now manual only
// Run: npm run deploy
// This prevents blocking on Render and allows external automation

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Collection to store commands
client.commands = new Collection();

// Load commands
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);

  if ('data' in command.default && 'execute' in command.default) {
    client.commands.set(command.default.data.name, command.default);
    console.log(`✅ Loaded command: ${command.default.data.name}`);
  } else {
    console.log(`⚠️  Skipping ${file} - missing data or execute property`);
  }
}

// Load events
console.log('\n📡 Loading events...');
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  try {
    const filePath = join(eventsPath, file);
    console.log(`   Loading ${file}...`);
    const event = await import(`file://${filePath}`);

    if (event.default.once) {
      client.once(event.default.name, (...args) => event.default.execute(...args));
    } else {
      client.on(event.default.name, (...args) => event.default.execute(...args));
    }
    console.log(`✅ Loaded event: ${event.default.name}`);
  } catch (error) {
    console.error(`❌ Failed to load event ${file}:`, error.message);
    console.error(error.stack);
  }
}

// Helper function to add timeout to a promise
function withTimeout(promise, timeoutMs, timeoutError = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    )
  ]);
}

// Login to Discord with retry logic (infinite retries)
async function loginWithRetry(retryDelay = 5000, loginTimeout = 30000, maxBackoff = 60000) {
  let attempt = 1;

  while (true) { // Retry indefinitely until success
    try {
      console.log(`\n🔑 Attempting Discord login (attempt ${attempt})...`);
      console.log(`   Token present: ${!!process.env.DISCORD_TOKEN}`);
      console.log(`   Timeout: ${loginTimeout / 1000}s`);

      await withTimeout(
        client.login(process.env.DISCORD_TOKEN),
        loginTimeout,
        `Login timed out after ${loginTimeout / 1000} seconds`
      );
      console.log('✅ Login successful');
      return;

    } catch (error) {
      console.error(`❌ Login failed (attempt ${attempt}):`, error.message);

      // Exponential backoff with max cap: 5s, 10s, 15s, ..., up to maxBackoff
      const waitTime = Math.min(retryDelay * attempt, maxBackoff);
      console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      attempt++;
    }
  }
}

// Start login process
loginWithRetry().catch(error => {
  console.error('Fatal error during login:', error);
  process.exit(1);
});
