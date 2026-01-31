# Two-Way Sync Experimental Feature

## Overview

This experimental feature attempts to implement two-way synchronization between OwlCloud and DiceCloud, allowing rolls made in the extension to update tracking values (uses, resources, HP) on the DiceCloud character sheet.

## Technical Approach

Since DiceCloud's official API is read-only, this implementation uses Meteor's DDP (Distributed Data Protocol) to communicate directly with DiceCloud's backend.

### DiceCloud API Limitations

The official DiceCloud API only provides:
- `POST /api/login` - Authentication
- `GET /api/creature/:id` - Read character data
- `GET /api/status` - Health check

**No write endpoints exist** for updating character properties.

### Meteor DDP Approach

DiceCloud is built on Meteor, which uses DDP over WebSocket for real-time data synchronization. This experimental version:

1. Establishes a WebSocket connection to DiceCloud
2. Authenticates using the user's token
3. Calls Meteor methods to update character properties
4. Updates uses, resources, HP, and other tracking values

## Status

⚠️ **EXPERIMENTAL** - This approach:
- Relies on reverse-engineering DiceCloud's internal Meteor methods
- May break if DiceCloud updates their backend
- Is not officially supported by DiceCloud
- Requires WebSocket connection management

## Files

- `meteor-ddp-client.js` - DDP protocol implementation
- `dicecloud-sync.js` - DiceCloud-specific sync methods
- `popup-sheet-sync.js` - Modified popup with sync capabilities
- `background-sync.js` - Background script with WebSocket support

## Testing

To test this experimental feature:
1. Copy files to main `src/` directory
2. Reload extension
3. Try rolling actions with uses/resources
4. Check DiceCloud character sheet for updates

## Rollback

To revert to stable version:
1. Restore original files from main `src/` directory
2. Reload extension
