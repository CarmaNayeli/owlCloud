# Dice Cloud to Roll20 Importer

A browser extension that seamlessly imports your D&D character data from Dice Cloud into Roll20 using the official DiceCloud REST API.

## Features

- **API-Powered**: Uses DiceCloud's official REST API for reliable, standardized data extraction
- **Smart Parsing**: Leverages DiceCloud's standardized variable names (strength, dexterity, etc.)
- **Secure Authentication**: Login with your DiceCloud credentials (stored locally in browser)
- **One-Click Export**: Extract character data from Dice Cloud with a single click
- **Easy Import**: Import character data directly into Roll20 character sheets
- **Data Persistence**: Character data is stored locally between Dice Cloud and Roll20 sessions
- **User-Friendly Interface**: Clean popup UI and floating action buttons on both platforms
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

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/YourUsername/rollCloud.git
   cd rollCloud
   ```

2. Open your browser's extension management page:
   - **Chrome/Edge**: Navigate to `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode" using the toggle in the top right

3. Click "Load unpacked" and select the `rollCloud` directory

4. The extension icon should appear in your browser toolbar

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

2. **On Roll20**
   - A floating "Import from Dice Cloud" button appears in the bottom-right corner
   - Click it to import your character data

## How It Works

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

4. **Background Service Worker** (`background.js`):
   - Handles API authentication and token management
   - Stores character data using Chrome's storage API
   - Facilitates communication between content scripts

5. **Popup Interface**:
   - Login form for DiceCloud authentication
   - User-friendly control panel
   - Shows current character data status
   - Manual extract/import controls

## Project Structure

```
rollCloud/
├── manifest.json           # Extension configuration
├── src/
│   ├── background.js      # Service worker for data handling
│   ├── content/
│   │   ├── dicecloud.js   # Dice Cloud data extraction
│   │   └── roll20.js      # Roll20 data import
│   └── popup/
│       ├── popup.html     # Popup UI
│       ├── popup.css      # Popup styles
│       └── popup.js       # Popup logic
├── icons/                 # Extension icons (add your own)
└── README.md             # This file
```

## Development

### Prerequisites

- A Chromium-based browser (Chrome, Edge, Brave, etc.)
- Basic understanding of JavaScript and browser extensions

### Modifying the Extension

1. Make your changes to the source files
2. Go to `chrome://extensions/` or `edge://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes on Dice Cloud and Roll20

### Debugging

- **Content Scripts**: Use the browser's DevTools console on Dice Cloud/Roll20 pages
- **Background Script**: Click "Service Worker" link in the extension details
- **Popup**: Right-click the extension popup → "Inspect"

## Compatibility

- **Browsers**: Chrome, Edge, Brave, and other Chromium-based browsers (Manifest V3)
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

## Known Limitations

- Roll20's character sheet structure varies by game system; the extension targets the default D&D 5E sheet
- Complex character features may not map perfectly between systems
- Some custom Dice Cloud fields may not have Roll20 equivalents
- API token may expire; simply login again if you receive authentication errors

## Future Enhancements

- [ ] Firefox support (Manifest V2 compatibility)
- [ ] Support for different Roll20 character sheet templates
- [ ] Bi-directional sync (Roll20 → Dice Cloud)
- [ ] Multiple character profiles
- [ ] Custom field mapping
- [ ] Import/export character data as JSON

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - Feel free to use and modify as needed.

## Acknowledgments

- [Dice Cloud](https://github.com/ThaumRystra/DiceCloud) by ThaumRystra
- [DiceCloud REST API Documentation](https://dicecloud.com/api)
- [Roll20](https://roll20.net) virtual tabletop platform
- Thanks to the DiceCloud developer for recommending API integration with standardized variable names

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify you're on the correct Dice Cloud/Roll20 pages
3. Try clearing the extension data and re-extracting
4. Open an issue on GitHub with details about your problem

---

Made with ❤️ for the D&D community
