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

// Login to Discord
console.log('\n🔑 Attempting Discord login...');
console.log(`   Token present: ${!!process.env.DISCORD_TOKEN}`);
console.log(`   Token length: ${process.env.DISCORD_TOKEN?.length || 0}`);

client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log('✅ Login promise resolved');
  })
  .catch(error => {
    console.error('❌ Login failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  });

// Add timeout detection
setTimeout(() => {
  if (!client.isReady()) {
    console.error('⚠️  WARNING: Bot has not connected after 30 seconds');
    console.error('   This usually indicates a network issue or invalid token');
  }
}, 30000);
