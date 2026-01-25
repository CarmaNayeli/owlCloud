# 🚀 Pip2 Bot Remote Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Discord Bot Setup
- [ ] Create Discord Application at [discord.com/developers](https://discord.com/developers/applications)
- [ ] Enable Message Content Intent and Server Members Intent
- [ ] Copy Bot Token → `DISCORD_TOKEN`
- [ ] Copy Application ID → `DISCORD_CLIENT_ID`
- [ ] Invite bot to server with proper permissions
- [ ] Copy Server ID → `DISCORD_GUILD_ID`

### 2. Supabase Setup (for RollCloud)
- [ ] Create Supabase project
- [ ] Copy Project URL → `SUPABASE_URL`
- [ ] Copy service_role key → `SUPABASE_SERVICE_KEY`

### 3. Repository Setup
- [ ] Push all code to GitHub
- [ ] Ensure `render.yaml` is in root
- [ ] Verify `package.json` has correct scripts

## 🌐 Render.com Deployment

### Option A: Auto-Deploy (Recommended)
1. [ ] Push code to GitHub
2. [ ] Go to Render.com → "New +" → "Blueprint"
3. [ ] Select your repository
4. [ ] Render auto-detects `render.yaml`
5. [ ] Add environment variables in dashboard
6. [ ] Deploy!

### Option B: Manual Setup
1. [ ] Go to Render.com → "New +" → "Web Service"
2. [ ] Connect GitHub repository
3. [ ] Configure:
   - Name: `pip-bot`
   - Root Directory: `Pip2` (or wherever the bot code is)
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Type: Worker (better for bots)

## 🔧 Environment Variables (Set in Render Dashboard)

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_server_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
NODE_ENV=production
```

## ⚡ Post-Deployment Steps

### 1. Deploy Slash Commands
```bash
# Run this locally with the same credentials
npm run deploy
```

### 2. Test the Bot
- [ ] Check Render logs for "✅ Loaded command:" messages
- [ ] Bot should appear online in Discord
- [ ] Test `/ping` command
- [ ] Test `/help` command

### 3. Verify RollCloud Integration
- [ ] Test `/rollcloud` with a pairing code
- [ ] Check Supabase for data storage
- [ ] Test webhook creation

## 💰 Cost Considerations

| Plan | Cost | Uptime | Best For |
|------|------|--------|-----------|
| Free | $0 | Spins down after 15min | Testing |
| Starter | $7/mo | 24/7 | Production |
| Standard | $25/mo | 24/7 | High traffic |

**Recommendation**: Starter plan ($7/mo) for reliable Discord bot hosting.

## 🔍 Troubleshooting

### Bot Not Responding
- Check Render logs for errors
- Verify all environment variables
- Ensure Discord token is valid
- Check if bot has proper permissions

### Commands Not Working
- Run `npm run deploy` locally first
- Wait up to 1 hour for Discord sync
- Check if commands are registered in Discord

### RollCloud Issues
- Verify Supabase credentials
- Check webhook permissions
- Test pairing code generation

## 📊 Monitoring

### Render Dashboard
- Check "Logs" tab for bot output
- Monitor "Metrics" for performance
- Set up alerts if needed

### Discord
- Bot should show as "Online"
- Commands should appear in slash menu
- Test integration features

## 🔄 Updates

To update the bot:
1. Push changes to GitHub
2. Render auto-deploys (or trigger manual deploy)
3. Redeploy commands if needed: `npm run deploy`

---

**Ready to deploy?** Follow this checklist and your Pip2 bot will be running 24/7 on Render.com!
