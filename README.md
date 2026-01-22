# RollCloud: Dice Cloud Integration for Roll20

A powerful browser extension that seamlessly integrates Dice Cloud with Roll20. Import your D&D character data using the official DiceCloud REST API, enjoy interactive character sheets with click-to-roll functionality, manage combat with GM tools, and enhance your tabletop gaming experience with advanced features.

**🎲 Version 1.1.2 - Enhanced Authentication & Auto-Connect**

**Quick Download:** [Firefox](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox.zip) | [Chrome](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.zip) | [Safari](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-safari.zip)

## Features

### Character Import
- **API-Powered**: Uses DiceCloud's official REST API for reliable, standardized data extraction
- **Smart Parsing**: Leverages DiceCloud's standardized variable names (strength, dexterity, etc.)
- **Secure Authentication**: Login with your DiceCloud credentials (stored locally in browser)
- **Auto-Connect (NEW!)**: Automatically extracts authentication token from logged-in DiceCloud session
- **Token Expiry Handling**: Proper token management per DiceCloud API documentation
- **One-Click Export**: Extract character data from Dice Cloud with a single click
- **Easy Import**: Import character data directly into Roll20 character sheets
- **Data Persistence**: Character data is stored locally between Dice Cloud and Roll20 sessions

### Interactive Character Sheet & Dice Rolling (NEW!)
- **Character Sheet Overlay**: Beautiful interactive overlay displays your DiceCloud character data on Roll20
- **Click-to-Roll**: Click any ability, skill, or save in the overlay to instantly roll dice
- **Direct Roll20 Integration**: Rolls are posted directly to Roll20's chat using native roll commands
- **Advanced Roll Options**: Support for advantage/disadvantage, custom modifiers, and roll settings
- **Character Attribution**: Rolls automatically appear under your character's name in Roll20
- **Guidance**: Pre-roll popup asks to add 1d4 to ability checks (consumes buff, follows 5e RAW timing)
- **Bless**: Automatically adds +1d4 to attack rolls and saves (no popup needed, auto-apply)

### GM Combat Management
- **GM Initiative Tracker**: Full combat management system with automatic turn detection
- **Action Economy Tracking**: Automatic action/bonus action/reaction usage tracking per turn
- **Turn-Based Visual Indicators**: Action economy lights up for current character, greys out for others
- **Chat History Integration**: Checks recent chat messages when switching tabs or opening sheets
- **D&D 5e Rules Compliance**: Enforces one reaction per round, proper action tracking
- **Real-Time Turn Notifications**: Automatic turn detection and action economy activation
- **Hidden Rolls**: GM Mode hides rolls until revealed for dramatic effect
- **Player Overview**: Track party member HP, AC, and conditions in real-time
- **Turn History**: Log combat actions with export functionality
- **Delayed Actions**: Support for delayed combatant turns

### Lucky Feat System (NEW!)
- **Lucky Feat Integration**: Manual action button with modal interface for offensive/defensive usage
- **Character State Preservation**: Cache system prevents resource refreshing when switching characters
- **Resource Management**: Lucky points tracking without duplication (filtered from resources display)
- **Roll20 Integration**: Lucky rolls sent to chat with proper formatting
- **Dynamic UI Updates**: Real-time Lucky point count updates

### Effects & Buffs System
- **Buffs & Debuffs**: Complete system for managing active effects
- **Auto-Apply**: Automatic modifiers for rolls based on active effects
- **Visual Indicators**: Clear display of active conditions and buffs
- **Effect Persistence**: Effects maintained across character switching

### User Experience
- **User-Friendly Interface**: Clean popup UI and floating action buttons on both platforms
- **Debug Tools**: Built-in debugging for troubleshooting roll detection
- **Cross-Platform**: Works on Chrome, Edge, and other Chromium-based browsers

## What Gets Imported

The extension uses DiceCloud's standardized variable names and property types to extract:

**Core Stats (from creatureVariables)**:
- Character Name, Race, Class, Level, Background, Alignment
- Ability Scores (strength, dexterity, constitution, intelligence, wisdom, charisma)
- Ability Modifiers (strengthMod, dexterityMod, etc.)
- Saving Throws (strengthSave, dexteritySave, etc.)
- All 18 D&D 5e Skills (acrobatics, athletics, etc.)
- Hit Points (current & max from hitPoints variable)
- Armor Class (armorClass variable)
- Speed, Initiative, Proficiency Bonus

