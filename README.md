# RollCloud: Dice Cloud Integration for Roll20

A browser extension that integrates Dice Cloud with Roll20. I built this to make importing D&D characters seamless - just click a button and your character data appears in Roll20 with interactive dice rolling and combat management.

## 🌐 Live Dashboard

**[📊 RollCloud Dashboard](https://rollcloud.vercel.app)** - Manage your Discord integration and view real-time status online

---

## 🖥️ Platform Support

**Currently Supported:**
- ✅ **Chromium-based browsers** (Chrome, Edge, Brave, Opera)
- ✅ **Firefox**
- ⏳ **Safari** - Planned for future release

**Installer:**
- 🪟 **Windows only** - Automated installer for Chrome and Firefox

---

**🎲 Latest Release**

**Manual Install:** [Firefox](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi) | [Chrome](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.zip)

**Windows Installer (Chrome + Firefox):** [Download Installer](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/RollCloud-Setup-v2-Setup.exe)

## Installation

### 🚀 Quick Install (Recommended)

Download the pre-built extension for your browser:

#### 🦊 Firefox
[**Download RollCloud for Firefox**](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox.zip)

1. **Download** the Firefox ZIP file
2. **Extract** the ZIP file to a folder
3. **Open** Firefox and navigate to `about:debugging#/runtime/this-firefox`
4. **Click** "Load Temporary Add-on"
5. **Select** any file from the extracted folder
6. **Done!** The RollCloud icon appears in your toolbar

#### 🌐 Chrome / Edge / Brave
[**Download RollCloud for Chrome**](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.zip)

1. **Download** the Chrome ZIP file
2. **Extract** the ZIP file to a folder
3. **Open** Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
4. **Enable** "Developer mode" toggle in the top-right
5. **Click** "Load unpacked" and select the extracted folder
6. **Done!** The RollCloud icon appears in your toolbar

#### 🧭 Safari (Coming Soon)

Safari support is currently on hold and planned for a future release. RollCloud is fully functional on **Chromium-based browsers** (Chrome, Edge, Brave, Opera) and **Firefox**.

## Features

### Character Import
- **API-Powered**: I use DiceCloud's official REST API to get your character data
- **Smart Parsing**: Leverages DiceCloud's standardized variable names
- **Secure Authentication**: Login with DiceCloud credentials (stored locally)
- **Auto-Connect**: Automatically extracts authentication token from logged-in session
- **One-Click Export**: Extract character data with a single click
- **Data Persistence**: Character data stored locally between sessions

### Interactive Character Sheet & Dice Rolling
- **Character Sheet Overlay**: Interactive overlay displays character data on Roll20
- **Click-to-Roll**: Click any ability, skill, or save to roll dice
- **Direct Roll20 Integration**: Rolls posted directly to Roll20 chat
- **Roll Options**: Support for advantage/disadvantage and custom modifiers
- **Character Attribution**: Rolls appear under character's name in Roll20
- **Guidance & Bless**: Automatic +1d4 for ability checks and attacks/saves

### GM Combat Management
- **GM Initiative Tracker**: Combat management with automatic turn detection
- **Action Economy Tracking**: Automatic action/bonus action/reaction tracking
- **Turn-Based Visual Indicators**: Action economy lights up for current character
- **Chat History Integration**: Checks recent chat messages for turn detection
- **D&D 5e Rules Compliance**: Enforces one reaction per round, proper tracking
- **Hidden Rolls**: GM Mode hides rolls until revealed
- **Player Overview**: Track party member HP, AC, and conditions
- **Discord Integration**: Real-time turn and combat updates in Discord

### Discord Integration
- **Real-Time Combat Updates**: I send turn changes and action economy updates to your Discord
- **Pip Bot Connection**: I built Pip Bot to handle Discord integration seamlessly
- **One-Click Setup**: Generate connection code in extension, enter in Discord
- **Web Dashboard**: Manage integration and view status at [pip-bot.vercel.app](https://pip-bot.vercel.app)
- **Server Management**: Support for multiple Discord servers
- **Combat Notifications**: Automatic turn announcements and action economy status

### Lucky Feat System
- **Lucky Feat Integration**: Manual action button with modal interface
- **Character State Preservation**: Cache system prevents resource refreshing
- **Resource Management**: Lucky points tracking without duplication
- **Roll20 Integration**: Lucky rolls sent to chat with proper formatting

### Effects & Buffs System
- **Buffs & Debuffs**: System for managing active effects
- **Auto-Apply**: Automatic modifiers for rolls based on active effects
- **Effect Persistence**: Effects maintained across character switching

## Usage

### First Time Setup

1. **Login to DiceCloud**
   - Click the extension icon in your browser toolbar
   - Enter your DiceCloud username/email and password
   - Click "Login to DiceCloud"
   - Your API token will be stored securely in the browser

**Security Note**: Your password is sent directly to DiceCloud's API and is not stored. Only the API token is saved locally.

### Method 1: Using the Extension Popup

1. **Extract from Dice Cloud**
   - Navigate to your character sheet on [Dice Cloud](https://dicecloud.com)
   - The URL should look like: `https://dicecloud.com/character/[character-id]/Name`
   - Click the extension icon in your browser toolbar
   - Click "Extract from Dice Cloud"
   - Character data is fetched via DiceCloud API and stored locally

2. **Import to Roll20**
   - Navigate to your character sheet on [Roll20](https://app.roll20.net)
   - Click the extension icon in your browser toolbar
   - Click "Import to Roll20"
   - Your character data will be populated!

### Method 2: Using Floating Buttons

1. **On Dice Cloud**
   - A floating "Export to Roll20" button appears in the bottom-right corner
   - Click it to extract your character data via API
   - **Shift+Click** for debug mode (see Troubleshooting below)

2. **On Roll20**
   - A floating "Import from Dice Cloud" button appears in the bottom-right corner
   - Click it to import your character data
   - **Shift+Click** for field debug mode

### Using the Character Sheet Overlay

Once you've imported your character data:

1. **Open the Character Sheet**:
   - On Roll20, click the "📋 Character Sheet" button (bottom-right)
   - Or use the extension popup to open the sheet
   - Your character data loads in an interactive overlay

2. **Rolling Dice**:
   - Click any stat card (abilities, skills, saves, initiative) to roll
   - Customize your roll with advantage/disadvantage settings
   - Use the Roll Settings panel to configure roll behavior
   - Rolls are posted directly to Roll20's chat

3. **Lucky Feat Usage**:
   - Click the "🍀 Lucky" button when you have Lucky points available
   - Choose offensive (attack roll) or defensive (ability check/save) usage
   - Roll an additional d20 and pick the better result
   - Lucky points are tracked automatically and deducted after use

### Discord Integration Setup

Connect RollCloud to Discord for real-time combat updates and turn tracking:

#### Prerequisites
- Discord server with admin permissions
- Pip Bot added to your server (invite link available in extension)

#### Setup Process

1. **Add Pip Bot to Discord**:
   - Click the "Discord Integration" button in the RollCloud extension
   - Follow the invite link to add Pip Bot to your Discord server
   - Ensure the bot has necessary permissions for posting messages

2. **Generate Connection Code**:
   - In RollCloud extension, click "Setup Discord Integration"
   - The extension will generate a 6-character code (e.g., `ABC123`)
   - Copy this code

3. **Connect in Discord**:
   - In your Discord server, type `/rollcloud [your-code]`
   - Example: `/rollcloud ABC123`
   - The bot will confirm the connection

4. **Verify Connection**:
   - Extension will show "Connected to Discord" status
   - Start combat in Roll20 to test turn notifications
   - Check Discord for real-time updates

#### Features in Discord

- **Turn Notifications**: Automatic announcements when combat turns change
- **Action Economy**: Real-time status of actions, bonus actions, and reactions
- **Combat Flow**: Seamless tracking of initiative and turn order
- **Slash Commands**: Cast spells and use abilities directly from Discord
  - `/cast` - Cast spells with autocomplete and upcast options
  - `/use` - Use character actions and abilities
  - `/roll` - Roll dice with modifiers
  - Interactive buttons for attack rolls, damage rolls, and more
- **Multiple Servers**: Support for different Discord servers with unique connections

#### Web Dashboard

Manage your Discord integration online:
- **Setup URL**: [rollcloud.vercel.app/setup](https://rollcloud.vercel.app/setup)
- **Dashboard**: [pip-bot.vercel.app](https://pip-bot.vercel.app)
- **Features**: View connection status, manage servers, command reference
- **Real-time Status**: Monitor active connections and combat updates

#### Troubleshooting Discord Integration

- **Bot Not Responding**: Ensure Pip Bot is online and has message permissions
- **Invalid Code**: Generate a new code from the extension (codes expire after 5 minutes)
- **No Notifications**: Check that you're in GM mode and combat is active
- **Multiple Servers**: Each server needs its own connection code

## 🧪 Experimental Build - Two-Way Sync

### Overview
The experimental build contains two-way synchronization code that allows changes made in Roll20 to update DiceCloud character sheets using Meteor's DDP protocol.

### Current Implementation Status

#### ✅ What's Implemented
- **Meteor DDP Client**: Complete WebSocket client for DiceCloud communication
- **Build System**: Experimental builds compile with `npm run build:exp`
- **HP Sync Logic**: Property cache system to identify correct Hit Points fields
- **Documentation**: Implementation guides and technical documentation

#### ⚠️ Current Limitations
- **Integration Gap**: Experimental files are copied during build but not integrated into main extension code
- **Manual Testing**: Requires manual file copying and extension reloading
- **Limited Scope**: Only Hit Points sync is partially implemented
- **No UI Controls**: No settings toggle to enable/disable sync

### Building and Testing

#### Build Commands
```bash
# Standard build (stable)
npm run build

# Experimental build with two-way sync
npm run build:exp
# or
npm run build:experimental
```

#### Installation
1. Build experimental version: `npm run build:exp`
2. Load in browser:
   - Chrome: `chrome://extensions/` → Load unpacked → `dist-experimental/chrome/`
   - Firefox: `about:debugging` → Load Temporary Add-on → `dist-experimental/firefox/manifest.json`

#### Testing Process
1. Use test characters, not main campaign characters
2. Backup DiceCloud data before testing
3. Monitor browser console for `[DDP]` and `[Sync]` messages
4. Verify property updates in DiceCloud after Roll20 changes

## Troubleshooting

### Character Import Issues
- **"Not logged in to DiceCloud"**: Click extension icon and login again
- **"API token expired"**: Your session expired; login again via the popup
- **"Not on a character page"**: Navigate to a DiceCloud character sheet
- **Fields not populating in Roll20**: Try Shift+Click for field debug mode

### Roll20 Chat Issues
- **Rolls not appearing**: Ensure Roll20 tab is open and chat is visible
- **Wrong character speaking**: Re-import character data to update name
- **Template errors**: Using a custom Roll20 sheet? May need template customization

### Character Sheet Overlay Issues
1. **Sheet Won't Open**:
   - Check that you've imported character data first
   - Look for the "📋 Character Sheet" button in bottom-right of Roll20
   - Try using the extension popup to open the sheet
   - Check browser console (`F12`) for error messages

2. **Rolls Not Posting**:
   - Ensure Roll20 chat is visible and not minimized
   - Check that you're logged into Roll20
   - Verify character name is set in the imported data
   - Try refreshing the Roll20 page

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify you're on the correct Dice Cloud/Roll20 pages
3. Try clearing the extension data and re-extracting
4. Open an issue on GitHub with details about your problem
5. **If all else fails, message me on Discord @Carmabella - I'm a solo dev and I'll help you out!**

---

Made with ❤️ for the D&D community
