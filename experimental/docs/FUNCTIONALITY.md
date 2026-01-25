# RollCloud Extension - Complete Functionality Documentation

## 🎲 Overview
RollCloud is a browser extension (Chrome, Firefox, Safari) that seamlessly integrates **Dice Cloud** character sheets with **Roll20** virtual tabletop, providing character data synchronization, an interactive character sheet overlay with click-to-roll functionality, direct Roll20 chat integration, and comprehensive combat management tools.

**Current Version:** 1.1.2

---

## 📋 Core Features

### 1. **Character Data Synchronization**
- **Automatic API Integration**: Fetches character data from Dice Cloud using authenticated API requests
- **Auto-Connect**: Automatically extracts authentication token from logged-in DiceCloud session
- **Comprehensive Data Extraction**:
  - Basic info (name, race, class, level, alignment, background)
  - Ability scores (STR, DEX, CON, INT, WIS, CHA) with calculated modifiers
  - Saving throws with proficiency bonuses
  - All 18 D&D 5e skills with proficiency calculations
  - Combat stats (AC, HP, initiative, speed, proficiency bonus)
  - Spell slots and spells (with descriptions, levels, casting info)
  - Class resources (Ki points, sorcery points, rage uses, etc.)
  - Actions and attacks with damage formulas
  - Racial traits, feats, and class features
  - Companions and familiars
  - Custom variables and additional character data
- **Export Functionality**: Complete character structure export to downloadable JSON file

### 2. **Interactive Character Sheet Overlay**
- **Beautiful UI**: Modern, clean design with hover effects and smooth animations
- **Theme Support**: Light and dark mode with ThemeManager system
- **Popup Window**: Character sheet opens in a separate popup window
- **Multiple Characters**: Tab system for switching between multiple characters
- **Click-to-Roll**: Every stat card is clickable to trigger dice rolls
  - Ability checks (STR, DEX, CON, INT, WIS, CHA)
  - Saving throws (all 6 saves with bonuses)
  - Skills (all 18 D&D 5e skills)
  - Initiative rolls
  - Spell attacks and spell damage
  - Action attacks and damage
- **Real-time Display**: All character data displayed in organized sections
- **Advanced Filtering**: Search and filter actions/spells by type, level, category, casting time

### 3. **Dice Rolling Integration**
- **Overlay-Generated Rolls**: Rolls generated from character sheet overlay using imported character data
- **Roll20 Chat Integration**: Rolls posted directly to Roll20 chat with proper formatting
- **Roll Modes**: Support for normal rolls, advantage, and disadvantage (via effects system)
- **Formula Parsing**: Handles complex dice formulas with variable resolution (e.g., `2d6+5`, `1d20+proficiencyBonus`)
- **Visual Feedback**: Notifications confirm roll submission
- **Roll History**: All rolls visible in Roll20 chat history
- **Roll Communication**: Overlay sends roll commands directly to Roll20 chat input
- **Guidance & Bless**: Automatic +1d4 bonuses for ability checks and attacks/saves

### 4. **Hit Points & Health Management**
- **HP Tracking**: Real-time HP display with current/max values
- **HP Modal**: Click HP to open adjustment modal with three modes:
  - **💚 Heal**: Restore HP (up to max, resets death saves)
  - **💔 Damage**: Deal damage (depletes temp HP first, then current HP)
  - **🛡️ Temp HP**: Set temporary hit points (RAW compliant)
- **Death Saves**: Track successes/failures, clickable UI for manual adjustment
- **Roll20 Announcements**: HP changes announced to Roll20 chat
- **Automatic Reset**: Death saves reset on healing

### 5. **Resource & Spell Slot Management**
- **Spell Slot Tracking**: Real-time spell slot display for all 9 spell levels
- **Auto-Decrement**: Spell slots automatically decrement when spells are cast
- **Manual Adjustment**: Click spell slot badges to increment/decrement manually
- **Resource Tracking**: Ki points, sorcery points, rage uses, channel divinity, etc.
- **Action Uses**: Limited use actions (e.g., "3/3 uses") auto-decrement on use
- **Local Persistence**: All changes saved locally (not synced back to DiceCloud in main build)
- **Rest System**: Short rest and long rest buttons restore resources appropriately