**Character Properties (from creatureProperties)**:
- Classes & Class Levels
- Race & Racial Traits
- Background Features
- Feats & Features
- Spells (with level, school, components, descriptions)
- Equipment & Inventory Items
- Proficiencies (weapons, armor, tools, languages)

## 🔐 Authentication Improvements (Latest)

### Enhanced Login Experience
- **Auto-Connect Button**: One-click authentication using your existing DiceCloud session
- **Session Token Extraction**: Automatically detects and uses your logged-in DiceCloud credentials
- **Simplified Flow**: No more manual token entry - just click and connect
- **Token Expiry Management**: Handles token refresh and expiration gracefully per API standards

### Security & Reliability
- **Local Storage**: Authentication tokens stored securely in your browser only
- **API Compliance**: Follows DiceCloud's official authentication guidelines
- **Error Handling**: Clear error messages for authentication issues
- **Session Persistence**: Maintains login state across browser sessions

## 🧪 Experimental Build - Two-Way Sync

### Overview
The experimental build includes cutting-edge two-way synchronization between Roll20 and DiceCloud, allowing changes made in Roll20 to automatically update your DiceCloud character sheet in real-time.

### How Two-Way Sync Works

#### 🔄 Real-Time Data Flow
1. **DiceCloud → Roll20**: Character data flows from DiceCloud to Roll20 (standard feature)
2. **Roll20 → DiceCloud**: Changes in Roll20 flow back to DiceCloud (experimental feature)

#### 📊 What Gets Synced Back
- **Hit Points**: HP changes in Roll20 update DiceCloud health
- **Resource Consumption**: Spell slots, ki points, and other resources tracked
- **Condition Tracking**: Status effects and conditions synchronized
- **Action Usage**: Limited abilities and features usage tracked
- **Temporary HP**: Temp HP changes reflected in DiceCloud

#### 🛠️ Technical Implementation
- **Meteor DDP**: Uses DiceCloud's real-time communication protocol
- **Conflict Resolution**: Intelligently handles simultaneous changes
- **Offline Support**: Queues changes when connection is lost
- **Error Recovery**: Automatic retry mechanisms for failed syncs

#### ⚠️ Current Limitations
- **Experimental Status**: Features are in testing and may have bugs
- **DiceCloud API**: Dependent on DiceCloud's real-time API stability
- **Performance**: May impact browser performance with large parties
- **Data Safety**: Backup your DiceCloud data before using

### Getting the Experimental Build

#### Download Experimental Version
```bash
# Build experimental version locally
npm run build:exp

# Or download from releases (when available)
# Look for files ending in "-experimental.zip"
```

#### Installation
Same installation process as standard build, but the extension will show:
- **Name**: "RollCloud: EXPERIMENTAL"
- **Version**: Ends with ".1" (e.g., 1.1.2.1)
- **Warning banner**: Red notice in popup about experimental features

### Testing Guidelines
1. **Test Characters**: Use test characters, not main campaign characters
2. **Backup Data**: Export your DiceCloud character before testing
3. **Monitor Performance**: Watch for browser performance issues
4. **Report Issues**: Provide detailed bug reports for any problems
5. **Rollback Plan**: Be ready to switch back to standard build

### Future Development
- **Stable Release**: Experimental features will graduate to main build when ready
- **Enhanced Conflict Resolution**: Better handling of simultaneous edits
- **Performance Optimization**: Reduced impact on browser performance
- **Expanded Sync**: More data types synchronized between platforms

## Installation

### 🚀 Quick Install (Recommended)

Download the pre-built extension for your browser - all features included and ready to use!

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

#### 🧭 Safari
[**Download RollCloud for Safari**](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-safari.zip)

**Requirements:**
- macOS with Safari 14.0 or later
- Xcode (free from Mac App Store)

**Installation:**
1. **Download** and extract the Safari ZIP file
2. **Open** Terminal and navigate to the extracted folder
3. **Convert** to Safari App Extension:
   ```bash
   xcrun safari-web-extension-converter . --app-name RollCloud
   ```
4. **Follow** the Xcode setup prompts
5. **Build** and run the project (⌘R)
6. **Enable** the extension in Safari preferences

📖 **For detailed Safari instructions and troubleshooting, see [SAFARI.md](SAFARI.md)**

---

### Build From Source (Advanced)

If you prefer to build the extension yourself:

1. Clone this repository:
   ```bash
   git clone https://github.com/YourUsername/rollCloud.git
   cd rollCloud
   ```

