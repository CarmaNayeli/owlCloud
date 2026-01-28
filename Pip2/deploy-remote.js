/**
 * Remote Deployment Helper
 * Prepares the bot for remote deployment on Render.com
 */

import { config } from 'dotenv';
import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Pip2 Remote Deployment Setup\n');

// Check environment variables
const requiredVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\nFor remote deployment, you only need:');
  console.log('- DISCORD_TOKEN (from Discord Developer Portal)');
  console.log('- DISCORD_CLIENT_ID (from Discord Developer Portal)');
  console.log('\nGUILD_ID is optional - for testing in specific server only');
  process.exit(1);
}

console.log('✅ Environment variables configured');

// Load and deploy commands
const commands = [];
const commandsPath = join(__dirname, 'src', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Get disabled commands from environment
const disabledCommands = process.env.DISABLED_COMMANDS
  ? process.env.DISABLED_COMMANDS.split(',').map(cmd => cmd.trim())
  : [];

if (disabledCommands.length > 0) {
  console.log(`\n🚫 Disabled commands: ${disabledCommands.join(', ')}`);
}

console.log(`\n📋 Loading ${commandFiles.length} commands...`);

for (const file of commandFiles) {
  try {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);

    if ('data' in command.default && 'execute' in command.default) {
      const commandName = command.default.data.name;

      // Skip disabled commands
      if (disabledCommands.includes(commandName)) {
        console.log(`⏭️  ${commandName} (disabled)`);
        continue;
      }

      commands.push(command.default.data.toJSON());
      console.log(`✅ ${commandName}`);
    } else {
      console.log(`❌ ${file}: Missing data or execute`);
    }
  } catch (error) {
    console.log(`❌ ${file}: ${error.message}`);
  }
}

// Deploy commands to Discord
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`\n🌐 Deploying ${commands.length} commands to Discord...`);
    
    // Use global commands for remote deployment (available to all servers)
    const deploymentType = process.env.DISCORD_GUILD_ID ? 'guild' : 'global';
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
    
    console.log(`📋 Deployment type: ${deploymentType} commands`);
    
    const data = await rest.put(route, { body: commands });

    console.log(`✅ Successfully deployed ${data.length} commands!`);
    
    if (deploymentType === 'global') {
      console.log('🌍 Commands are now available globally to all servers!');
      console.log('⏰ Note: Global commands can take up to 1 hour to propagate');
    } else {
      console.log('🎯 Commands deployed to specific guild for testing');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Push code to GitHub');
    console.log('2. Deploy to Render.com (see DEPLOYMENT_CHECKLIST.md)');
    console.log('3. Bot will be online and commands ready!');
    
    console.log('\n📋 Deployed Commands:');
    data.forEach(cmd => console.log(`   /${cmd.name}`));
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    
    if (error.code === 50001) {
      console.log('\n💡 Fix: Ensure bot has "applications.commands" scope in OAuth2 URL');
    } else if (error.code === 10013) {
      console.log('\n💡 Fix: Ensure bot is invited to the server with proper permissions');
    }
  }
})();
