/**
 * Deploy slash commands to Discord
 */

import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Get disabled commands from environment
const disabledCommands = process.env.DISABLED_COMMANDS
  ? process.env.DISABLED_COMMANDS.split(',').map(cmd => cmd.trim())
  : [];

if (disabledCommands.length > 0) {
  console.log(`🚫 Disabled commands: ${disabledCommands.join(', ')}`);
}

// Load all commands
for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);

  if ('data' in command.default && 'execute' in command.default) {
    const commandName = command.default.data.name;

    // Skip disabled commands
    if (disabledCommands.includes(commandName)) {
      console.log(`⏭️  Skipping ${commandName} (disabled)`);
      continue;
    }

    commands.push(command.default.data.toJSON());
    console.log(`✅ Loaded command: ${commandName}`);
  } else {
    console.log(`⚠️  Skipping ${file} - missing data or execute property`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands with retry logic
(async () => {
  const maxRetries = 3;
  const timeoutMs = 600000; // 10 minutes per attempt

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands (attempt ${attempt}/${maxRetries})`);

      // Use global commands if no guild ID is provided
      const deploymentType = process.env.DISCORD_GUILD_ID ? 'guild' : 'global';
      const route = process.env.DISCORD_GUILD_ID
        ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
        : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

      console.log(`📋 Deployment type: ${deploymentType} commands`);
      console.log(`⏳ Sending command deployment request to Discord (timeout: ${timeoutMs / 60000} minutes)...`);

      // The put method is used to fully refresh all commands with timeout
      const deployPromise = rest.put(route, { body: commands });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Deployment timed out after ${timeoutMs / 60000} minutes`)), timeoutMs)
      );

      const data = await Promise.race([deployPromise, timeoutPromise]);

      console.log(`✅ Successfully reloaded ${data.length} application (/) commands.\n`);

      if (deploymentType === 'global') {
        console.log('🌍 Commands deployed globally - may take up to 1 hour to appear in all servers');
      } else {
        console.log('🎯 Commands deployed to specific guild');
      }

      // Success - exit the retry loop
      break;

    } catch (error) {
      console.error(`❌ Error deploying commands (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        const waitTime = Math.min(30, attempt * 10); // Wait 10s, 20s, 30s between retries
        console.log(`⏳ Retrying in ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        console.error('Stack:', error.stack);
        console.log('\n⚠️  All retry attempts failed - commands may not be updated');
        console.log('💡 The bot will still start, but slash commands might be outdated');
      }
    }
  }

  console.log('✅ Command deployment script complete\n');
  process.exit(0);
})();