2. Build browser-specific packages:
   ```bash
   # Standard build (stable)
   npm run build

   # Experimental build with two-way sync
   npm run build:exp
   ```

3. Install in your browser:
   - **Chrome/Edge**:
     - Navigate to `chrome://extensions/` or `edge://extensions/`
     - Enable "Developer mode"
     - Click "Load unpacked" and select:
       - `dist/chrome/` for standard build
       - `dist-experimental/chrome/` for experimental build

   - **Firefox**:
     - Navigate to `about:debugging#/runtime/this-firefox`
     - Click "Load Temporary Add-on"
     - Select any file in:
       - `dist/firefox/` for standard build
       - `dist-experimental/firefox/` for experimental build

4. The extension icon should appear in your browser toolbar

### From Source (Development)

For development without building, see [BUILD.md](BUILD.md) for manual installation instructions

### Adding Icons (Optional)

The extension requires icon files in the `icons/` directory. You can add your own PNG icons:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

Or create simple placeholder icons using an image editor.

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

4. **Effects & Buffs Management**:
   - View active effects and conditions in the Effects panel
   - Apply temporary buffs and debuffs that modify rolls automatically
   - Effects persist across character switching for seamless gameplay

5. **Advanced Features**:
   - Track HP, spell slots, and resources in real-time
   - Manage concentration, death saves, and temporary HP
   - Apply conditions and buffs to your character
   - Switch between multiple character profiles with preserved state

**Note**: The character sheet overlay appears on Roll20, not on DiceCloud. You roll using your imported character data.

### GM Panel Features

For Game Masters, the extension provides powerful combat management:

1. **Open GM Panel**:
   - Click the "🎮 GM Panel" button on Roll20
   - Requires GM permissions in the Roll20 game

2. **Combat Tracking**:
   - Automatic turn detection from Roll20's turn tracker
   - Action economy tracking for each combatant
   - Visual indicators for current turn's available actions

3. **Party Management**:
   - View all party members' HP, AC, and conditions
   - Track hidden rolls and reveal them dramatically
   - Export turn history for session records

4. **Advanced GM Tools**:
   - Support for delayed actions and readied actions
   - Combat log with searchable history
   - Player status overview for quick reference

## How It Works

### Character Data Import

1. **Authentication** (`background.js`):
   - Handles login to DiceCloud API (`POST /api/login`)
   - Stores API bearer token securely in Chrome storage
   - Manages token expiration and refresh

2. **Data Extraction** (`dicecloud.js`):
   - Extracts character ID from URL
   - Makes API call to `GET /api/creature/:id` with bearer token
   - Parses response using DiceCloud's standardized variable names
   - Extracts data from `creatureVariables` (calculated stats) and `creatureProperties` (features, spells, etc.)
   - No DOM scraping - all data comes from official API

3. **Data Import** (`roll20.js`):
   - Receives structured character data
   - Populates Roll20 character sheet fields
   - Maps DiceCloud properties to Roll20 equivalents

### Interactive Character Sheet & Dice Rolling

1. **Character Sheet Overlay** (`character-sheet-overlay.js`):
   - Creates interactive popup window displaying all character data
   - Renders abilities, skills, saves, spells, and resources as clickable cards
   - Handles user clicks and generates dice roll commands
   - Manages roll settings (advantage/disadvantage, modifiers)

2. **Message Passing** (`background.js`):
   - Coordinates communication between overlay and Roll20
   - Manages character data storage and synchronization
   - Handles multi-character profile switching

3. **Roll Posting** (`roll20.js`):
   - Receives roll commands from the character sheet overlay
   - Formats rolls using Roll20's native dice notation (`/roll 1d20+5`)
   - Posts rolls to Roll20 chat using the chat input interface
   - Monitors roll results for natural 1s/20s (for racial trait features)

### Communication Architecture

```
DiceCloud API                Background Script              Roll20 Tab
     │                              │                             │
     ├─► Character Data             │                             │
     ├─────────────────────────────►│                             │
     │   (API Request)              │                             │
     │                              ├─► Store Character Data      │
     │                              │   (Chrome Storage)          │
     │                              │                             │
     │                              ├────────────────────────────►│
     │                              │  Send Character Data       │
     │                              │                             ├─► Show Overlay
     │                              │                             ├─► User Clicks Ability
     │                              │                             ├─► Generate Roll Command
     │                              │                             ├─► Post to Chat
     │                              │                             └─► Monitor Result
```

