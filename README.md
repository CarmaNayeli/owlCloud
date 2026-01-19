# RollCloud: Dice Cloud Integration for Roll20

A powerful browser extension that seamlessly integrates Dice Cloud with Roll20. Import your D&D character data using the official DiceCloud REST API, forward dice rolls in real-time, track roll statistics, and enhance your tabletop gaming experience with advanced features like advantage/disadvantage controls and animated roll notifications.

## Features

### Character Import
- **API-Powered**: Uses DiceCloud's official REST API for reliable, standardized data extraction
- **Smart Parsing**: Leverages DiceCloud's standardized variable names (strength, dexterity, etc.)
- **Secure Authentication**: Login with your DiceCloud credentials (stored locally in browser)
- **One-Click Export**: Extract character data from Dice Cloud with a single click
- **Easy Import**: Import character data directly into Roll20 character sheets
- **Data Persistence**: Character data is stored locally between Dice Cloud and Roll20 sessions

### Dice Roll Integration (NEW!)
- **Real-Time Roll Forwarding**: Automatically sends dice rolls from DiceCloud to Roll20's chat
- **Beyond20-Style Integration**: Works like D&D Beyond's integration - roll on DiceCloud, see results in Roll20
- **Roll20 Templates**: Uses Roll20's native roll templates for familiar formatting
- **Multi-Tab Support**: Sends rolls to all open Roll20 tabs simultaneously
- **Character Attribution**: Rolls appear under your character's name in Roll20

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

### Quick Install (Recommended)

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

### Dice Roll Forwarding

Once you have both DiceCloud and Roll20 tabs open:

1. **Setup** (one-time):
   - Import your character data to Roll20 (using Method 1 or 2 above)
   - Ensure the character name matches between DiceCloud and Roll20

2. **Rolling Dice**:
   - Make any roll on your DiceCloud character sheet (ability check, attack, spell, etc.)
   - The roll automatically appears in Roll20's chat
   - Rolls use Roll20's native template formatting
   - Your character's name appears as the speaker

3. **Multiple Tables**:
   - Open multiple Roll20 tabs if you're playing in multiple games
   - Rolls are sent to ALL open Roll20 tabs simultaneously

**Note**: Roll detection is currently in beta. If rolls aren't being detected, see the Troubleshooting section below.

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

### Dice Roll Forwarding

1. **Roll Detection** (`dicecloud.js`):
   - Uses MutationObserver to watch DiceCloud's roll log for new rolls
   - Parses roll data (name, formula, result) from DOM elements
   - Sends roll data to background script

2. **Message Passing** (`background.js`):
   - Receives roll data from DiceCloud tab
   - Queries all open Roll20 tabs
   - Forwards roll to each Roll20 tab

3. **Roll Posting** (`roll20.js`):
   - Receives roll data from background script
   - Formats roll using Roll20's template syntax (`&{template:simple}`)
   - Simulates user input to post roll to chat (no API subscription needed!)
   - Sets character as speaker using stored character data

### Communication Architecture

```
DiceCloud Tab                Background Script              Roll20 Tab(s)
     │                              │                             │
     ├─► Detect Roll                │                             │
     ├─► Parse Roll Data            │                             │
     ├─────────────────────────────►│                             │
     │   {name, formula, result}    │                             │
     │                              ├────────────────────────────►│
     │                              │  Forward to all R20 tabs   │
     │                              │                             ├─► Format Roll
     │                              │                             ├─► Post to Chat
     │                              │                             └─► Show Result
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

### Roll Detection Issues

If dice rolls aren't being forwarded from DiceCloud to Roll20:

1. **Use Debug Mode**:
   - On DiceCloud, click the blue **"🔍 Debug Rolls"** button (bottom-right)
   - Or **Shift+Click** the "Export to Roll20" button
   - Open browser console (`F12`) to see debug output

2. **Check Console**:
   - Look for "✓ Observing DiceCloud roll log for new rolls" = Working!
   - Look for "Roll log not found, will retry..." = Selectors need updating

3. **Make a Test Roll**:
   - Roll any dice on DiceCloud
   - Check console for "✓ Detected roll" or "✗ Could not parse roll"
   - The debug output will show what elements were found

4. **Inspect Roll Elements**:
   - Right-click on a roll result in DiceCloud
   - Select "Inspect" to see the HTML structure
   - Compare with what the extension is looking for

5. **Update Selectors** (Advanced):
   - See `DEBUGGING_ROLLS.md` for detailed instructions
   - Update selectors in `src/content/dicecloud.js`
   - Reload extension and test again

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

### Dice Roll Forwarding
- Roll detection depends on DiceCloud's DOM structure, which may change with updates
- Only works with open browser tabs (DiceCloud and Roll20 must both be open)
- Requires character name to match between systems for proper attribution
- May need selector updates if DiceCloud's UI changes

## Future Enhancements

### Planned
- [ ] Improved roll detection (more robust parsing)
- [ ] Support for advantage/disadvantage rolls
- [ ] Critical hit detection and highlighting
- [ ] Roll type detection (attack, skill check, save, etc.)
- [ ] Custom roll formatting options

### Under Consideration
- [x] Firefox support (Manifest V2 compatibility) ✅ **COMPLETED**
- [ ] Support for different Roll20 character sheet templates
- [ ] Bi-directional sync (Roll20 → Dice Cloud)
- [ ] Multiple character profiles
- [ ] Custom field mapping
- [ ] Import/export character data as JSON
- [ ] Roll history and statistics

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
