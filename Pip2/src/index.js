/**
 * Pip 2 - Discord bot for RollCloud
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

// Login to Discord with retry logic
async function loginWithRetry(maxRetries = 3, retryDelay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔑 Attempting Discord login (attempt ${attempt}/${maxRetries})...`);
      console.log(`   Token present: ${!!process.env.DISCORD_TOKEN}`);

      await client.login(process.env.DISCORD_TOKEN);
      console.log('✅ Login successful');
      return;

    } catch (error) {
      console.error(`❌ Login failed (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        const waitTime = retryDelay * attempt; // Exponential backoff: 5s, 10s, 15s
        console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ All login attempts failed');
        console.error('Stack:', error.stack);
        process.exit(1);
      }
    }
  }
}

// Start login process
loginWithRetry().catch(error => {
  console.error('Fatal error during login:', error);
  process.exit(1);
});
