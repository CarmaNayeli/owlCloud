# Changes from PR #518: Modularize Popup Sheet

**Date:** January 29, 2026
**Branch:** modularize-popup-sheet → main
**Impact:** Extracted 2,774 lines (18.7%) from popup-sheet.js into 7 specialized modules

---

## Overview

PR #518 refactored the monolithic `popup-sheet.js` (14,858 lines) by extracting functionality into separate, focused modules. This improves maintainability, readability, and allows for easier testing and future development.

**Before:** 1 massive file (popup-sheet.js)
**After:** 7 new modules + reduced popup-sheet.js (12,084 lines)

---

## New Modules Created

### 1. notification-system.js (92 lines)
**Location:** `src/modules/notification-system.js`
**Purpose:** Toast notifications with animations and color coding

**Exports:**
- Functions for displaying notifications (1 function exported to globalThis)
- Follows action-executor pattern for browser compatibility

---

### 2. status-bar-bridge.js (92 lines)
**Location:** `src/modules/status-bar-bridge.js`
**Purpose:** Status bar popup communication bridge

**Exports:**
- Functions for status bar popup communication
- No ES6 modules, uses globalThis for browser compatibility

---

### 3. hp-management.js (744 lines)
**Location:** `src/modules/hp-management.js`
**Purpose:** HP, healing, damage, temporary HP, and rest mechanics

**Exports (6 functions):**
- `showHPModal()` - Interactive HP adjustment (heal/damage/temp HP)
- `takeShortRest()` - Restores Pact Magic, Ki, allows hit dice spending
- `takeLongRest()` - Fully restores HP, spell slots, and all resources
- `getHitDieType()` - Determines hit die based on class (d6-d12)
- `initializeHitDice()` - Sets up hit dice tracking
- `spendHitDice()` - Interactive hit dice spending during short rest

**Features:**
- Proper D&D 5e RAW mechanics (temp HP, death saves, resource restoration)
- Hit dice restoration on long rest
- Pact Magic slot restoration on short rest

---

### 4. effects-manager.js (699 lines)
**Location:** `src/modules/effects-manager.js`
**Purpose:** Buffs, debuffs, and condition tracking

**Exports (8 functions + 2 constants):**
- `initConditionsManager()` - UI initialization
- `showEffectsModal()` - Modal for selecting effects
- `addEffect()` / `removeEffect()` - Effect management
- `addCondition()` / `removeCondition()` - Legacy wrappers
- `updateEffectsDisplay()` / `updateConditionsDisplay()` - UI updates
- `POSITIVE_EFFECTS` - 15 buffs (Bless, Guidance, Bardic Inspiration, Haste, etc.)
- `NEGATIVE_EFFECTS` - 17 debuffs (Bane, Poisoned, Stunned, Paralyzed, etc.)

**State Variables:**
- `activeBuffs` - Currently active positive effects
- `activeConditions` - Currently active negative effects

---

### 5. data-manager.js (468 lines)
**Location:** `src/modules/data-manager.js`
**Purpose:** All data persistence, loading, and character management

**Exports (8 functions + 3 state variables):**
- `saveCharacterData()` - Saves to browser storage with debounced sync
- `sendSyncMessage()` - Syncs to DiceCloud/Roll20 content script
- `loadCharacterWithTabs()` - Loads character from storage/database
- `loadAndBuildTabs()` - Loads character profiles for tab UI
- `getActiveCharacterId()` - Retrieves active character from storage
- `setActiveCharacter()` - Sets active character in storage
- `buildCharacterTabs()` - Renders character tab switcher UI
- `validateCharacterData()` - Validates required fields (spells/actions)

**State Variables:**
- `currentSlotId` - Current character slot identifier
- `syncDebounceTimer` - Debounce timer for sync operations
- `characterCache` - Cached character data

**Features:**
- Handles both local storage and database characters (db- prefix)
- Filters incomplete characters from tab display
- User-friendly error messages for validation failures

---

### 6. feature-modals.js (955 lines)
**Location:** `src/modules/feature-modals.js`
**Purpose:** Special D&D 5e feature UI (Inspiration, Divine Smite, Lucky, Lay on Hands)

**Exports (11 functions):**
- `toggleInspiration()` - Gain or use inspiration based on state
- `showGainInspirationModal()` - Modal for gaining inspiration
- `showUseInspirationModal()` - 2014 vs 2024 inspiration usage modes
- `showDivineSmiteModal(spell)` - Select slot level & modifiers for smite
- `showLayOnHandsModal(pool)` - Spend Lay on Hands points
- `showLuckyModal()` - Use Lucky feat points
- `rollLuckyDie(type)` - Roll d20 for Lucky feat
- `getLuckyResource()` - Find Lucky resource in character data
- `useLuckyPoint()` - Consume Lucky point
- `getLayOnHandsResource()` - Find Lay on Hands pool
- `createThemedModal()` - Helper for theme-aware modals

