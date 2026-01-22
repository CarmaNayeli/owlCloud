# Release Notes: RollCloud v1.1.0

## 🎨 Complete Sheet Update

### Major Features Added:
- **Complete Character Sheet Overhaul**: Fully redesigned character sheet interface with improved layout and responsiveness
- **Lucky Feat**: Manual action button with modal interface for offensive/defensive usage
- **Character State Preservation**: Cache system prevents resource refreshing when switching characters
- **Resource Management**: Lucky points tracking without duplication (filtered from resources display)
- **Roll20 Integration**: Lucky rolls sent to chat with proper formatting
- **Dynamic UI Updates**: Real-time Lucky point count updates
- **Enhanced UI/UX**: Better layout, responsive design, enhanced interactions

### Technical Improvements:
- **Character Cache**: `characterCache` Map preserves session state
- **Smart Loading**: Cache first, storage fallback for character data
- **Resource Filtering**: Lucky resources hidden from resources section
- **State Persistence**: Deep copy caching prevents reference issues
- **Enhanced Debug Logging**: Comprehensive tracking of all operations

### GM Panel Enhancements:
- **Hidden Rolls**: GM Mode hides rolls until revealed
- **Player Overview**: Track party member HP, AC, conditions
- **Turn History**: Log combat actions with export functionality
- **Delayed Actions**: Support for delayed combatant turns

### Effects System:
- **Buffs & Debuffs**: Complete system for managing active effects
- **Auto-Apply**: Automatic modifiers for rolls based on active effects
- **Visual Indicators**: Clear display of active conditions and buffs

### Installation:
- Download the appropriate browser package below
- Extract and install according to browser instructions
- All features are ready to use immediately

## 📦 Downloads

Choose your browser:
- **Firefox**: rollcloud-firefox.zip
- **Chrome/Edge**: rollcloud-chrome.zip  
- **Safari**: rollcloud-safari.zip

## 🎮 Quick Start

1. Install the extension for your browser
2. Login to DiceCloud through the extension popup
3. Extract character data from DiceCloud
4. Import to Roll20 and start rolling!

All Lucky feat functionality and character state preservation are built-in and ready to use! 🎲✨