### 6. **GM Combat Management**
- **GM Initiative Tracker**: Combat management system with automatic turn detection
- **Action Economy Tracking**: Visual indicators for action/bonus action/movement/reaction
- **Turn-Based Indicators**: Action economy lights up for current character based on Roll20 turn tracker
- **Chat History Integration**: Reads recent chat messages to detect whose turn it is
- **Turn/Round Reset**: Buttons to reset turn (action/bonus/movement) or round (includes reaction)
- **D&D 5e Rules Compliance**: Enforces one reaction per round, proper action economy
- **Hidden Rolls**: GM Mode toggle to hide rolls until revealed
- **Player Overview**: Track party member HP, AC, and conditions from GM panel
- **Read-Only Mode**: Character sheets opened from GM panel hide modification controls

### 7. **Conditions & Effects System**
- **Buffs & Debuffs**: Full system for managing active effects on character
- **Add Condition**: Button to add conditions with custom modifiers
- **Auto-Apply Modifiers**: Effects automatically modify rolls (e.g., advantage, disadvantage, +2 bonus)
- **Effect Icons**: Visual display of active conditions with emoji icons
- **Remove Effects**: Click X on condition to remove it
- **Effect Persistence**: Active effects maintained across character switching
- **DiceCloud Sync**: Conditions can be synced from DiceCloud properties

### 8. **Concentration Tracking**
- **Concentration Indicator**: Visual display when concentrating on a spell
- **Spell Name Display**: Shows which spell you're concentrating on
- **Drop Concentration**: Button to end concentration and remove effect
- **Auto-Set**: Concentration automatically activated when casting concentration spells

### 9. **Inspiration System**
- **Inspiration Display**: Visual indicator showing if you have inspiration (★ Active / ☆ None)
- **Toggle Inspiration**: Click to spend or gain inspiration
- **Roll20 Announcements**: Inspiration changes announced to chat
- **Usage Reminder**: Notification explains how to use inspiration (advantage on roll)

### 10. **Rest System**
- **Short Rest**: ☕ Restores hit dice, most class resources (Ki, Channel Divinity, Action Surge, etc.)
- **Long Rest**: 🌙 Restores all HP, all spell slots, all hit dice, all resources including long-rest-only (Rage, Sorcery Points)
- **Smart Resource Handling**: Knows which resources restore on short vs long rest
- **Action Uses Reset**: Resets limited use actions appropriately
- **Roll20 Announcements**: Rest completion announced to chat
- **Inspiration Persistence**: Inspiration NOT automatically restored (DM grants it)

### 11. **Hit Dice System**
- **Hit Dice Tracking**: Displays current/max hit dice with die type (e.g., "3/5 d8")
- **Auto-Detection**: Automatically determines hit die type based on class
- **Roll Hit Die**: Spend hit dice during short rest to recover HP
- **Long Rest Restore**: Half of maximum hit dice restored on long rest (minimum 1)

### 12. **Racial Traits, Feats & Class Features**
- **Racial Traits**: `initRacialTraits()` - Loads and manages racial abilities
- **Feat System**: `initFeatTraits()` - Includes Lucky feat with modal interface, Feline Agility tracking
- **Class Features**: `initClassFeatures()` - Manages class-specific abilities
- **Feature Persistence**: Character state cache prevents resource refreshing when switching characters

### 13. **Companions & Familiars**
- **Companion Section**: Display companion/familiar data from DiceCloud
- **Companion Features**: Show companion abilities and stats
- **Toggle Display**: Companion section appears only if character has companions

### 14. **Special Features**
- **Sneak Attack**: Toggle for rogues to add sneak attack damage to weapon attacks
- **Elemental Weapon**: Toggle for elemental weapon spell bonus damage
- **Color Picker**: Customize Roll20 notification banner color
- **Settings Panel**: Settings button for configuration options

---

## 🔧 Technical Architecture

### Extension Components

#### 1. **Background Script** (`src/background.js`)
- **Service Worker**: Handles extension lifecycle and message routing
- **Data Storage**: Manages character data persistence using Chrome Storage API
- **Message Broker**: Coordinates communication between content scripts
- **API Token Management**: Stores and provides Dice Cloud API tokens

**Key Functions:**
- `chrome.runtime.onMessage` - Message handler for cross-script communication
- `chrome.storage.local` - Persistent data storage
- Token validation and refresh