**Features:**
- **Divine Smite:** Supports Pact Magic, regular slots, critical hits, fiend/undead bonuses
- **Inspiration:** 2014 (advantage) and 2024 (reroll) rule modes
- **Lucky:** Offensive and defensive roll support
- **Lay on Hands:** Variable HP healing or cure disease/poison
- All modals include theme support and escape key handling

---

### 7. resource-manager.js (785 lines)
**Location:** `src/modules/resource-manager.js`
**Purpose:** Resource tracking, consumption, and conversion (Font of Magic, Harness Divine Power)

**Exports (13 functions):**
- `buildResourcesDisplay()` - Display resource grid with manual adjustment
- `adjustResource(resource)` - Manual resource value adjustment modal
- `getSorceryPointsResource()` - Find Sorcery Points resource
- `getKiPointsResource()` - Find Ki Points resource
- `findResourceByVariableName(variableName)` - Flexible resource lookup with Channel Divinity support
- `getResourceCostsFromAction(action)` - Extract resource costs from DiceCloud structured data
- `getKiCostFromAction(action)` - Legacy Ki cost extraction
- `getSorceryPointCostFromAction(action)` - Legacy Sorcery Point cost extraction
- `decrementActionResources(action)` - Consume action resources (Wild Shape, Breath Weapon, etc.)
- `showConvertSlotToPointsModal()` - Font of Magic - spell slot → sorcery points
- `showFontOfMagicModal()` - Font of Magic - sorcery points → spell slot
- `showSpellSlotRestorationModal()` - Harness Divine Power - Channel Divinity → spell slot
- `restoreSpellSlot(level, channelDivinityResource)` - Perform spell slot restoration

**Features:**
- Filters out Lucky, HP, and zero-max resources from display
- Flexible Channel Divinity matching (channelDivinity, channelDivinityCleric, channelDivinityPaladin)
- Font of Magic conversions following D&D 5e slot costs:
  - Level 1 → 2 SP
  - Level 2 → 3 SP
  - Level 3 → 5 SP
  - Level 4 → 6 SP
  - Level 5 → 7 SP
- Harness Divine Power spell slot restoration (Paladin/Cleric feature)
- Roll20 chat integration for all conversions
- Structured resource consumption (DiceCloud attributesConsumed)

---

## Files Modified

### popup-sheet.html
**Changes:** Added 7 new module script tags

```html
<!-- New module loading order: -->
1. notification-system.js
2. status-bar-bridge.js
3. hp-management.js
4. effects-manager.js
5. data-manager.js
6. feature-modals.js
7. resource-manager.js
```

All modules load **before** main `popup-sheet.js` to make functions available globally.

### popup-sheet.js
**Before:** 14,858 lines
**After:** 12,084 lines
**Reduction:** 2,774 lines (18.7%)

**Removed:**
- 52 total items (functions, state variables, and constants)
- 8 orphaned JSDoc comment blocks
- All extracted functionality now loaded via modules

**Preserved:**
- All function calls remain intact (20+ calls to `saveCharacterData()`, etc.)
- Functions now available globally from modules
- File validates with Node.js (no syntax errors)

---

## Technical Details

### Architecture Pattern
All modules follow the **action-executor pattern**:
- IIFE (Immediately Invoked Function Expression) wrapper
- Export to `globalThis` (no ES6 modules)
- Browser compatibility (no module bundler required)

### Load Order Requirements
Modules **must** load before `popup-sheet.js` to ensure functions are available globally when the main script executes.

### Backwards Compatibility
- All existing function calls preserved
- No breaking changes to external interfaces
- State variables maintained through module exports

---

## Commits in PR #518

1. **737f4b3** - Refactor: Extract notification and status bar modules
2. **c577f87** - Feature: Extract HP management module
3. **9901d6e** - Feature: Extract effects manager module
4. **462571e** - Feature: Load extracted modules in popup-sheet.html
5. **b030241** - Feature: Extract character data manager module
6. **5b15cd8** - Feature: Load data-manager module in popup-sheet.html
7. **ba7c5b6** - Feature: Extract feature modals module
8. **ca670b1** - Feature: Load feature-modals module in popup-sheet.html
9. **4cc2184** - Feature: Extract resource manager module (707 lines)
10. **4d372a0** - Refactor: Remove extracted code from popup-sheet.js (2,774 lines)
11. **633e610** - Merge pull request #518 from CarmaNayeli/modularize-popup-sheet

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| New modules created | 7 |
| Total new lines added | 3,963 |
| Lines removed from popup-sheet.js | 2,901 |
| Net change | +1,062 lines |
| popup-sheet.js reduction | 18.7% |
| Functions extracted | 52+ |
| Files modified | 9 |

---

## Benefits

1. **Maintainability:** Each module has a single, clear responsibility
2. **Readability:** Easier to navigate and understand specific features
3. **Testing:** Modules can be tested independently
4. **Performance:** No change (all modules loaded synchronously)
5. **Future Development:** Easier to add new features or modify existing ones
6. **Code Organization:** Clear separation of concerns

---

*Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>*
