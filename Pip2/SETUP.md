# Pip2 Bot Setup Guide

## 🚀 Quick Setup

### 1. Create Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Pip2 Bot")
4. Go to "Bot" section
5. Click "Add Bot"
6. Enable **Message Content Intent** and **Server Members Intent**
7. Copy the **Bot Token** → `DISCORD_TOKEN`
8. Copy the **Application ID** → `DISCORD_CLIENT_ID`

### 2. Invite Bot to Server
1. In Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Administrator (recommended) or specific permissions:
     - Manage Webhooks
     - Manage Roles
     - Manage Channels
     - Send Messages
     - Embed Links
     - Read Message History
4. Copy the generated URL and invite to your server
5. Get your **Server ID** (right-click server icon → Copy Server ID) → `DISCORD_GUILD_ID`

### 3. Set Up Supabase (for RollCloud integration)
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy the **Project URL** → `SUPABASE_URL`
5. Copy the **service_role** key → `SUPABASE_SERVICE_KEY`

### 4. Configure Environment
Fill in your `.env` file:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here  
DISCORD_GUILD_ID=your_guild_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

### 5. Deploy Commands
```bash
npm run deploy
```

### 6. Start Bot
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## 🔧 Troubleshooting

### Commands Not Working
1. **Check environment variables**: Run `node debug-commands.js`
2. **Redeploy commands**: `npm run deploy`
3. **Wait for sync**: Discord can take up to 1 hour to sync commands
4. **Check bot permissions**: Ensure bot has required permissions

### Bot Not Responding
1. **Check token**: Verify DISCORD_TOKEN is correct
2. **Check intents**: Ensure Message Content Intent is enabled
3. **Check console**: Look for error messages

### RollCloud Integration Issues
1. **Check Supabase**: Verify URL and service key are correct
2. **Check permissions**: Bot needs Manage Webhooks permission
3. **Check pairing codes**: Codes expire after 15 minutes

## 📋 Available Commands

Once deployed, the bot will have these commands:

- `/help` - Show all commands
- `/roll 2d6` - Roll dice
- `/coin 5` - Flip coins  
- `/rollcloud ABC123` - Connect RollCloud
- `/ping` - Check bot latency
- `/changelog view` - View app updates
- `/ticket setup` - Create support system
- `/reactionrole create` - Set up reaction roles

## 🎯 Test the Bot

1. Run `/ping` to test basic functionality
2. Run `/help` to see all commands
3. Try `/roll 1d20` to test dice rolling
4. Set up RollCloud integration with `/rollcloud`

The bot should now be fully functional!