#### 2. **Dice Cloud Content Script** (`src/content/dicecloud.js`) - **2,472 lines**
- **Character Data Extraction**: Parses Dice Cloud API responses
- **Race Parsing**: Advanced race extraction with multiple fallback strategies
  - Checks property types (`race`, `species`, `characterRace`)
  - Parses race objects with `name`, `text`, or `value` properties
  - Falls back to otherVariables if not found in properties
- **Attribute Calculation**:
  - Calculates modifiers from ability scores
  - Applies proficiency bonuses to skills and saves
  - Handles expertise (double proficiency)
- **Resource Tracking**: Extracts and formats spell slots, HP, class resources
- **Sync Button**: Adds "🔄 Sync to RollCloud" button to Dice Cloud interface
- **Roll Detection**: Monitors Dice Cloud rolls (experimental)

**Key Functions:**
- `extractCharacterDataFromAPI()` - Main API data extraction
- `parseCreatureData()` - Converts API response to structured character data
- `extractRace()` - Race extraction with fallbacks
- `calculateModifier()` - Ability modifier calculation
- `extractSpells()` - Spell data extraction
- `addSyncButton()` - UI integration

#### 3. **Roll20 Content Script** (`src/content/roll20.js`) - **120 lines**
- **Chat Integration**: Sends dice rolls to Roll20 chat
- **Message Listener**: Receives roll requests from character sheet overlay
- **Roll Formatting**: Formats rolls for Roll20 display
- **Error Handling**: Gracefully handles chat injection failures

**Key Functions:**
- `window.addEventListener('message')` - Listen for roll requests
- `postRollToChat()` - Send formatted rolls to Roll20
- `formatRollMessage()` - Format roll for display

#### 4. **Character Sheet Overlay** (`src/content/character-sheet-overlay.js`) - **1,859 lines**
- **Popup Window**: Creates and manages character sheet popup
- **Interactive UI**: Renders all character data with click handlers
- **Dice Rolling**: Handles click events and triggers rolls
- **Message Communication**: Sends roll requests to parent window → Roll20
- **Real-time Updates**: Syncs character data changes

**Key Functions:**
- `showOverlay()` - Opens popup window
- `createSimplePopup()` - Builds popup HTML and JavaScript
- `rollDice()` - Handles dice roll requests
- `createToggleButton()` - Creates "📋 Character Sheet" button in Roll20

#### 5. **Dice Fix Script** (`src/content/dice-fix.js`)
- **DOM Manipulation**: Fixes Dice Cloud dice display issues
- **Visual Enhancement**: Ensures dice values render correctly

#### 6. **Popup Interface** (`src/popup/`)
- **Standalone UI**: Extension toolbar popup for settings/info
- **Settings Management**: Configuration options
- **Quick Access**: Direct access to character data

---

## 🎯 User Workflow

### Setup
1. **Install Extension**: Load unpacked extension in Chrome
2. **Get API Token**: Obtain Dice Cloud API token from account settings
3. **Navigate to Dice Cloud**: Open character sheet
4. **Sync Character**: Click "🔄 Sync to RollCloud" button
5. **Open Roll20**: Navigate to Roll20 campaign

### Usage
1. **Character Sheet Button**: Click "📋 Character Sheet" button in Roll20
2. **Popup Opens**: Character sheet opens in new popup window
3. **View Character**: All stats, skills, abilities, spells displayed
4. **Roll Dice**: Click any card (ability, skill, save, spell) to roll
5. **Roll Confirmation**: Alert shows "Rolling [ability]..."
6. **Roll20 Chat**: Roll appears in Roll20 chat automatically

---

## 📊 Data Flow

```
┌─────────────────┐
│  Dice Cloud    │
│  Character     │
│  Sheet         │
└────────┬────────┘
         │
         │ 1. User clicks "Sync to RollCloud"
         │
         ▼
┌─────────────────┐
│  RollCloud      │
│  Background     │
│  Script         │
│  (API Request)  │
└────────┬────────┘
         │
         │ 2. Fetch character data via API
         │
         ▼
┌─────────────────┐
│  Chrome         │
│  Storage API    │
│  (Persistent)   │
└────────┬────────┘
         │
         │ 3. Character data stored
         │
         ▼
┌─────────────────┐
│  Roll20 Page    │
│  + Character    │
│  Sheet Overlay  │
└────────┬────────┘
         │
         │ 4. User opens popup
         │
         ▼
┌─────────────────┐
│  Popup Window   │
│  Character      │
│  Sheet          │
└────────┬────────┘
         │
         │ 5. User clicks ability/skill card
         │
         ▼
┌─────────────────┐
│  Roll Request   │
│  (postMessage)  │
└────────┬────────┘
         │
         │ 6. Message sent to parent window
         │
         ▼
┌─────────────────┐
│  Roll20 Chat    │
│  Integration    │
│  (roll result)  │
└─────────────────┘
```

