# Vercel Deployment Guide for Pip Dashboard

## Environment Variables Setup

The Pip dashboard requires several environment variables to work properly. Here's how to configure them on Vercel:

### Required Environment Variables

#### 1. NextAuth Configuration
```
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secure-random-string
```

#### 2. Discord OAuth Configuration
```
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_CLIENT_SECRET=your-discord-application-client-secret
```

#### 3. Discord Bot Token
```
DISCORD_TOKEN=your-discord-bot-token
```

#### 4. Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### How to Get These Values

#### Discord Application Setup
1. Go to https://discord.com/developers/applications
2. Create a new application or select your existing one
3. Go to the "OAuth2" tab:
   - Copy the **CLIENT ID**
   - Copy the **CLIENT SECRET**
4. Go to the "Bot" tab:
   - If you don't have a bot, click "Add Bot"
   - Copy the **BOT TOKEN**

#### NextAuth Secret
Generate a secure random string:
```bash
openssl rand -base64 32
```

#### Supabase Configuration
1. Go to your Supabase project dashboard
2. Go to Settings > API
3. Copy the **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
4. Copy the **anon** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
5. Copy the **service_role** key (SUPABASE_SERVICE_KEY)

### Setting Up on Vercel

1. Go to your Vercel project dashboard
2. Go to Settings > Environment Variables
3. Add each variable with the exact names shown above
4. Make sure to select the correct environment (Production, Preview, Development)

### Common Issues

#### "Pip not detected" Issue
If the dashboard shows servers but says "Pip not in server":
1. Make sure `DISCORD_TOKEN` is set correctly
2. Ensure the bot is actually invited to the server
3. Check that the bot has the correct permissions

#### "Discord authentication failed" Issue
1. Check that `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
2. Ensure the redirect URI in Discord app settings matches your Vercel URL
3. Make sure OAuth2 is enabled in your Discord application

#### "No Servers Found" Issue
1. Ensure you have admin permissions in at least one Discord server
2. Check that the Discord OAuth is working properly
3. Verify the bot is invited to servers where you have admin permissions

### Bot Permissions Required

For the bot to work properly, it needs these permissions:
- View Channels
- Send Messages
- Use Application Commands
- Manage Roles
- Manage Channels
- Manage Messages
- Embed Links
- Attach Files
- Read Message History

### Testing the Setup

1. Deploy your changes to Vercel
2. Visit https://your-domain.vercel.app/configure-pip
3. Sign in with Discord
4. You should see your servers where you have admin permissions
5. The bot status should show "✅ Pip is in server" for servers where the bot is present

### Troubleshooting

Check the Vercel function logs for detailed error messages:
1. Go to your Vercel project
2. Click on the "Functions" tab
3. Look for any error messages in the API function logs

Common log messages to look for:
- "❌ No Discord bot token found in environment variables"
- "❌ Discord API error: 401 Unauthorized"
- "🔍 Available env vars: ..." (shows which env vars are missing)
