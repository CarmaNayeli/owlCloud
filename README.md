# Dice Cloud to Roll20 Importer

A browser extension that seamlessly imports your D&D character data from Dice Cloud into Roll20.

## Features

- **One-Click Export**: Extract character data from Dice Cloud with a single click
- **Easy Import**: Import character data directly into Roll20 character sheets
- **Data Persistence**: Character data is stored locally between Dice Cloud and Roll20 sessions
- **User-Friendly Interface**: Clean popup UI and floating action buttons on both platforms
- **Cross-Platform**: Works on Chrome, Edge, and other Chromium-based browsers

## What Gets Imported

The extension currently imports the following character data:

- Character Name
- Race
- Class & Level
- Ability Scores (STR, DEX, CON, INT, WIS, CHA)
- Hit Points (Current & Max)
- Armor Class
- Speed
- Initiative Bonus
- Proficiency Bonus
- Skills
- Features & Traits
- Spells
- Inventory
- Proficiencies

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

### Method 1: Using the Extension Popup

1. **Navigate to Dice Cloud**
   - Open your character sheet on [Dice Cloud](https://dicecloud.com)
   - Click the extension icon in your browser toolbar
   - Click "Extract from Dice Cloud"
   - Wait for the success message

2. **Navigate to Roll20**
   - Open your character sheet on [Roll20](https://app.roll20.net)
   - Click the extension icon in your browser toolbar
   - Click "Import to Roll20"
   - Your character data will be imported!

### Method 2: Using Floating Buttons

1. **On Dice Cloud**
   - A floating "Export to Roll20" button appears in the bottom-right corner
   - Click it to extract your character data

2. **On Roll20**
   - A floating "Import from Dice Cloud" button appears in the bottom-right corner
   - Click it to import your character data

## How It Works

1. **Content Scripts**:
   - `dicecloud.js` runs on Dice Cloud pages and extracts character data from the DOM
   - `roll20.js` runs on Roll20 pages and populates character sheet fields

2. **Background Service Worker**:
   - `background.js` handles data storage using Chrome's storage API
   - Facilitates communication between content scripts

3. **Popup Interface**:
   - Provides a user-friendly control panel
   - Shows current character data status
   - Offers manual extract/import controls

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

## Known Limitations

- Roll20's character sheet structure varies by game system; the extension targets the default D&D 5E sheet
- Complex character features may not map perfectly between systems
- Some custom Dice Cloud fields may not have Roll20 equivalents

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
- [Roll20](https://roll20.net) virtual tabletop platform

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify you're on the correct Dice Cloud/Roll20 pages
3. Try clearing the extension data and re-extracting
4. Open an issue on GitHub with details about your problem

---

Made with ❤️ for the D&D community