---

## 🎨 UI Components

### Character Sheet Popup

#### Header
- **Title**: "🎲 RollCloud Character Sheet"
- **Close Button**: Red "✕ Close" button
- **Character Name**: Displayed prominently

#### Sections
1. **Character Info**
   - Name, Class, Level, Race
   - Grid layout, responsive design

2. **Abilities** (6 cards)
   - STR, DEX, CON, INT, WIS, CHA
   - Score and modifier displayed
   - Click to roll ability check
   - Formula: `1d20 + modifier`

3. **Saving Throws** (6 cards)
   - All 6 saves with bonuses
   - Click to roll save
   - Formula: `1d20 + save_bonus`

4. **Skills** (18 cards)
   - All D&D 5e skills
   - Proficiency bonuses applied
   - Click to roll skill check
   - Formula: `1d20 + skill_bonus`

#### Styling
- **Colors**:
  - Primary: `#4ECDC4` (teal)
  - Background: `#f5f5f5` (light gray)
  - Cards: `#f0fff4` (mint green)
  - Text: `#2C3E50` (dark blue-gray)
- **Effects**:
  - Hover: Transform translateY(-2px), shadow enhancement
  - Click: Visual feedback
  - Transitions: Smooth 0.2s animations

---

## 🔐 Security & Privacy

### API Authentication
- **API Tokens**: Stored securely in Chrome Storage
- **Scope**: Read-only access to character data
- **Transmission**: HTTPS only

### Permissions
- `storage`: Character data persistence
- `activeTab`: Access to current tab
- **Host Permissions**:
  - `https://dicecloud.com/*`
  - `https://app.roll20.net/*`

### Data Handling
- **Local Storage Only**: Character data never sent to external servers
- **No Tracking**: No analytics or user tracking
- **Content Scripts**: Isolated from page scripts

---

## 🐛 Error Handling

### Graceful Degradation
- **No Character Data**: Shows "Please sync from Dice Cloud" message
- **API Failures**: Displays error notifications
- **Missing Properties**: Uses sensible defaults (e.g., 10 for abilities)
- **Popup Blocked**: Notifies user to allow popups

### Debugging Support
- **Console Logging**: Extensive logging for troubleshooting
- **Visual Feedback**: Notifications for all actions
- **Error Messages**: Clear, actionable error descriptions

---

## 📝 Data Structure

### Character Data Object
```javascript
{
  name: "Grey",                      // Character name
  race: "firbolg",                   // Race (with fallback parsing)
  class: "Ranger",                   // Character class
  level: 3,                          // Character level
  alignment: "Neutral Good",         // Alignment
  background: "Outlander",           // Background

  attributes: {                      // Ability scores
    strength: 16,
    dexterity: 14,
    constitution: 13,
    intelligence: 10,
    wisdom: 15,
    charisma: 8
  },

  attributeMods: {                   // Calculated modifiers
    strength: 3,
    dexterity: 2,
    constitution: 1,
    intelligence: 0,
    wisdom: 2,
    charisma: -1
  },

  savingThrows: {                    // Saves with proficiency
    strength: 3,
    dexterity: 4,                    // +2 prof
    constitution: 1,
    intelligence: 0,
    wisdom: 4,                       // +2 prof
    charisma: -1
  },

  skills: {                          // All skills with bonuses
    acrobatics: 2,
    "animal-handling": 4,            // +2 prof
    arcana: 0,
    athletics: 3,
    deception: -1,
    history: 0,
    insight: 2,
    intimidation: -1,
    investigation: 0,
    medicine: 2,
    nature: 2,                       // +2 prof
    perception: 4,                   // +2 prof
    performance: -1,
    persuasion: -1,
    religion: 0,
    "sleight-of-hand": 2,
    stealth: 2,
    survival: 4                      // +2 prof
  },

  armorClass: 15,                    // AC
  hitPoints: {                       // HP tracking
    current: 24,
    max: 24
  },
  speed: 30,                         // Movement speed
  initiative: 2,                     // Initiative bonus
  proficiencyBonus: 2,               // Proficiency bonus

  spells: [                          // Spell list
    {
      name: "Hunter's Mark",
      level: 1,
      school: "Divination",
      castingTime: "1 bonus action",
      range: "90 feet",
      duration: "1 hour (concentration)",
      description: "Mark a creature..."
    }
  ],

  spellSlots: {                      // Spell slot tracking
    level1SpellSlots: 2,
    level1SpellSlotsMax: 3,
    level2SpellSlots: 0,
    level2SpellSlotsMax: 0
  },

  otherVariables: {                  // Custom variables
    "ki": 3,
    "sorcery-points": 0,
    "rage": "2/2"
  }
}
```

