# Deploy Pip Bot to Render.com

## Quick Deploy

1. **Sign up** at [render.com](https://render.com) (free account)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `dice-cat` repository

3. **Configure Service**
   - **Name**: `pip-bot`
   - **Root Directory**: `pip-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   Click "Advanced" → Add environment variables:
   ```
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_server_id_here
   ```

5. **Choose Plan**
   - **Free**: Bot will spin down after 15 min of inactivity (not ideal)
   - **Starter ($7/month)**: 24/7 uptime (recommended for Discord bots)

6. **Deploy!**
   Click "Create Web Service"

## Important Notes

### Free Tier Limitations ⚠️
Render's free tier **spins down after 15 minutes of inactivity**. For Discord bots that need to respond to commands 24/7, this means:
- First command after spin-down takes ~30 seconds to respond
- Users will experience delays
- Not ideal for production use

**Recommendation**: Use the **Starter plan ($7/month)** for always-on Discord bot hosting.

### Alternative: Background Worker
If you don't need the bot to respond to web requests, change the service type:

```yaml
services:
  - type: worker  # Better for Discord bots
    name: pip-bot
    runtime: node
    plan: starter
    buildCommand: npm install
    startCommand: npm start
```

Worker services are designed for long-running processes like Discord bots.

## Deployment from render.yaml

Render can auto-detect the `render.yaml` file:

1. Push your code to GitHub
2. In Render dashboard, click "New +" → "Blueprint"
3. Select your repository
4. Render will detect `render.yaml` and configure automatically
5. Add your environment variables
6. Deploy!

## Monitoring

After deployment:
- Check the **Logs** tab to see bot output
- Look for "✅ Loaded command:" messages
- Bot should show as "Online" in Discord

## Troubleshooting

### Bot shows offline
- Check Render logs for errors
- Verify environment variables are set correctly
- Make sure Discord token is valid

### Commands not working
- Run `npm run deploy` locally first to register slash commands
- Discord can take up to 1 hour to sync commands

### Out of memory errors
- Upgrade to a larger instance size in Render dashboard
- Free tier has 512MB RAM (usually enough for small bots)

## Cost Comparison

| Plan | Cost | Uptime | RAM | CPU |
|------|------|--------|-----|-----|
| Free | $0 | Spins down | 512MB | Shared |
| Starter | $7/mo | 24/7 | 512MB | Shared |
| Standard | $25/mo | 24/7 | 2GB | Shared |

For Pip Bot, the **Starter plan ($7/month)** is recommended for production use.
