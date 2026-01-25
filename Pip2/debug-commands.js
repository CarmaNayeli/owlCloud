/**
 * Debug script to check command loading and deployment
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Debugging Pip2 Commands...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ Set' : '❌ Missing');
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

// Check command files
console.log('\n📁 Command Files:');
const commandsPath = join(__dirname, 'src', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`Found ${commandFiles.length} command files:`);
commandFiles.forEach(file => console.log(`  - ${file}`));

// Load and validate commands
console.log('\n🚀 Loading Commands:');
const commands = [];

for (const file of commandFiles) {
  try {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);

    if ('data' in command.default && 'execute' in command.default) {
      const commandData = command.default.data.toJSON();
      commands.push(commandData);
      console.log(`✅ ${commandData.name}: ${commandData.description}`);
    } else {
      console.log(`❌ ${file}: Missing data or execute property`);
    }
  } catch (error) {
    console.log(`❌ ${file}: Error loading - ${error.message}`);
  }
}

// Check if we can deploy
console.log('\n🔧 Deployment Check:');
if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_GUILD_ID) {
  console.log('❌ Cannot deploy: Missing Discord credentials');
  console.log('\nTo fix:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Fill in your Discord bot credentials');
  console.log('3. Run npm run deploy');
} else {
  console.log('✅ Ready to deploy commands');
  console.log(`📊 ${commands.length} commands ready to deploy`);
}

// Show command summary
console.log('\n📋 Command Summary:');
commands.forEach(cmd => {
  const options = cmd.options?.length || 0;
  const subcommands = cmd.options?.filter(opt => opt.type === 1)?.length || 0;
  console.log(`  /${cmd.name} - ${options} options, ${subcommands} subcommands`);
});

console.log('\n🎯 Next Steps:');
console.log('1. Create .env file with your credentials');
console.log('2. Run: npm run deploy');
console.log('3. Run: npm start (or npm run dev for development)');