---

## 🚀 Feature Status

### ✅ Fully Implemented Features
- [x] **Spell Slot Management**: Auto-decrement on cast, manual adjustment, restoration on rest
- [x] **HP Tracking**: Full modal with heal/damage/temp HP adjustment, death saves
- [x] **Resource Management**: Auto-decrement on use, restoration on rest (Ki, Sorcery Points, Rage, etc.)
- [x] **Roll History**: Visible in Roll20 chat with full history
- [x] **Advantage/Disadvantage**: Via effects system with auto-apply
- [x] **Multiple Characters**: Tab system for switching between characters
- [x] **Condition Tracking**: Full buffs/debuffs system with auto-modifiers
- [x] **Racial/Class Features**: Racial traits, feats, and class features support
- [x] **Dark Mode**: Complete theme system with light/dark modes
- [x] **Settings Page**: Settings panel with customization options
- [x] **Export/Import**: Character data export to JSON file
- [x] **GM Combat Tools**: Initiative tracker, action economy, turn detection
- [x] **Concentration Tracking**: Visual indicator with spell name and drop button
- [x] **Inspiration System**: Toggle with Roll20 announcements
- [x] **Rest System**: Short and long rest with proper resource restoration
- [x] **Hit Dice**: Tracking, rolling, and restoration mechanics
- [x] **Companions**: Display section for companions and familiars
- [x] **Advanced Filtering**: Search and filter actions/spells by multiple criteria

### 🚧 Partially Implemented
- [~] **Two-Way Sync to DiceCloud**: Local tracking works perfectly, but changes are NOT synced back to DiceCloud in main build
  - Spell slots decrement locally but not on DiceCloud
  - Resources decrement locally but not on DiceCloud
  - HP changes tracked locally but not on DiceCloud
  - **Note**: Experimental build includes DDP sync code but it's not integrated into main build

### ❌ Not Yet Implemented
- [ ] **Inventory Display**: No equipment/items section (DiceCloud has this data via API)
- [ ] **Roll Statistics**: No aggregate stats tracking (total rolls, averages, nat 20s/1s)
- [ ] **Custom Dice Formulas**: No user-defined roll macro system
- [ ] **Notes & Journal**: No character notes/backstory display section

### 🔧 Technical Improvements Needed
- [ ] **TypeScript Migration**: Better type safety (currently vanilla JS, 10,004 lines in popup-sheet.js)
- [ ] **Unit Tests**: No test infrastructure (no test/, spec/, or .test.js files)
- [ ] **Error Recovery**: Limited retry logic for API failures, network issues
- [ ] **Performance**: Code splitting for large character sheets (single 10K line file)
- [ ] **Mobile Support**: Responsive design for tablets (currently desktop-optimized)
- [ ] **Production DEBUG Toggle**: DEBUG flag hardcoded to `true` in `src/common/debug.js:13`

---

## 📖 Version History

### Version 1.1.2 (Current)
- ✅ Enhanced authentication with auto-connect
- ✅ GM combat management system (initiative tracker, action economy)
- ✅ Full HP management modal (heal/damage/temp HP)
- ✅ Death saves tracking and auto-reset
- ✅ Inspiration system with toggles
- ✅ Concentration tracking for spells
- ✅ Short/long rest system with smart resource restoration
- ✅ Hit dice system with auto-detection
- ✅ Spell slot auto-decrement on cast
- ✅ Resource auto-decrement for limited use actions
- ✅ Buffs/debuffs condition system
- ✅ Theme system (light/dark mode)
- ✅ Multiple character tabs
- ✅ Companion/familiar support
- ✅ Advanced filtering for actions and spells
- ✅ Guidance & Bless auto-apply
- ✅ Sneak Attack and Elemental Weapon toggles
- ✅ Character data export to JSON
- ✅ GM panel with read-only character sheets