### Popup Interface
- Login form for DiceCloud authentication
- User-friendly control panel
- Shows current character data status
- Manual extract/import controls

## Project Structure

```
rollCloud/
├── manifest.json              # Chrome manifest (Manifest V3) - default
├── manifest-firefox.json      # Firefox manifest (Manifest V2)
├── build.js                   # Automated build script
├── package.json               # npm scripts and metadata
├── src/
│   ├── background.js          # Service worker for data handling & message passing
│   ├── common/
│   │   └── browser-polyfill.js # Cross-browser API compatibility layer
│   ├── content/
│   │   ├── dicecloud.js       # DiceCloud data extraction & roll detection
│   │   ├── roll20.js          # Roll20 data import & roll posting
│   │   ├── character-sheet-overlay.js # Character sheet overlay UI
│   │   └── dice-fix.js        # DiceCloud dice rendering fixes
│   └── popup/
│       ├── popup.html         # Popup UI
│       ├── popup.css          # Popup styles
│       └── popup.js           # Popup logic
├── icons/                     # Extension icons
├── dist/                      # Build output (generated by build.js)
│   ├── chrome/                # Chrome build
│   ├── firefox/               # Firefox build
│   ├── rollcloud-chrome.zip   # Chrome package
│   └── rollcloud-firefox.zip  # Firefox package
├── README.md                  # This file
├── BUILD.md                   # Build instructions
└── DEBUGGING_ROLLS.md         # Roll detection debugging guide
```

## Development

### Prerequisites

- Node.js (for build script)
- Chrome/Edge and/or Firefox
- Basic understanding of JavaScript and browser extensions

### Building for Development

```bash
# Build packages for both browsers
npm run build

# Output will be in dist/chrome/ and dist/firefox/
```

### Modifying the Extension

1. Make your changes to the source files
2. Rebuild: `npm run build`
3. In your browser:
   - **Chrome**: Go to `chrome://extensions/`, click refresh icon
   - **Firefox**: Go to `about:debugging`, reload the extension
4. Test your changes on Dice Cloud and Roll20

### Quick Development (Without Build)

For rapid development without rebuilding:
- **Chrome**: Load the root directory directly (uses `manifest.json`)
- **Firefox**: See [BUILD.md](BUILD.md) for manual manifest swap instructions

### Debugging

- **Content Scripts**: Use the browser's DevTools console on Dice Cloud/Roll20 pages
- **Background Script**: Click "Service Worker" link in the extension details
- **Popup**: Right-click the extension popup → "Inspect"

## Compatibility

- **Browsers**:
  - Chrome, Edge, Brave, and other Chromium-based browsers (Manifest V3)
  - Firefox 109+ (Manifest V2)
  - Cross-browser support via unified API polyfill
- **Dice Cloud**: Works with the current Dice Cloud interface
- **Roll20**: Compatible with standard Roll20 character sheets

## DiceCloud API Integration

This extension follows best practices recommended by DiceCloud developers:

### Standardized Variable Names
Instead of DOM scraping, the extension uses DiceCloud's standardized variable names:
- **Abilities**: `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`
- **Ability Mods**: `strengthMod`, `dexterityMod`, etc.
- **Saves**: `strengthSave`, `dexteritySave`, etc.
- **Skills**: All 18 standard D&D skills (`acrobatics`, `athletics`, `perception`, etc.)
- **Combat**: `armorClass`, `hitPoints`, `speed`, `initiative`, `proficiencyBonus`

### Property Types
The extension parses DiceCloud's property types:
- `class` / `classLevel` - Character classes and levels
- `race` - Character race
- `background` - Character background
- `feature` - Class features, racial traits, feats
- `spell` - Spell list with all details
- `item` / `equipment` - Inventory items
- `proficiency` - Weapon, armor, tool, and language proficiencies

This approach ensures compatibility with DiceCloud's data model and future updates.

## Troubleshooting

### Character Sheet Overlay Issues

If the character sheet overlay isn't working properly:

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

3. **Character Data Not Loading**:
   - Click "🔄 Sync Data" button in the overlay header
   - Re-import character data from DiceCloud
   - Check extension popup to verify data is stored
   - Clear browser cache and re-import if needed

4. **Popup Blocked**:
   - Allow popups for Roll20 in your browser settings
   - Check for popup blocker notifications in the address bar
   - Try using the inline overlay instead of popup mode

### Lucky Feat Issues

