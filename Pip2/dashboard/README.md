# Pip Bot Dashboard

Web dashboard for managing Pip Bot - the Dice Cat Discord bot.

## Features

- **Reaction Roles Management**: View all configured reaction role messages
- **Changelog Viewer**: Read the latest Dice Cat app updates
- **Command Reference**: Quick access to all bot commands
- **Health Monitoring**: API health check endpoint

## Deployment to Vercel

### Quick Deploy

1. **Set Root Directory**: In Vercel project settings, set the root directory to `pip-bot/dashboard`

2. **Deploy**: Vercel will auto-detect Next.js and deploy

The dashboard will be available at: `https://pip-bot.vercel.app/`

### Vercel Configuration

**IMPORTANT**: Set Root Directory to `pip-bot/dashboard` in Vercel project settings.

Vercel will automatically:
- Detect Next.js framework
- Run `npm install`
- Run `npm run build`
- Deploy the `.next` directory

### Environment Variables

No environment variables are required for basic functionality. The dashboard reads:
- Reaction roles from `pip-bot/data/reaction-roles.json`
- Changelog from `CHANGELOG.md` in the repository root

## Local Development

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

- `/` - Dashboard homepage with quick links
- `/reaction-roles` - View and manage reaction role configurations
- `/changelog` - Read the latest app changelog
- `/api/health` - Health check endpoint
- `/api/reaction-roles` - Get reaction roles data (JSON)
- `/api/changelog` - Get changelog content (JSON)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Vercel

## File Structure

```
dashboard/
├── app/
│   ├── api/                 # API routes
│   │   ├── changelog/       # Changelog API
│   │   ├── health/          # Health check
│   │   └── reaction-roles/  # Reaction roles API
│   ├── changelog/           # Changelog page
│   ├── reaction-roles/      # Reaction roles page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   └── globals.css          # Global styles
├── public/                  # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Notes

- The dashboard is read-only - modifications must be made through Discord commands
- API routes use filesystem access to read bot data
- Dark mode is automatically detected from system preferences
- Mobile-responsive design with Tailwind CSS

## Troubleshooting

### Reaction roles not loading

Ensure the `pip-bot/data/reaction-roles.json` file exists. If the bot hasn't created any reaction roles yet, the API will return an empty object.

### Changelog not loading

Check that the `CHANGELOG.md` file exists in the repository root. The API looks two directories up from the dashboard.

## Future Enhancements

- Authentication for admin features
- Real-time bot status monitoring
- Discord OAuth integration
- Reaction role creation from dashboard
- Bot statistics and analytics
