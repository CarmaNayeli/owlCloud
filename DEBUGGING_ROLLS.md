# Roll Detection Debugging (DEPRECATED)

**Note:** This document is deprecated as of the current version of RollCloud.

## Architecture Change

RollCloud no longer detects and forwards rolls from DiceCloud to Roll20. Instead:

1. **Character data is imported** from DiceCloud using the REST API
2. **An interactive character sheet overlay** displays on Roll20 with your character data
3. **Rolls are generated from the overlay** when you click abilities, skills, saves, etc.
4. **Rolls are posted directly** to Roll20's chat using native Roll20 commands

## Current Roll System

The rolls are now:
- Generated from the character sheet overlay (`src/content/character-sheet-overlay.js`)
- Posted to Roll20 chat directly (`src/content/roll20.js`)
- Based on imported character data, not live DiceCloud rolls

If you experience issues with rolling:
- Check that character data has been imported successfully
- Ensure the character sheet overlay is visible on Roll20
- Verify Roll20 chat is accessible and not minimized
- Check browser console for error messages

## Legacy System

This document previously described how to debug the DiceCloud roll detection system using MutationObserver to watch for rolls on DiceCloud's interface. That system is no longer used.

For current debugging information, see the main README.md troubleshooting section.