### Version 1.0.0
- ✅ Initial release
- ✅ Dice Cloud API integration
- ✅ Character data synchronization
- ✅ Roll20 chat integration
- ✅ Interactive character sheet popup
- ✅ Click-to-roll for abilities, saves, skills
- ✅ Race parsing with fallback strategies
- ✅ Spell data extraction
- ✅ Real-time dice rolling

---

## 🛠️ Development

### File Structure
```
rollCloud/
├── manifest.json                    # Extension manifest
├── src/
│   ├── background.js                # Service worker (349 lines)
│   ├── content/
│   │   ├── dicecloud.js             # Dice Cloud integration (2,472 lines)
│   │   ├── dice-fix.js              # DOM fixes
│   │   ├── roll20.js                # Roll20 integration (120 lines)
│   │   └── character-sheet-overlay.js # Character sheet UI (1,859 lines)
│   └── popup/
│       ├── popup.html               # Extension popup UI
│       ├── popup.css                # Popup styles
│       └── popup.js                 # Popup logic
├── icons/                           # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                        # User documentation
```

### Code Quality
- **Total Lines**: ~21,662 lines of JavaScript across all components
  - `popup-sheet.js`: 10,004 lines (character sheet UI and logic)
  - `dicecloud.js`: 4,586 lines (DiceCloud API integration)
  - `roll20.js`: 2,745 lines (Roll20 integration)
  - `character-sheet-overlay.js`: 2,061 lines (overlay window management)
  - `background.js`: 670 lines (service worker, message routing)
  - Other utilities: ~2,000 lines (theme manager, debug, card creator, etc.)
- **Modular Design**: Separated concerns (API, UI, dice rolling, content scripts)
- **Error Handling**: Comprehensive try-catch blocks with graceful degradation
- **Logging**: Extensive console logging for debugging (via `debug.js`)
- **Comments**: Well-documented functions and logic
- **Browser Compatibility**: Polyfills for Firefox/Chrome/Safari differences
- **Storage**: Chrome Storage API for persistence, character cache system
- **Build System**: Node.js build scripts for multi-browser support

---

## 🎯 Target Audience

### Primary Users
- **D&D 5e Players**: Using both Dice Cloud and Roll20
- **Dungeon Masters**: Managing multiple character sheets
- **Campaign Groups**: Standardizing character data format

### Use Cases
1. **Character Creation**: Manage character in Dice Cloud, play in Roll20
2. **Session Play**: Quick access to all character stats
3. **Dice Rolling**: Fast, accurate dice rolls with auto-chat
4. **Character Updates**: Sync changes from Dice Cloud to Roll20
5. **Multi-Character**: DMs managing NPCs and enemies

---

## 🙏 Credits

### Technologies
- **Chrome Extensions API**: Extension framework
- **Dice Cloud API**: Character data source
- **Roll20 Platform**: Virtual tabletop integration
- **JavaScript**: Core programming language
- **HTML/CSS**: UI rendering

### Dependencies
- None (vanilla JavaScript, no external libraries)

---

## 📜 License

This extension is provided as-is for personal use with Dice Cloud and Roll20 platforms.

---

## 📞 Support

For issues, feature requests, or questions:
- Check console logs for debugging info
- Verify Dice Cloud API token is valid
- Ensure popup blockers allow RollCloud windows
- Refresh both Dice Cloud and Roll20 pages

---

## 🎲 Summary

**RollCloud** is a powerful, seamless integration between Dice Cloud character management and Roll20 virtual tabletop gameplay. It provides:

✅ **Automatic character data synchronization**
✅ **Beautiful, interactive character sheet popup**
✅ **One-click dice rolling for all abilities, skills, and saves**
✅ **Real-time Roll20 chat integration**
✅ **Comprehensive D&D 5e support**
✅ **Robust error handling and user feedback**

The extension enhances the tabletop RPG experience by eliminating manual character data entry, reducing dice rolling friction, and keeping character information easily accessible during gameplay.

**Experience the future of seamless D&D character management and dice rolling!** 🎲✨
