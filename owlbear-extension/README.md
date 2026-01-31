# OwlCloud Owlbear Rodeo Extension

This is the Owlbear Rodeo extension component of OwlCloud, which integrates DiceCloud V2 characters into Owlbear Rodeo.

## Architecture

OwlCloud uses a **two-part architecture** to integrate DiceCloud with Owlbear Rodeo:

### 1. Browser Extension (in `src/` directory)
- Syncs character data from DiceCloud
- Provides popup UI for character management
- Injects content script into Owlbear Rodeo pages
- Handles Discord integration

### 2. Owlbear Extension (this directory)
- Runs inside Owlbear Rodeo as a native extension
- Uses the Owlbear SDK to interact with the scene
- Displays character information in Owlbear UI
- Communicates with browser extension via `window.postMessage`

## Files

- `manifest.json` - Owlbear extension manifest
- `popover.html` - UI displayed when clicking the extension button in Owlbear
- `popover.js` - JavaScript logic for the popover
- `icon.svg` - Extension icon

## Installation

### 1. Install Browser Extension
First, install the OwlCloud browser extension in Chrome/Firefox/Edge/Safari.

### 2. Install Owlbear Extension
1. Open Owlbear Rodeo ([owlbear.rodeo](https://www.owlbear.rodeo))
2. Click the Extensions menu
3. Click "Install Extension"
4. Upload this `owlbear-extension` folder (or provide URL if hosted)
5. The OwlCloud button will appear in your Owlbear extensions bar

### 3. Connect the Two
1. Open the OwlCloud browser extension popup
2. Select your active character from DiceCloud
3. Navigate to Owlbear Rodeo
4. Click the OwlCloud extension button in Owlbear
5. Your character will be displayed!

## Features

- **Character Display**: View your DiceCloud character info in Owlbear
- **Character Sheet**: Open full character sheet overlay (uses browser extension modules)
- **Sync**: Refresh character data from DiceCloud
- **Dice Rolling**: Roll dice and display results in Owlbear (coming soon)
- **Scene Integration**: Create tokens and items based on character (coming soon)

## Communication Flow

```
DiceCloud
    ↓ (sync)
Browser Extension
    ↓ (content script on owlbear.rodeo)
Owlbear Rodeo Page
    ↔ (window.postMessage)
Owlbear Extension
    ↓ (Owlbear SDK)
Owlbear Scene/UI
```

## Development

To develop this extension:

1. Make changes to the files in this directory
2. Reload the extension in Owlbear Rodeo (Extensions menu → Reload)
3. Test communication with browser extension

## Permissions

This extension requires the following Owlbear permissions:
- `scene.items` - To create tokens and items for your character
- `scene.grid` - To properly position character tokens
- `player` - To get current player information
- `room` - To access room metadata
- `notification` - To show roll results and status messages

## Future Enhancements

- [ ] Character token creation with proper stats
- [ ] HP tracking that syncs to DiceCloud
- [ ] Initiative tracking integration
- [ ] Roll display using Owlbear's chat/notification system
- [ ] Spell effect visualization on the scene
- [ ] Condition/effect markers on tokens

## Support

For issues or questions, please visit the main OwlCloud repository.
