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

// Load all commands
for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);

  if ('data' in command.default && 'execute' in command.default) {
    commands.push(command.default.data.toJSON());
    console.log(`✅ Loaded command: ${command.default.data.name}`);
  } else {
    console.log(`⚠️  Skipping ${file} - missing data or execute property`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands.`);

    // Use global commands if no guild ID is provided
    const deploymentType = process.env.DISCORD_GUILD_ID ? 'guild' : 'global';
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    console.log(`📋 Deployment type: ${deploymentType} commands`);

    // The put method is used to fully refresh all commands
    const data = await rest.put(route, { body: commands });

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.\n`);
    
    if (deploymentType === 'global') {
      console.log('🌍 Commands deployed globally - may take up to 1 hour to appear in all servers');
    } else {
      console.log('🎯 Commands deployed to specific guild');
    }
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
})();