1. **Lucky Button Not Visible**:
   - Ensure your character has the Lucky feat in DiceCloud
   - Check that Lucky points are available (not exhausted)
   - Re-import character data to update feat information

2. **Lucky Points Not Tracking**:
   - Refresh the character sheet overlay
   - Check the Resources section for Lucky point count
   - Verify Lucky resources are properly configured in DiceCloud

3. **Lucky Roll Not Working**:
   - Ensure you're connected to Roll20 chat
   - Check that character name is properly set
   - Try a regular roll first to test connectivity

### GM Panel Issues

1. **GM Panel Not Accessible**:
   - Verify you have GM permissions in the Roll20 game
   - Check that you're the game's creator or have been promoted
   - Refresh the Roll20 page and try again

2. **Turn Detection Not Working**:
   - Ensure Roll20's turn tracker is enabled
   - Check that combatants are properly added to the tracker
   - Try manually advancing the turn to trigger detection

3. **Action Economy Not Updating**:
   - Verify the current turn is detected correctly
   - Check that character names match between Roll20 and imported data
   - Refresh the GM panel to sync current state

### Character Import Issues

- **"Not logged in to DiceCloud"**: Click extension icon and login again
- **"API token expired"**: Your session expired; login again via the popup
- **"Not on a character page"**: Navigate to a DiceCloud character sheet
- **Fields not populating in Roll20**: Try Shift+Click for field debug mode

### Roll20 Chat Issues

- **Rolls not appearing**: Ensure Roll20 tab is open and chat is visible
- **Wrong character speaking**: Re-import character data to update name
- **Template errors**: Using a custom Roll20 sheet? May need template customization

## Known Limitations

### Character Import
- Roll20's character sheet structure varies by game system; the extension targets the default D&D 5E sheet
- Complex character features may not map perfectly between systems
- Some custom Dice Cloud fields may not have Roll20 equivalents
- API token may expire; simply login again if you receive authentication errors

### Character Sheet Overlay & Dice Rolling
- Overlay displays on Roll20; character data must be imported first
- Requires Roll20 tab to be open and active for rolls to post
- Some advanced features (racial traits, class features) may need manual configuration
- Roll results are generated by Roll20's dice engine, not pre-calculated

## Future Enhancements

### High Priority - Mechanics & Character Features

#### Class Features
- [ ] **Divine Smite** - Quick-add smite damage to melee attacks
- [ ] **Bardic Inspiration** - Quick-use inspiration dice with tracking
- [ ] **Warlock Pact Magic** - Automatic slot recovery and usage tracking

#### Combat Mechanics
- [ ] **Reaction Prompts** - Notify when Shield, Counterspell, or opportunity attacks apply
- [ ] **Concentration Save Prompts** - Auto-prompt for concentration saves when taking damage
- [ ] **Opportunity Attack Tracker** - Automatic OA detection and usage logging

#### Resource Management
- [ ] **Ammunition Tracker** - Track arrows, bolts with auto-decrement on attacks
- [ ] **Consumable Manager** - Quick-use buttons for potions, scrolls, etc.
- [ ] **Attunement Tracker** - Track attuned magic items (3-item limit)
- [ ] **Hit Dice Management** - Short rest HD tracking and usage

### Spell Mechanics
- [ ] **Spell Preparation Manager** - Track prepared vs. known spells

### Additional Mechanics & Features
- [ ] **Initiative Auto-Roller** - Roll initiative for all party members at once
- [ ] **Two-Weapon Fighting** - Quick off-hand attack button
- [ ] **Great Weapon Master/Sharpshooter** - Toggle -5/+10 for attacks

### Quality of Life
- [ ] **Custom Roll Formatting** - Different Roll20 template support and custom formats
- [ ] **Import/Export Settings** - Backup and restore extension configuration
- [ ] **Hotkey System** - Keyboard shortcuts for common rolls and actions

### Analytics & Tracking
- [ ] **Extended Analytics** - Success rates by roll type, damage-per-round calculations
- [ ] **Dice Fairness Checker** - Chi-square test for d20 fairness
- [ ] **Session Statistics** - Per-session roll tracking with session boundaries
- [ ] **Personal Best Tracker** - Highlight highest damage, longest streak, etc.

### Advanced Features
- [ ] **Party HP Overview** - See all party members' HP in one view
- [ ] **Character Comparison** - Side-by-side stats for multiple characters
- [ ] **Campaign Journal** - Track session summaries and key moments
- [ ] **Quest Tracker** - Track active quests and objectives

