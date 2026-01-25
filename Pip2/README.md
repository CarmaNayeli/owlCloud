# Pip Bot 🎲

Discord bot for the Dice Cat community server - a lightweight utility bot focused on changelogs and fun commands.

**🌐 Web Dashboard**: [https://pip-bot.vercel.app/](https://pip-bot.vercel.app/)

## Features

### 📋 Changelog Management
- `/changelog view` - View the latest Dice Cat app changelog
- `/changelog post` - Post changelog to announcements (Admin only)

### 🎭 Reaction Roles
- `/reactionrole create` - Create a new reaction role message
- `/reactionrole add` - Add a role assignment to a message
- `/reactionrole remove` - Remove a role from a message
- `/reactionrole list` - List all reaction roles on a message
- `/reactionrole delete` - Delete all reaction roles from a message
- Users can self-assign roles by reacting to configured messages

### 🎲 Fun Utilities
- `/roll [dice]` - Roll dice using standard notation (2d6, 1d20+5, etc.)
- `/coin [count]` - Flip one or more coins
- `/ping` - Check bot responsiveness
- `/help` - Show help information

### 🎮 RollCloud Integration
- `/rollcloud [code]` - Connect RollCloud extension to Discord
- Receive real-time turn and action economy updates from Roll20 combat
- One-click setup: extension generates code, type it in Discord, done!

### 🛡️ Moderation & Welcome
- Automatic welcome messages for new members
- Ready for custom moderation commands

## Changelog Features

The bot can read the `CHANGELOG.md` file from the main Dice Cat repository and:
- Display recent changes to users
- Post formatted updates to announcement channels
- Ping `@everyone` for new releases (admin only)

Perfect for keeping your Discord community informed about app updates!

## Setup

### Prerequisites
- Node.js 18 or higher
- Discord Bot Token
- Discord Server with admin permissions

### Installation

1. Navigate to the pip-bot directory:
```bash
cd pip-bot
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Add your Discord bot configuration to `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here
```

4. Deploy slash commands:
```bash
npm run deploy
```

5. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Deployment

### Option 1: Render.com (Recommended for Cloud Hosting)

Easy cloud deployment with $7/month for 24/7 uptime:

1. Sign up at [render.com](https://render.com)
2. Create a new Web Service from your GitHub repo
3. Set root directory to `pip-bot`
4. Add environment variables (DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
5. Choose Starter plan ($7/month) for always-on bot
6. Deploy!

See [RENDER_DEPLOY.md](RENDER_DEPLOY.md) for detailed instructions.

**Note**: Free tier spins down after inactivity - not ideal for Discord bots.

### Option 2: Railway.app

Free tier with 500 hours/month (enough for 24/7):

1. Sign up at [railway.app](https://railway.app)
2. Deploy from GitHub
3. Set root to `pip-bot`
4. Add environment variables
5. Deploy for free!

### Option 3: Self-Hosted

Run on your own server with PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name pip-bot
pm2 save
pm2 startup
```

## Configuration

See `.env.example` for all available configuration options.

Key settings:
- `DISCORD_TOKEN` - Your bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` - Your bot's client ID
- `DISCORD_GUILD_ID` - Your Discord server ID

## Command Examples

### Dice Rolling
```
/roll 2d6          → Roll two 6-sided dice
/roll 1d20+5       → Roll d20 and add 5
/roll 3d10-2       → Roll three d10 and subtract 2
/roll 100d6        → Roll 100 d6 (max supported)
```

### Coin Flipping
```
/coin              → Flip one coin
/coin 10           → Flip 10 coins
/coin 100          → Flip 100 coins with statistics
```

### Changelog
```
/changelog view    → View latest changes
/changelog post    → Post to announcements (admin only)
/changelog post #updates  → Post to specific channel
```

### Reaction Roles
```
# Create a reaction role message
/reactionrole create title:"Choose Your Games" description:"React to get game notifications!"

# Add roles to the message
/reactionrole add message_id:123456789 emoji:🎲 role:@Dice Match Players
/reactionrole add message_id:123456789 emoji:🎮 role:@General Gaming

# List all reaction roles on a message
/reactionrole list message_id:123456789

# Remove a specific reaction role
/reactionrole remove message_id:123456789 emoji:🎲

# Delete all reaction roles from a message
/reactionrole delete message_id:123456789
```

### RollCloud Integration
```
# Connect RollCloud extension (use code from extension)
/rollcloud ABC123
```

**Setup Flow:**
1. Open RollCloud extension → Discord Integration → Click "Setup Discord"
2. Extension shows a 6-character code (e.g., `ABC123`) and opens Discord
3. Add Pip Bot to your server (if not already added)
4. In Discord, type `/rollcloud ABC123` (your code)
5. Done! Extension auto-connects, turns appear in Discord!

## Development

### Adding New Commands

1. Create a new file in `src/commands/`
2. Export an object with `data` and `execute` properties
3. The bot will automatically load it on restart

Example:
```javascript
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command'),

  async execute(interaction) {
    await interaction.reply('Hello!');
  }
};
```

### Adding New Events

1. Create a new file in `src/events/`
2. Export an object with `name`, `once`, and `execute` properties
3. The bot will automatically load it on restart

## Architecture

```
pip-bot/
├── src/
│   ├── commands/            # Slash commands
│   │   ├── changelog.js     # View/post changelogs
│   │   ├── coin.js          # Coin flip
│   │   ├── help.js          # Help system
│   │   ├── ping.js          # Status check
│   │   ├── reactionrole.js  # Reaction role management
│   │   ├── roll.js          # Dice rolling
│   │   └── rollcloud.js     # RollCloud webhook integration
│   ├── events/              # Discord event handlers
│   │   ├── ready.js         # Bot startup
│   │   ├── guildMemberAdd.js        # Welcome messages
│   │   ├── messageReactionAdd.js    # Reaction role assignment
│   │   └── messageReactionRemove.js # Reaction role removal
│   ├── utils/               # Utility functions
│   │   └── reactionRoleStorage.js   # Reaction role data persistence
│   ├── index.js             # Main bot file
│   └── deploy-commands.js   # Command deployment
├── dashboard/               # Web dashboard (Next.js)
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   ├── reaction-roles/  # Reaction roles page
│   │   ├── changelog/       # Changelog page
│   │   └── page.tsx         # Homepage
│   ├── package.json
│   └── README.md            # Dashboard docs
├── data/                    # Bot data storage (gitignored)
│   ├── reaction-roles.json  # Reaction role configurations
│   └── rollcloud-webhooks.json  # RollCloud webhook URLs per server
├── .env                     # Environment variables (gitignored)
├── .env.example             # Example environment variables
├── vercel.json              # Vercel deployment config
├── package.json             # Dependencies
└── README.md                # This file
```

## Web Dashboard

A Next.js web dashboard is available for managing the bot:

- **URL**: [https://pip-bot.vercel.app/](https://pip-bot.vercel.app/)
- **Features**: View reaction roles, read changelog, command reference
- **Deployment**: Vercel with root directory set to `pip-bot/dashboard`

See `dashboard/README.md` for development and deployment instructions.

## Future Ideas

- Discord OAuth authentication for dashboard
- Real-time bot status monitoring
- Dashboard-based reaction role creation
- Custom announcement formatting
- Scheduled changelog posts
- Auto-moderation features (spam, invites, profanity filters)
- Custom server stats and analytics
- Integration with Dice Cat app API
- Server logging (joins, leaves, message edits/deletes)
- Custom tags/commands system

## License

MIT
