# RollCloud: Dice Cloud Integration for Roll20

A powerful browser extension that seamlessly integrates Dice Cloud with Roll20. Import your D&D character data using the official DiceCloud REST API, forward dice rolls in real-time, track roll statistics, and enhance your tabletop gaming experience with advanced features like advantage/disadvantage controls and animated roll notifications.

**Quick Download:** [Firefox](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox.zip) | [Chrome](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.zip) | [Safari](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-safari.zip)

## Features

### Character Import
- **API-Powered**: Uses DiceCloud's official REST API for reliable, standardized data extraction
- **Smart Parsing**: Leverages DiceCloud's standardized variable names (strength, dexterity, etc.)
- **Secure Authentication**: Login with your DiceCloud credentials (stored locally in browser)
- **One-Click Export**: Extract character data from Dice Cloud with a single click
- **Easy Import**: Import character data directly into Roll20 character sheets
- **Data Persistence**: Character data is stored locally between Dice Cloud and Roll20 sessions

### Interactive Character Sheet & Dice Rolling (NEW!)
- **Character Sheet Overlay**: Beautiful interactive overlay displays your DiceCloud character data on Roll20
- **Click-to-Roll**: Click any ability, skill, or save in the overlay to instantly roll dice
- **Direct Roll20 Integration**: Rolls are posted directly to Roll20's chat using native roll commands
- **Advanced Roll Options**: Support for advantage/disadvantage, custom modifiers, and roll settings
- **Character Attribution**: Rolls automatically appear under your character's name in Roll20

### GM Combat Management (NEW!)
- **GM Initiative Tracker**: Full combat management system with automatic turn detection
- **Action Economy Tracking**: Automatic action/bonus action/reaction usage tracking per turn
- **Turn-Based Visual Indicators**: Action economy lights up for current character, greys out for others
- **Chat History Integration**: Checks recent chat messages when switching tabs or opening sheets
- **D&D 5e Rules Compliance**: Enforces one reaction per round, proper action tracking
- **Real-Time Turn Notifications**: Automatic turn detection and action economy activation

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

## Installation

### Download Pre-Built Extension (Easiest)

Download the pre-built extension for your browser:

#### 🦊 Firefox
[Download RollCloud for Firefox](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox.zip)

1. Download the Firefox version
2. Extract the ZIP file
3. Navigate to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select any file from the extracted folder

#### 🌐 Chrome / Edge / Brave
[Download RollCloud for Chrome](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-chrome.zip)

1. Download the Chrome version
2. Extract the ZIP file
3. Navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
4. Enable "Developer mode" toggle in the top-right
5. Click "Load unpacked" and select the extracted folder

#### 🧭 Safari
[Download RollCloud for Safari](https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-safari.zip)

**Prerequisites:**
- macOS with Safari 14.0 or later
- Xcode (download from Mac App Store)

**Installation Steps:**

1. Download and extract the Safari version
2. Open Terminal and navigate to the extracted folder
3. Convert to Safari App Extension:
   ```bash
   xcrun safari-web-extension-converter . --app-name RollCloud
   ```
4. Follow the prompts to create an Xcode project
5. Open the generated Xcode project
6. Build and run the project (⌘R)
7. Enable the extension in Safari preferences

For detailed instructions, troubleshooting, and distribution info, see [SAFARI.md](SAFARI.md)

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
   npm run build
   ```

3. Install in your browser:
   - **Chrome/Edge**:
     - Navigate to `chrome://extensions/` or `edge://extensions/`
     - Enable "Developer mode"
     - Click "Load unpacked" and select `dist/chrome/`

   - **Firefox**:
     - Navigate to `about:debugging#/runtime/this-firefox`
     - Click "Load Temporary Add-on"
     - Select any file in `dist/firefox/`

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

3. **Advanced Features**:
   - Track HP, spell slots, and resources in real-time
   - Manage concentration, death saves, and temporary HP
   - Apply conditions and buffs to your character
   - Switch between multiple character profiles

**Note**: The character sheet overlay appears on Roll20, not on DiceCloud. You roll using your imported character data.

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

#### Racial Traits (✅ All Implemented!)
- [x] **Halfling Luck** - Reroll 1s on d20 rolls (attack, ability check, save)
- [x] **Elven Accuracy** - Roll 3d20 on advantage when using DEX/INT/WIS/CHA
- [x] **Lucky Feat** - Reroll d20 rolls up to 3 times per long rest with tracking
- [x] **Dwarven Resilience** - Advantage on poison saves (auto-apply)
- [x] **Gnome Cunning** - Advantage on INT/WIS/CHA saves vs magic (auto-apply)

#### Class Features (8/9 Implemented)
- [x] **Reliable Talent** (Rogue 11+) - Automatic minimum of 10 on proficient skill checks
- [x] **Bardic Inspiration** - Popup system to add inspiration dice (d6/d8/d10/d12) with resource tracking
- [x] **Portent Dice** (Divination Wizard) - Store and apply portent rolls
- [x] **Wild Magic Surge** - Auto-roll d20 and consult surge table on spell cast
- [ ] **Divine Smite** - Quick-add smite damage to melee attacks
- [x] **Sneak Attack Tracker** - Auto-add sneak attack damage when conditions met
- [x] **Rage Damage Bonus** - Auto-apply rage damage to attacks
- [x] **Brutal Critical** (Barbarian) - Auto-add extra dice on crits
- [x] **Jack of All Trades** (Bard) - Auto-add half proficiency to non-proficient checks

#### Combat Mechanics
- [ ] **Reaction Prompts** - Notify when Shield, Counterspell, or opportunity attacks apply
- [ ] **Concentration Save Prompts** - Auto-prompt for concentration saves when taking damage

#### Resource Management
- [ ] **Ammunition Tracker** - Track arrows, bolts with auto-decrement on attacks
- [ ] **Consumable Manager** - Quick-use buttons for potions, scrolls, etc.
- [ ] **Attunement Tracker** - Track attuned magic items (3-item limit)

### Spell Mechanics
- [ ] **Spell Preparation Manager** - Track prepared vs. known spells

### Additional Mechanics & Features
- [ ] **Initiative Auto-Roller** - Roll initiative for all party members at once
- [ ] **Custom Roll Macros** - Create and save frequently-used custom rolls
- [ ] **Guidance/Bless Tracker** - Auto-add d4/d8 to rolls when active
- [ ] **Two-Weapon Fighting** - Quick off-hand attack button
- [ ] **Great Weapon Master/Sharpshooter** - Toggle -5/+10 for attacks

### Quality of Life
- [ ] **Overlay Resize/Collapse** - Minimize sections or entire overlay for space
- [ ] **Custom Roll Formatting** - Different Roll20 template support and custom formats
- [ ] **Import/Export Settings** - Backup and restore extension configuration
- [ ] **Hotkey System** - Keyboard shortcuts for common rolls and actions

### Analytics & Tracking
- [ ] **Extended Analytics** - Success rates by roll type, damage-per-round calculations
- [ ] **Dice Fairness Checker** - Chi-square test for d20 fairness
- [ ] **Session Statistics** - Per-session roll tracking with session boundaries
- [ ] **Personal Best Tracker** - Highlight highest damage, longest streak, etc.

### Advanced Features
- [ ] **Bi-directional Sync** - Update Dice Cloud from Roll20 HP/resource changes
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

Made with ❤️ for the D&D community