### Under Consideration
- [ ] Support for different Roll20 character sheet templates (Pathfinder, etc.)
- [ ] Custom field mapping for non-standard sheets
- [ ] Foundry VTT support (open-source VTT alternative)
- [ ] Mobile-friendly overlay for tablet use

### Visual/Polish (Low Priority)
- [ ] Dice sound effects and animations
- [ ] Critical hit celebration effects
- [ ] Custom themes and color schemes
- [ ] Damage type color-coding
- [ ] Character portrait display
- [ ] HP bar visualizations

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - Feel free to use and modify as needed.

## Acknowledgments

- [Dice Cloud](https://github.com/ThaumRystra/DiceCloud) by ThaumRystra
- [DiceCloud REST API Documentation](https://dicecloud.com/api)
- [Roll20](https://roll20.net) virtual tabletop platform
- [Beyond20](https://github.com/kakaroto/Beyond20) by kakaroto - inspiration for roll forwarding architecture
- Thanks to the DiceCloud developer for recommending API integration with standardized variable names

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify you're on the correct Dice Cloud/Roll20 pages
3. Try clearing the extension data and re-extracting
4. Open an issue on GitHub with details about your problem

---

## 📋 Version History

### v1.1.2 - Enhanced Authentication & Auto-Connect
- 🔐 **Auto-Connect Feature** - One-click authentication using existing DiceCloud session
- 🎟️ **Token Management** - Proper token expiry handling per DiceCloud API documentation
- 🔄 **Simplified Login Flow** - Automatic session detection, no manual token entry required
- ✨ **Complete Character Sheet Overhaul** - Fully redesigned character sheet interface
- 🍀 **Lucky Feat Integration** - Complete Lucky feat implementation with modal interface
- 🎮 **Enhanced GM Panel** - Hidden rolls, player overview, turn history
- 🔮 **Effects System** - Buffs, debuffs, and condition management
- 💾 **Character State Preservation** - Cache system for seamless character switching
- 🎯 **Improved Combat Tracking** - Enhanced action economy and turn detection
- 🎨 **UI/UX Improvements** - Better layout, responsive design, enhanced interactions
- 🐛 **Bug Fixes** - Various stability and performance improvements

### v1.1.2.1 - Experimental Two-Way Sync
- 🧪 **Two-Way Synchronization** - Changes in Roll20 automatically update DiceCloud
- 🔄 **Real-Time Sync** - Hit points, resources, conditions, and action usage tracked
- 🛠️ **Meteor DDP Integration** - Uses DiceCloud's real-time communication protocol
- ⚠️ **Experimental Features** - Cutting-edge features for testing and feedback
- 📊 **Enhanced Data Flow** - Bidirectional sync between platforms
- 🔧 **Conflict Resolution** - Intelligent handling of simultaneous changes
- 📱 **Offline Support** - Queues changes when connection is lost
- 🚨 **Warning System** - Clear indicators for experimental build status

### v0.9.x - Character Sheet Era
- ✨ **Interactive Character Sheet Overlay** - Click-to-roll functionality
- 🎲 **Advanced Dice Rolling** - Advantage/disadvantage, custom modifiers
- 📊 **Real-time Resource Tracking** - HP, spell slots, conditions
- 🔧 **Enhanced UI/UX** - Improved popup and overlay interfaces

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

**Areas for contribution:**
- Bug reports and feature requests
- Code improvements and optimizations
- Documentation enhancements
- Translation support for international users

---

## 📄 License

MIT License - Feel free to use and modify as needed.

---

## 🙏 Acknowledgments

- [Dice Cloud](https://github.com/ThaumRystra/DiceCloud) by ThaumRystra
- [DiceCloud REST API Documentation](https://dicecloud.com/api)
- [Roll20](https://roll20.net) virtual tabletop platform
- [Beyond20](https://github.com/kakaroto/Beyond20) by kakaroto - inspiration for roll forwarding architecture
- Thanks to the DiceCloud developer for recommending API integration with standardized variable names
- The amazing D&D community for feedback and feature suggestions

---

## 🆘 Support

If you encounter any issues:
1. Check the browser console for error messages (`F12`)
2. Verify you're on the correct Dice Cloud/Roll20 pages
3. Try clearing the extension data and re-extracting
4. Check this README's troubleshooting section
5. Open an issue on GitHub with details about your problem

---

Made with ❤️ for the D&D community
