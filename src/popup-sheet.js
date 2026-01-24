debug.log('✅ Popup HTML loaded');

// Import spell edge cases
import { SPELL_EDGE_CASES, isEdgeCase, getEdgeCase, applyEdgeCaseModifications, isReuseableSpell, isTooComplicatedSpell } from './modules/spell-edge-cases.js';
// Import class feature edge cases
import { CLASS_FEATURE_EDGE_CASES, isClassFeatureEdgeCase, getClassFeatureEdgeCase, applyClassFeatureEdgeCaseModifications } from './modules/class-feature-edge-cases.js';
// Import racial feature edge cases
import { RACIAL_FEATURE_EDGE_CASES, isRacialFeatureEdgeCase, getRacialFeatureEdgeCase, applyRacialFeatureEdgeCaseModifications } from './modules/racial-feature-edge-cases.js';
// Import combat maneuver edge cases
import { COMBAT_MANEUVER_EDGE_CASES, isCombatManeuverEdgeCase, getCombatManeuverEdgeCase, applyCombatManeuverEdgeCaseModifications } from './modules/combat-maneuver-edge-cases.js';

// Initialize theme manager
if (typeof ThemeManager !== 'undefined') {
  ThemeManager.init().then(() => {
    debug.log('🎨 Theme system initialized');

    // Set up theme button click handlers
    // Note: Don't wrap in DOMContentLoaded since this script runs after the DOM is loaded
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        ThemeManager.setTheme(theme);

        // Update active state
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Set initial active button based on current theme
    const currentTheme = ThemeManager.getCurrentTheme();
    const activeBtn = document.querySelector(`[data-theme="${currentTheme}"]`);
    if (activeBtn) {
      themeButtons.forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
    }
  });
} else {
  debug.warn('⚠️ ThemeManager not available');
}

// Store character data globally so we can update it
let characterData = null;

// Track current character slot ID (e.g., "slot-1") for persistence
let currentSlotId = null;

// Track Feline Agility usage
let felineAgilityUsed = false;

// Setting: Show custom macro gear buttons on spells (disabled by default)
let showCustomMacroButtons = false;

// Track if DOM is ready
let domReady = false;

// Queue for operations waiting for DOM
let pendingOperations = [];

/**
 * Hide GM controls when opened from GM panel (read-only mode)
 */
function hideGMControls() {
  // Hide GM mode toggle
  const gmModeContainer = document.querySelector('.gm-mode-container');
  if (gmModeContainer) {
    gmModeContainer.style.display = 'none';
    debug.log('👑 Hidden GM mode toggle');
  }
  
  // Hide settings button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.style.display = 'none';
    debug.log('👑 Hidden settings button');
  }
  
  // Hide color picker
  const colorPickerContainer = document.querySelector('.color-picker-container');
  if (colorPickerContainer) {
    colorPickerContainer.style.display = 'none';
    debug.log('👑 Hidden color picker');
  }
  
  // Update title to indicate read-only mode
  const titleElement = document.querySelector('.char-name-section');
  if (titleElement) {
    titleElement.innerHTML = titleElement.innerHTML.replace('🎲 Character Sheet', '🎲 Character Sheet (Read Only)');
  }
}

// Listen for character data from parent window via postMessage
window.addEventListener('message', async (event) => {
  debug.log('✅ Received message in popup:', event.data);

  if (event.data && event.data.action === 'initCharacterSheet') {
    debug.log('✅ Initializing character sheet with data:', event.data.data.name);
    
    // Check if this is opened from GM panel (read-only mode)
    const isFromGMPanel = event.data.source === 'gm-panel';
    if (isFromGMPanel) {
      debug.log('👑 Popup opened from GM panel - hiding GM controls');
      hideGMControls();
    }
    
    // Function to initialize the sheet
    const initSheet = async () => {
      characterData = event.data.data;  // Store globally

      // Get and store current slot ID for persistence
      currentSlotId = await getActiveCharacterId();
      debug.log('📋 Current slot ID set to:', currentSlotId);

      // Build tabs first (need to load profiles from storage)
      await loadAndBuildTabs();

      // Then build the sheet with character data
      buildSheet(characterData);
      
      // Initialize racial traits based on character data
      initRacialTraits();

      // Initialize feat traits based on character data
      initFeatTraits();

      // Initialize class features based on character data
      initClassFeatures();

      // Initialize character cache with current data
      if (characterData && characterData.id) {
        characterCache.set(characterData.id, JSON.parse(JSON.stringify(characterData)));
        debug.log(`📂 Initialized cache for character: ${characterData.name}`);
      }

      // Register this character with GM Initiative Tracker (if it exists)
      // Use postMessage to avoid CORS issues - send character name only
      if (window.opener) {
        window.opener.postMessage({
          action: 'registerPopup',
          characterName: event.data.data.name
        }, '*');
        debug.log(`✅ Sent registration message for: ${event.data.data.name}`);
        
        // Check if it's currently this character's turn by reading recent chat
        // Add a small delay to ensure combat system has processed start of combat
        setTimeout(() => {
          checkCurrentTurnFromChat(event.data.data.name);
        }, 500);
      } else {
        debug.warn(`⚠️ No window.opener available for: ${event.data.data.name}`);
      }
    };

    // Only initialize if DOM is ready, otherwise queue it
    if (domReady) {
      await initSheet();
    } else {
      debug.log('⏳ DOM not ready yet, queuing initialization...');
      pendingOperations.push(initSheet);
    }
  } else if (event.data && event.data.action === 'loadCharacterData') {
    debug.log('📋 Loading character data from GM panel:', event.data.characterData.name);
    
    // This is from GM panel - hide GM controls
    hideGMControls();
    
    // Load the character data using the same initialization process
    characterData = event.data.characterData;
    
    // Function to initialize the sheet with GM panel data
    const initSheetFromGM = async () => {
      // Build tabs first (need to load profiles from storage)
      await loadAndBuildTabs();

      // Then build the sheet with character data
      buildSheet(characterData);
      
      // Initialize racial traits based on character data
      initRacialTraits();

      // Initialize feat traits based on character data
      initFeatTraits();

      // Initialize class features based on character data
      initClassFeatures();

      // Initialize character cache with current data
      if (characterData && characterData.id) {
        characterCache.set(characterData.id, JSON.parse(JSON.stringify(characterData)));
        debug.log(`📂 Initialized cache for character: ${characterData.name}`);
      }
    };

    // Only initialize if DOM is ready, otherwise queue it
    if (domReady) {
      await initSheetFromGM();
    } else {
      debug.log('⏳ DOM not ready yet, queuing GM panel initialization...');
      pendingOperations.push(initSheetFromGM);
    }
  }
});

// Tell parent window we're ready - wait for DOM to be fully loaded
// This prevents race conditions in Firefox
function notifyParentReady() {
  try {
    if (window.opener && !window.opener.closed) {
      debug.log('✅ Sending ready message to parent window...');
      window.opener.postMessage({ action: 'popupReady' }, '*');
    } else {
      debug.warn('⚠️ No parent window available, waiting for postMessage...');
    }
  } catch (error) {
    debug.warn('⚠️ Could not notify parent (this is normal):', error.message);
  }
}

// Wait for DOM to be ready before doing anything
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    debug.log('✅ DOM is ready');
    domReady = true;
    
    // Send ready message to parent
    notifyParentReady();
    
    // Execute any pending operations
    for (const operation of pendingOperations) {
      await operation();
    }
    pendingOperations = [];
  });
} else {
  // DOM is already ready
  debug.log('✅ DOM already ready');
  domReady = true;
  notifyParentReady();
}

debug.log('✅ Waiting for character data via postMessage...');

// Fallback: If we don't receive data via postMessage within 1.5 seconds,
// load directly from storage (Firefox sometimes blocks postMessage between windows)
setTimeout(() => {
  if (!characterData && domReady) {
    debug.log('⏱️ No data received via postMessage, loading from storage...');
    loadCharacterWithTabs();
  } else if (!characterData && !domReady) {
    debug.log('⏳ DOM not ready yet, will retry fallback...');
    setTimeout(() => {
      if (!characterData) {
        debug.log('⏱️ Retry: Loading from storage...');
        loadCharacterWithTabs();
      }
    }, 500);
  }
}, 1500);

// Load profiles and build tabs (without building sheet)
async function loadAndBuildTabs() {
  try {
    debug.log('📋 Loading character profiles for tabs...');

    // Get all character profiles
    const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
    const profiles = profilesResponse.success ? profilesResponse.profiles : {};
    debug.log('📋 Profiles loaded:', Object.keys(profiles));

    // Get active character ID (this is the slotId like "slot-1")
    const activeCharacterId = await getActiveCharacterId();
    debug.log('📋 Active character ID:', activeCharacterId);

    // Build character tabs
    buildCharacterTabs(profiles, activeCharacterId);
  } catch (error) {
    debug.error('❌ Failed to load and build tabs:', error);
  }
}

// Load character data and build tabs
async function loadCharacterWithTabs() {
  // Wait for DOM to be ready
  if (!domReady) {
    debug.log('⏳ DOM not ready, queuing loadCharacterWithTabs...');
    pendingOperations.push(loadCharacterWithTabs);
    return;
  }

  try {
    // Build tabs first
    await loadAndBuildTabs();

    // Get and store current slot ID for persistence
    currentSlotId = await getActiveCharacterId();
    debug.log('📋 Current slot ID set to:', currentSlotId);

    // Get active character data
    const activeResponse = await browserAPI.runtime.sendMessage({ action: 'getCharacterData' });
    const activeCharacter = activeResponse.success ? activeResponse.data : null;

    // Load active character
    if (activeCharacter) {
      characterData = activeCharacter;
      buildSheet(characterData);
      
      // Initialize racial traits based on character data
      initRacialTraits();

      // Initialize feat traits based on character data
      initFeatTraits();

      // Initialize class features based on character data
      initClassFeatures();
    } else {
      debug.error('❌ No character data found in storage');
    }
  } catch (error) {
    debug.error('❌ Failed to load characters:', error);
  }
}

// Get the active character ID from storage
async function getActiveCharacterId() {
  // Use Promise-based API (works in both Chrome and Firefox with our polyfill)
  const result = await browserAPI.storage.local.get(['activeCharacterId']);
  return result.activeCharacterId || null;
}

// Build character tabs UI
function buildCharacterTabs(profiles, activeCharacterId) {
  const tabsContainer = document.getElementById('character-tabs');
  if (!tabsContainer) {
    debug.warn('⚠️ character-tabs container not found!');
    return;
  }

  debug.log(`🏷️ Building character tabs. Active: ${activeCharacterId}`);
  debug.log(`📋 Profiles:`, Object.keys(profiles));

  tabsContainer.innerHTML = '';
  const maxSlots = 10; // Support up to 10 character slots (matches main's implementation)

  // Create tabs for each slot
  for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
    const slotId = `slot-${slotNum}`;
    // Find character in this slot using slotId as key
    const charInSlot = profiles[slotId];

    if (charInSlot) {
      debug.log(`  📌 Slot ${slotNum}: ${charInSlot.name} (active: ${slotId === activeCharacterId})`);
    }

    const tab = document.createElement('div');
    tab.className = 'character-tab';
    tab.dataset.slotId = slotId;

    if (charInSlot) {
      const isActive = slotId === activeCharacterId;

      if (isActive) {
        tab.classList.add('active');
      }

      tab.innerHTML = `
        <span class="slot-number">${slotNum}</span>
        <span class="char-name">${charInSlot.name || 'Unknown'}</span>
        <span class="close-tab" title="Clear slot">✕</span>
      `;

      // Click to switch character
      tab.addEventListener('click', (e) => {
        debug.log(`🖱️ Tab clicked for ${slotId}`, charInSlot.name);
        if (!e.target.classList.contains('close-tab')) {
          switchToCharacter(slotId);
        }
      });

      // Close button
      const closeBtn = tab.querySelector('.close-tab');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearCharacterSlot(slotId, slotNum);
      });
    } else {
      // Empty slot
      tab.classList.add('empty');
      tab.innerHTML = `
        <span class="slot-number">${slotNum}</span>
        <span class="char-name">Empty Slot</span>
      `;
    }

    tabsContainer.appendChild(tab);
  }
}

/**
 * Check recent chat messages to see if it's currently this character's turn
 * This handles the case where a character tab is switched after turn notifications were sent
 */
function checkCurrentTurnFromChat(characterName) {
  try {
    if (!window.opener) {
      debug.warn('⚠️ No window.opener available for turn check');
      return;
    }

    // Request recent chat messages from parent window
    window.opener.postMessage({
      action: 'checkCurrentTurn',
      characterName: characterName
    }, '*');
    
    debug.log(`🔍 Requested turn check for: ${characterName}`);
  } catch (error) {
    debug.warn('⚠️ Error checking current turn:', error);
  }
}

// Switch to a different character
async function switchToCharacter(characterId) {
  try {
    debug.log(`🔄 Switching to character: ${characterId}`);

    // Save current character data before switching to preserve local state
    // CRITICAL: Save to BOTH cache AND browser storage to persist through refresh
    if (characterData && currentSlotId && currentSlotId !== characterId) {
      debug.log('💾 Saving current character data before switching');
      const dataToSave = JSON.parse(JSON.stringify(characterData));

      // Save to cache (for quick access in current session)
      if (characterData.id) {
        characterCache.set(characterData.id, dataToSave);
        debug.log(`✅ Cached current character data: ${characterData.name}`);
      }

      // Save to browser storage (persists through refresh/close) WITH slotId
      await browserAPI.runtime.sendMessage({
        action: 'storeCharacterData',
        data: dataToSave,
        slotId: currentSlotId  // CRITICAL: Pass current slotId for proper persistence
      });

      // Send sync message to DiceCloud if experimental sync is available
      // Always send sync messages in experimental build - they'll be handled by Roll20 content script
      debug.log('🔄 Sending character data update to DiceCloud sync...');

      // Extract Channel Divinity from resources if it exists
      const channelDivinityResource = characterData.resources?.find(r =>
        r.name === 'Channel Divinity' ||
        r.variableName === 'channelDivinityCleric' ||
        r.variableName === 'channelDivinityPaladin' ||
        r.variableName === 'channelDivinity'
      );

      const syncMessage = {
        type: 'characterDataUpdate',
        characterData: {
          name: characterData.name,
          hp: characterData.hitPoints.current,
          tempHp: characterData.temporaryHP || 0,
          maxHp: characterData.hitPoints.max,
          spellSlots: characterData.spellSlots || {},
          channelDivinity: channelDivinityResource ? {
            current: channelDivinityResource.current,
            max: channelDivinityResource.max
          } : undefined,
          resources: characterData.resources || [],
          actions: characterData.actions || [],
          deathSaves: characterData.deathSaves,
          inspiration: characterData.inspiration,
          lastRoll: characterData.lastRoll
        }
      };
      
      // Try to send to Roll20 content script
      window.postMessage(syncMessage, '*');
      
      // Also try to send via opener if available
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(syncMessage, '*');
      }

      debug.log(`💾 Saved current character to browser storage: ${characterData.name} (slotId: ${currentSlotId})`);
    }

    // Update current slot ID
    currentSlotId = characterId;
    debug.log('📋 Current slot ID updated to:', currentSlotId);

    // Set active character
    await browserAPI.runtime.sendMessage({
      action: 'setActiveCharacter',
      characterId: characterId
    });
    debug.log(`✅ Active character set to: ${characterId}`);

    // Try to get cached character data first
    let characterDataToUse = characterCache.get(characterId);

    if (!characterDataToUse) {
      debug.log('📂 No cached data, fetching from storage');
      // Fetch from storage if not cached
      const response = await browserAPI.runtime.sendMessage({
        action: 'getCharacterData',
        characterId: characterId
      });
      debug.log(`📊 Character data received:`, response);

      if (response && response.data) {
        characterDataToUse = response.data;
        // Cache the fresh data
        characterCache.set(characterId, JSON.parse(JSON.stringify(response.data)));
      }
    } else {
      debug.log('📂 Using cached character data');
    }

    if (characterDataToUse) {
      characterData = characterDataToUse;
      debug.log(`🎨 Building sheet for: ${characterData.name}`);
      buildSheet(characterData);

      // Reload tabs to update active state (don't rebuild the sheet)
      debug.log(`🔄 Reloading tabs to update active state`);
      await loadAndBuildTabs();

      // Register this character with GM Initiative Tracker (if it exists)
      // Use postMessage to avoid CORS issues - send character name only
      if (window.opener) {
        window.opener.postMessage({
          action: 'registerPopup',
          characterName: characterData.name
        }, '*');
        debug.log(`✅ Sent registration message for: ${characterData.name}`);
      } else {
        debug.warn(`⚠️ No window.opener available for: ${characterData.name}`);
      }

      // Check if it's currently this character's turn by reading recent chat
      // Add a small delay to ensure combat system has processed turn changes
      setTimeout(() => {
        checkCurrentTurnFromChat(characterData.name);
      }, 500);

      showNotification(`✅ Switched to ${characterData.name}`);
    } else {
      debug.error(`❌ No character data in response`);
      showNotification('❌ Character not found', 'error');
    }
  } catch (error) {
    debug.error('❌ Failed to switch character:', error);
    showNotification('❌ Failed to switch character', 'error');
  }
}

// Clear a character slot
async function clearCharacterSlot(slotId, slotNum) {
  if (!confirm(`Clear slot ${slotNum}? This will remove this character from the slot.`)) {
    return;
  }

  try {
    await browserAPI.runtime.sendMessage({
      action: 'clearCharacterData',
      characterId: slotId
    });

    showNotification(`✅ Slot ${slotNum} cleared`);

    // Reload tabs
    loadCharacterWithTabs();
  } catch (error) {
    debug.error('❌ Failed to clear slot:', error);
    showNotification('❌ Failed to clear slot', 'error');
  }
}

// Global advantage state
let advantageState = 'normal'; // 'advantage', 'normal', or 'disadvantage'

// Add event listeners for rest buttons and advantage toggle
document.addEventListener('DOMContentLoaded', () => {
  const shortRestBtn = document.getElementById('short-rest-btn');
  const longRestBtn = document.getElementById('long-rest-btn');

  if (shortRestBtn) {
    shortRestBtn.addEventListener('click', takeShortRest);
  }

  if (longRestBtn) {
    longRestBtn.addEventListener('click', takeLongRest);
  }

  // Advantage toggle buttons
  const advantageBtn = document.getElementById('advantage-btn');
  const normalBtn = document.getElementById('normal-btn');
  const disadvantageBtn = document.getElementById('disadvantage-btn');

  if (advantageBtn) {
    advantageBtn.addEventListener('click', () => setAdvantageState('advantage'));
  }

  if (normalBtn) {
    normalBtn.addEventListener('click', () => setAdvantageState('normal'));
  }

  if (disadvantageBtn) {
    disadvantageBtn.addEventListener('click', () => setAdvantageState('disadvantage'));
  }
});

function setAdvantageState(state) {
  advantageState = state;

  const advantageBtn = document.getElementById('advantage-btn');
  const normalBtn = document.getElementById('normal-btn');
  const disadvantageBtn = document.getElementById('disadvantage-btn');

  // Reset all buttons
  [advantageBtn, normalBtn, disadvantageBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      const color = btn.id.includes('advantage') ? 'var(--accent-success)' :
                   btn.id.includes('normal') ? '#3498db' :
                   'var(--accent-danger)';
      btn.style.background = 'transparent';
      btn.style.color = color;
      btn.style.borderColor = color;
    }
  });

  // Highlight active button
  const activeBtn = state === 'advantage' ? advantageBtn :
                   state === 'normal' ? normalBtn :
                   disadvantageBtn;

  if (activeBtn) {
    activeBtn.classList.add('active');
    const color = state === 'advantage' ? 'var(--accent-success)' :
                 state === 'normal' ? '#3498db' :
                 'var(--accent-danger)';
    activeBtn.style.background = color;
    activeBtn.style.color = 'white';
  }

  debug.log(`🎲 Advantage state set to: ${state}`);
  showNotification(`🎲 ${state === 'advantage' ? 'Advantage' : state === 'disadvantage' ? 'Disadvantage' : 'Normal'} rolls selected`);
}

function buildSheet(data) {
  debug.log('Building character sheet...');
  debug.log('📊 Character data received:', data);
  debug.log('✨ Spell slots data:', data.spellSlots);

  // Safety check: Ensure critical DOM elements exist before building
  const charNameEl = document.getElementById('char-name');
  if (!charNameEl) {
    debug.error('❌ Critical DOM elements not found! DOM may not be ready yet.');
    debug.log('⏳ Queuing buildSheet for when DOM is ready...');
    if (!domReady) {
      pendingOperations.push(() => buildSheet(data));
    } else {
      // DOM claims to be ready but elements aren't there - retry after a short delay
      debug.log('⏱️ DOM ready but elements missing - retrying in 100ms...');
      setTimeout(() => buildSheet(data), 100);
    }
    return;
  }

  // Initialize concentration from saved data
  if (data.concentration) {
    concentratingSpell = data.concentration;
    updateConcentrationDisplay();
    debug.log(`🧠 Restored concentration: ${concentratingSpell}`);
  } else {
    concentratingSpell = null;
    updateConcentrationDisplay();
  }

  // Character name
  charNameEl.textContent = data.name || 'Character';

  // Update color picker emoji in systems bar
  const currentColorEmoji = getColorEmoji(data.notificationColor || '#3498db');
  const colorEmojiEl = document.getElementById('color-emoji');
  if (colorEmojiEl) {
    colorEmojiEl.textContent = currentColorEmoji;
  }

  // Populate color palette in systems bar (but keep it hidden initially)
  const colorPaletteEl = document.getElementById('color-palette');
  if (colorPaletteEl) {
    colorPaletteEl.innerHTML = createColorPalette(data.notificationColor || '#3498db');
    colorPaletteEl.style.display = 'none'; // Start hidden - user must click to show
    colorPaletteEl.style.gridTemplateColumns = 'repeat(4, 1fr)';
    colorPaletteEl.style.gap = '10px';
    colorPaletteEl.style.width = '180px';
  }

  // Initialize hit dice if needed
  initializeHitDice();

  // Initialize temporary HP if needed
  if (data.temporaryHP === undefined) {
    data.temporaryHP = 0;
  }

  // Initialize inspiration if needed
  if (data.inspiration === undefined) {
    data.inspiration = false;
  }

  // Initialize last roll tracking for heroic inspiration
  if (data.lastRoll === undefined) {
    data.lastRoll = null;
  }

  // Capitalize race name - handle both string and object formats
  let raceName = 'Unknown';
  if (data.race) {
    if (typeof data.race === 'string') {
      raceName = data.race.charAt(0).toUpperCase() + data.race.slice(1);
    } else if (typeof data.race === 'object') {
      // If race is an object, try to extract the value from various possible properties
      let raceValue = data.race.value || data.race.name || data.race.text ||
                      data.race.variableName || data.race.displayName;

      // If still no value, try to get something useful from the object
      if (!raceValue) {
        // Check if it has a tags property that might indicate race type
        if (data.race.tags && Array.isArray(data.race.tags)) {
          const raceTags = data.race.tags.filter(tag =>
            !tag.toLowerCase().includes('class') &&
            !tag.toLowerCase().includes('level')
          );
          if (raceTags.length > 0) {
            raceValue = raceTags[0];
          }
        }

        // Last resort: look for any string property that seems like a race name
        if (!raceValue) {
          const keys = Object.keys(data.race);
          for (const key of keys) {
            if (typeof data.race[key] === 'string' && data.race[key].length > 0 && data.race[key].length < 50) {
              raceValue = data.race[key];
              break;
            }
          }
        }
      }

      // If we found something, capitalize it; otherwise use "Unknown"
      if (raceValue && typeof raceValue === 'string') {
        raceName = raceValue.charAt(0).toUpperCase() + raceValue.slice(1);
      } else {
        debug.warn('Could not extract race name from object:', data.race);
        raceName = 'Unknown Race';
      }
    }
  }

  // Layer 1: Class, Level, Race, Hit Dice
  document.getElementById('char-class').textContent = data.class || 'Unknown';
  document.getElementById('char-level').textContent = data.level || 1;
  document.getElementById('char-race').textContent = raceName;
  document.getElementById('char-hit-dice').textContent = `${data.hitDice.current}/${data.hitDice.max} ${data.hitDice.type}`;

  // Layer 2: AC, Speed, Proficiency, Death Saves, Inspiration
  document.getElementById('char-ac').textContent = calculateTotalAC();
  document.getElementById('char-speed').textContent = `${data.speed || 30} ft`;
  document.getElementById('char-proficiency').textContent = `+${data.proficiencyBonus || 0}`;

  // Death Saves
  const deathSavesDisplay = document.getElementById('death-saves-display');
  const deathSavesValue = document.getElementById('death-saves-value');
  deathSavesValue.innerHTML = `
    <span style="color: var(--accent-success);">✓${data.deathSaves.successes || 0}</span> /
    <span style="color: var(--accent-danger);">✗${data.deathSaves.failures || 0}</span>
  `;
  if (data.deathSaves.successes > 0 || data.deathSaves.failures > 0) {
    deathSavesDisplay.style.background = 'var(--bg-action)';
  } else {
    deathSavesDisplay.style.background = 'var(--bg-tertiary)';
  }

  // Inspiration
  const inspirationDisplay = document.getElementById('inspiration-display');
  const inspirationValue = document.getElementById('inspiration-value');
  if (data.inspiration) {
    inspirationValue.textContent = '⭐ Active';
    inspirationValue.style.color = '#f57f17';
    inspirationDisplay.style.background = '#fff9c4';
  } else {
    inspirationValue.textContent = '☆ None';
    inspirationValue.style.color = 'var(--text-muted)';
    inspirationDisplay.style.background = 'var(--bg-tertiary)';
  }

  // Layer 3: Hit Points
  const hpValue = document.getElementById('hp-value');
  hpValue.textContent = `${data.hitPoints.current}${data.temporaryHP > 0 ? `+${data.temporaryHP}` : ''} / ${data.hitPoints.max}`;

  // Initiative
  const initiativeValue = document.getElementById('initiative-value');
  initiativeValue.textContent = `+${data.initiative || 0}`;

  // Remove old event listeners by cloning and replacing elements
  // This prevents duplicate listeners when buildSheet() is called multiple times
  const hpDisplayOld = document.getElementById('hp-display');
  const hpDisplayNew = hpDisplayOld.cloneNode(true);
  hpDisplayOld.parentNode.replaceChild(hpDisplayNew, hpDisplayOld);

  const initiativeOld = document.getElementById('initiative-button');
  const initiativeNew = initiativeOld.cloneNode(true);
  initiativeOld.parentNode.replaceChild(initiativeNew, initiativeOld);

  const deathSavesOld = document.getElementById('death-saves-display');
  const deathSavesNew = deathSavesOld.cloneNode(true);
  deathSavesOld.parentNode.replaceChild(deathSavesNew, deathSavesOld);

  const inspirationOld = document.getElementById('inspiration-display');
  const inspirationNew = inspirationOld.cloneNode(true);
  inspirationOld.parentNode.replaceChild(inspirationNew, inspirationOld);

  // Add click handler for HP display
  hpDisplayNew.addEventListener('click', showHPModal);

  // Add click handler for initiative button
  initiativeNew.addEventListener('click', () => {
    const initiativeBonus = data.initiative || 0;
    roll('Initiative', `1d20+${initiativeBonus}`);
  });

  // Add click handler for death saves display
  deathSavesNew.addEventListener('click', showDeathSavesModal);

  // Add click handler for inspiration display
  inspirationNew.addEventListener('click', toggleInspiration);

  // Update HP display color based on percentage
  const hpPercent = (data.hitPoints.current / data.hitPoints.max) * 100;
  // Use the new hpDisplayNew element we just created above
  if (hpPercent > 50) {
    hpDisplayNew.style.background = 'var(--accent-success)';
  } else if (hpPercent > 25) {
    hpDisplayNew.style.background = 'var(--accent-warning)';
  } else {
    hpDisplayNew.style.background = 'var(--accent-danger)';
  }

  // Resources
  buildResourcesDisplay();

  // Spell Slots
  buildSpellSlotsDisplay();

  // Abilities
  const abilitiesGrid = document.getElementById('abilities-grid');
  abilitiesGrid.innerHTML = ''; // Clear existing
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  abilities.forEach(ability => {
    const score = data.attributes?.[ability] || 10;
    const mod = data.attributeMods?.[ability] || 0;
    const card = createCard(ability.substring(0, 3).toUpperCase(), score, `+${mod}`, () => {
      roll(`${ability.charAt(0).toUpperCase() + ability.slice(1)} Check`, `1d20+${mod}`);
    });
    abilitiesGrid.appendChild(card);
  });

  // Saves
  const savesGrid = document.getElementById('saves-grid');
  savesGrid.innerHTML = ''; // Clear existing
  abilities.forEach(ability => {
    const bonus = data.savingThrows?.[ability] || 0;
    const card = createCard(`${ability.substring(0, 3).toUpperCase()}`, `+${bonus}`, '', () => {
      roll(`${ability.toUpperCase()} Save`, `1d20+${bonus}`);
    });
    savesGrid.appendChild(card);
  });

  // Skills - deduplicate and show unique skills only
  const skillsGrid = document.getElementById('skills-grid');
  skillsGrid.innerHTML = ''; // Clear existing

  // Create a map to deduplicate skills (in case data has duplicates)
  const uniqueSkills = new Map();
  Object.entries(data.skills || {}).forEach(([skill, bonus]) => {
    const normalizedSkill = skill.toLowerCase().trim();
    // Only keep the skill if we haven't seen it, or if this bonus is higher
    if (!uniqueSkills.has(normalizedSkill) || bonus > uniqueSkills.get(normalizedSkill).bonus) {
      uniqueSkills.set(normalizedSkill, { skill, bonus });
    }
  });

  // Sort skills alphabetically and display
  const sortedSkills = Array.from(uniqueSkills.values()).sort((a, b) =>
    a.skill.localeCompare(b.skill)
  );

  sortedSkills.forEach(({ skill, bonus }) => {
    const displayName = skill.charAt(0).toUpperCase() + skill.slice(1).replace(/-/g, ' ');
    const card = createCard(displayName, `${bonus >= 0 ? '+' : ''}${bonus}`, '', () => {
      roll(displayName, `1d20${bonus >= 0 ? '+' : ''}${bonus}`);
    });
    skillsGrid.appendChild(card);
  });

  // Actions & Attacks
  const actionsContainer = document.getElementById('actions-container');
  if (data.actions && data.actions.length > 0) {
    buildActionsDisplay(actionsContainer, data.actions);
  } else {
    actionsContainer.innerHTML = '<p style="text-align: center; color: #666;">No actions available</p>';
  }

  // Companions (Animal Companions, Familiars, Summons, etc.)
  if (data.companions && data.companions.length > 0) {
    buildCompanionsDisplay(data.companions);
  } else {
    // Hide companions section if character has no companions
    const companionsSection = document.getElementById('companions-section');
    const companionsContainer = document.getElementById('companions-container');
    if (companionsSection) {
      companionsSection.style.display = 'none';
    }
    if (companionsContainer) {
      companionsContainer.innerHTML = '';
    }
  }

  // Inventory & Equipment
  const inventoryContainer = document.getElementById('inventory-container');
  if (data.inventory && data.inventory.length > 0) {
    buildInventoryDisplay(inventoryContainer, data.inventory);
  } else {
    inventoryContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No items in inventory</p>';
  }

  // Spells - organized by source then level
  const spellsContainer = document.getElementById('spells-container');
  if (data.spells && data.spells.length > 0) {
    buildSpellsBySource(spellsContainer, data.spells);
    expandSectionByContainerId('spells-container');
  } else {
    spellsContainer.innerHTML = '<p style="text-align: center; color: #666;">No spells available</p>';
    // Collapse the section when empty
    collapseSectionByContainerId('spells-container');
  }

  // Restore active effects from character data
  if (data.activeEffects) {
    activeBuffs = data.activeEffects.buffs || [];
    activeConditions = data.activeEffects.debuffs || [];
    debug.log('✅ Restored active effects:', { buffs: activeBuffs, debuffs: activeConditions });
  } else {
    activeBuffs = [];
    activeConditions = [];
  }
  
  // Sync conditions from Dicecloud (if any were detected as active)
  if (data.conditions && data.conditions.length > 0) {
    debug.log('✨ Syncing conditions from Dicecloud:', data.conditions);
    data.conditions.forEach(condition => {
      // Map Dicecloud condition names to our effect names
      const conditionName = condition.name;
      const isPositive = POSITIVE_EFFECTS.some(e => e.name === conditionName);
      const isNegative = NEGATIVE_EFFECTS.some(e => e.name === conditionName);
      
      if (isPositive && !activeBuffs.includes(conditionName)) {
        activeBuffs.push(conditionName);
        debug.log(`  ✅ Added buff from Dicecloud: ${conditionName}`);
      } else if (isNegative && !activeConditions.includes(conditionName)) {
        activeConditions.push(conditionName);
        debug.log(`  ✅ Added debuff from Dicecloud: ${conditionName}`);
      }
    });
  }
  
  updateEffectsDisplay();

  // Initialize color palette after sheet is built
  initColorPalette();

  // Initialize filter event listeners
  initializeFilters();

  debug.log('✅ Sheet built successfully');
}

function buildSpellsBySource(container, spells) {
  debug.log(`📚 buildSpellsBySource called with ${spells.length} spells`);
  debug.log(`📚 Spell names: ${spells.map(s => s.name).join(', ')}`);

  // Debug: Check for Eldritch Blast damageRolls
  const eldritchBlast = spells.find(s => s.name && s.name.toLowerCase().includes('eldritch blast'));
  if (eldritchBlast) {
    console.log('⚡ ELDRITCH BLAST DATA IN POPUP:', {
      name: eldritchBlast.name,
      attackRoll: eldritchBlast.attackRoll,
      damageRolls: eldritchBlast.damageRolls,
      damageRollsLength: eldritchBlast.damageRolls ? eldritchBlast.damageRolls.length : 'undefined',
      damageRollsJSON: JSON.stringify(eldritchBlast.damageRolls)
    });
  }

  // Apply filters first
  let filteredSpells = spells.filter(spell => {
    // Filter by spell level
    if (spellFilters.level !== 'all') {
      const spellLevel = parseInt(spell.level) || 0;
      if (spellLevel.toString() !== spellFilters.level) {
        return false;
      }
    }
    
    // Filter by category
    if (spellFilters.category !== 'all') {
      const category = categorizeSpell(spell);
      if (category !== spellFilters.category) {
        return false;
      }
    }

    // Filter by casting time
    if (spellFilters.castingTime !== 'all') {
      const castingTime = (spell.castingTime || '').toLowerCase();
      if (spellFilters.castingTime === 'action') {
        // Match "action" but exclude "bonus action" and "reaction"
        if (!castingTime.includes('action') || castingTime.includes('bonus') || castingTime.includes('reaction')) {
          return false;
        }
      }
      if (spellFilters.castingTime === 'bonus' && !castingTime.includes('bonus')) {
        return false;
      }
      if (spellFilters.castingTime === 'reaction' && !castingTime.includes('reaction')) {
        return false;
      }
    }

    // Filter by search term
    if (spellFilters.search) {
      const searchLower = spellFilters.search;
      const name = (spell.name || '').toLowerCase();
      const desc = (spell.description || '').toLowerCase();
      if (!name.includes(searchLower) && !desc.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });

  debug.log(`🔍 Filtered ${spells.length} spells to ${filteredSpells.length} spells`);

  // Group spells by actual spell level (not source)
  const spellsByLevel = {};

  filteredSpells.forEach((spell, index) => {
    // Add index to spell for tracking
    spell.index = index;

    // Use spell level for grouping
    const spellLevel = parseInt(spell.level) || 0;
    const levelKey = spellLevel === 0 ? 'Cantrips' : `Level ${spellLevel} Spells`;

    if (!spellsByLevel[levelKey]) {
      spellsByLevel[levelKey] = [];
    }
    spellsByLevel[levelKey].push(spell);
  });

  // Clear container
  container.innerHTML = '';

  // Sort by spell level (cantrips first, then 1-9)
  const sortedLevels = Object.keys(spellsByLevel).sort((a, b) => {
    if (a === 'Cantrips') return -1;
    if (b === 'Cantrips') return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  sortedLevels.forEach(levelKey => {
    // Create level section
    const levelSection = document.createElement('div');
    levelSection.style.cssText = 'margin-bottom: 20px;';

    const levelHeader = document.createElement('h4');
    levelHeader.textContent = `📚 ${levelKey}`;
    levelHeader.style.cssText = 'color: #2c3e50; margin-bottom: 10px; padding: 5px; background: #ecf0f1; border-radius: 4px;';
    levelSection.appendChild(levelHeader);

    // Sort spells alphabetically within level
    const sortedSpells = spellsByLevel[levelKey].sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });

    // Deduplicate spells by name and combine sources
    const deduplicatedSpells = [];
    const spellsByName = {};

    debug.log(`📚 Deduplicating ${sortedSpells.length} spells in ${levelKey}`);
    sortedSpells.forEach(spell => {
      const spellName = spell.name || 'Unnamed Spell';

      if (!spellsByName[spellName]) {
        // First occurrence of this spell
        spellsByName[spellName] = spell;
        deduplicatedSpells.push(spell);
        debug.log(`📚 First occurrence: "${spellName}"`);
      } else {
        // Duplicate spell - combine sources
        const existingSpell = spellsByName[spellName];
        debug.log(`📚 Found duplicate: "${spellName}" - combining sources`);
        if (spell.source && !existingSpell.source.includes(spell.source)) {
          existingSpell.source += '; ' + spell.source;
          debug.log(`📚 Combined duplicate spell "${spellName}": ${existingSpell.source}`);
        }
      }
    });
    debug.log(`📚 After deduplication: ${deduplicatedSpells.length} unique spells in ${levelKey}`);

    // Add deduplicated spells
    deduplicatedSpells.forEach(spell => {
      const spellCard = createSpellCard(spell, spell.index);
      levelSection.appendChild(spellCard);
    });

    container.appendChild(levelSection);
  });
}

// Store Sneak Attack toggle state (independent from DiceCloud - controlled only by our sheet)
let sneakAttackEnabled = false;  // Always starts unchecked - user manually enables when needed
let sneakAttackDamage = '';

// Store Elemental Weapon toggle state (independent from DiceCloud - controlled only by our sheet)
let elementalWeaponEnabled = false;  // Always starts unchecked - user manually enables when needed
let elementalWeaponDamage = '1d4';  // Default to level 3 (base damage)

// Filter state for actions
let actionFilters = {
  actionType: 'all',
  category: 'all',
  search: ''
};

// Filter state for spells
let spellFilters = {
  level: 'all',
  category: 'all',
  castingTime: 'all',
  search: ''
};

// Filter state for inventory (default to equipped only)
let inventoryFilters = {
  filter: 'equipped', // all, equipped, attuned, container
  search: ''
};

// Helper function to categorize an action
function categorizeAction(action) {
  const name = (action.name || '').toLowerCase();
  const damageType = (action.damageType || '').toLowerCase();

  // Check for healing based on damage type or name
  if (damageType.includes('heal') || name.includes('heal') || name.includes('cure')) {
    return 'healing';
  }

  // Check for damage based on actual damage formula
  if (action.damage && action.damage.includes('d')) {
    return 'damage';
  }

  // Everything else is utility
  return 'utility';
}

// Helper function to categorize a spell
function categorizeSpell(spell) {
  // Use actual spell data instead of string matching in description
  // Check damageRolls array to determine if it's damage or healing
  if (spell.damageRolls && Array.isArray(spell.damageRolls) && spell.damageRolls.length > 0) {
    // Check if any damage roll is healing
    const hasHealing = spell.damageRolls.some(roll =>
      roll.damageType && roll.damageType.toLowerCase() === 'healing'
    );

    // Check if any damage roll is actual damage (not healing)
    const hasDamage = spell.damageRolls.some(roll =>
      !roll.damageType || roll.damageType.toLowerCase() !== 'healing'
    );

    // Categorize based on what the spell actually does
    if (hasHealing && !hasDamage) {
      return 'healing';
    } else if (hasDamage) {
      return 'damage';
    }
  }

  // Check for attack roll (attack spells are damage)
  if (spell.attackRoll && spell.attackRoll !== '(none)') {
    return 'damage';
  }

  // Everything else is utility (no damage rolls, no attack roll)
  return 'utility';
}

// Initialize filter event listeners
function initializeFilters() {
  // Actions filters
  const actionsSearch = document.getElementById('actions-search');
  if (actionsSearch) {
    actionsSearch.addEventListener('input', (e) => {
      actionFilters.search = e.target.value.toLowerCase();
      rebuildActions();
    });
  }
  
  // Action type filters
  document.querySelectorAll('[data-type="action-type"]').forEach(btn => {
    btn.addEventListener('click', () => {
      actionFilters.actionType = btn.dataset.filter;
      document.querySelectorAll('[data-type="action-type"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildActions();
    });
  });
  
  // Action category filters
  document.querySelectorAll('[data-type="action-category"]').forEach(btn => {
    btn.addEventListener('click', () => {
      actionFilters.category = btn.dataset.filter;
      document.querySelectorAll('[data-type="action-category"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildActions();
    });
  });
  
  // Spells filters
  const spellsSearch = document.getElementById('spells-search');
  if (spellsSearch) {
    spellsSearch.addEventListener('input', (e) => {
      spellFilters.search = e.target.value.toLowerCase();
      rebuildSpells();
    });
  }
  
  // Spell level filters
  document.querySelectorAll('[data-type="spell-level"]').forEach(btn => {
    btn.addEventListener('click', () => {
      spellFilters.level = btn.dataset.filter;
      document.querySelectorAll('[data-type="spell-level"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildSpells();
    });
  });
  
  // Spell category filters
  document.querySelectorAll('[data-type="spell-category"]').forEach(btn => {
    btn.addEventListener('click', () => {
      spellFilters.category = btn.dataset.filter;
      document.querySelectorAll('[data-type="spell-category"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildSpells();
    });
  });

  // Spell casting time filters
  document.querySelectorAll('[data-type="spell-casting-time"]').forEach(btn => {
    btn.addEventListener('click', () => {
      spellFilters.castingTime = btn.dataset.filter;
      document.querySelectorAll('[data-type="spell-casting-time"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildSpells();
    });
  });

  // Inventory filters
  const inventorySearch = document.getElementById('inventory-search');
  if (inventorySearch) {
    inventorySearch.addEventListener('input', (e) => {
      inventoryFilters.search = e.target.value.toLowerCase();
      rebuildInventory();
    });
  }

  // Inventory type filters
  document.querySelectorAll('[data-type="inventory-filter"]').forEach(btn => {
    btn.addEventListener('click', () => {
      inventoryFilters.filter = btn.dataset.filter;
      document.querySelectorAll('[data-type="inventory-filter"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rebuildInventory();
    });
  });
}

// Rebuild actions with current filters
function rebuildActions() {
  if (!characterData || !characterData.actions) return;
  const container = document.getElementById('actions-container');
  buildActionsDisplay(container, characterData.actions);
}

// Rebuild spells with current filters
function rebuildSpells() {
  if (!characterData || !characterData.spells) return;
  const container = document.getElementById('spells-container');
  buildSpellsBySource(container, characterData.spells);
}

// Rebuild inventory with current filters
function rebuildInventory() {
  if (!characterData || !characterData.inventory) return;
  const container = document.getElementById('inventory-container');
  buildInventoryDisplay(container, characterData.inventory);
}

/**
 * Get available action options (attack/damage rolls) with edge case modifications
 */
function getActionOptions(action) {
  const options = [];

  // Check for attack
  if (action.attackRoll) {
    // Convert to full formula if it's just a number (legacy data)
    let formula = action.attackRoll;
    if (typeof formula === 'number' || !formula.includes('d20')) {
      const bonus = parseInt(formula);
      formula = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
    }

    options.push({
      type: 'attack',
      label: '🎯 Attack',
      formula: formula,
      icon: '🎯',
      color: '#e74c3c'
    });
  }

  // Check for damage/healing rolls
  const isValidDiceFormula = action.damage && (/\d*d\d+/.test(action.damage) || /\d*d\d+/.test(action.damage.replace(/\s*\+\s*/g, '+')));
  debug.log(`🎲 Action "${action.name}" damage check:`, {
    damage: action.damage,
    isValid: isValidDiceFormula,
    attackRoll: action.attackRoll
  });
  if (isValidDiceFormula) {
    const isHealing = action.damageType && action.damageType.toLowerCase().includes('heal');
    const isTempHP = action.damageType && (
      action.damageType.toLowerCase() === 'temphp' ||
      action.damageType.toLowerCase() === 'temporary' ||
      action.damageType.toLowerCase().includes('temp')
    );

    // Use different text for healing vs damage vs features
    let btnText;
    if (isHealing) {
      btnText = '💚 Heal';
    } else if (action.actionType === 'feature' || !action.attackRoll) {
      btnText = '🎲 Roll';
    } else {
      btnText = '💥 Damage';
    }

    options.push({
      type: isHealing ? 'healing' : (isTempHP ? 'temphp' : 'damage'),
      label: btnText,
      formula: action.damage,
      icon: isTempHP ? '🛡️' : (isHealing ? '💚' : '💥'),
      color: isTempHP ? '#3498db' : (isHealing ? '#27ae60' : '#e67e22')
    });
  }

  // Apply edge case modifications
  let edgeCaseResult;
  
  // Check class feature edge cases first
  if (isClassFeatureEdgeCase(action.name)) {
    edgeCaseResult = applyClassFeatureEdgeCaseModifications(action, options);
  }
  // Check racial feature edge cases
  else if (isRacialFeatureEdgeCase(action.name)) {
    edgeCaseResult = applyRacialFeatureEdgeCaseModifications(action, options);
  }
  // Check combat maneuver edge cases
  else if (isCombatManeuverEdgeCase(action.name)) {
    edgeCaseResult = applyCombatManeuverEdgeCaseModifications(action, options);
  }
  // Default - no edge cases
  else {
    edgeCaseResult = { options, skipNormalButtons: false };
  }

  return edgeCaseResult;
}

function buildActionsDisplay(container, actions) {
  // Clear container
  container.innerHTML = '';

  // DEBUG: Log all actions to see what we have
  debug.log('🔍 buildActionsDisplay called with actions:', actions.map(a => ({ name: a.name, damage: a.damage, actionType: a.actionType })));

  // Deduplicate actions by name and combine sources (similar to spells)
  const deduplicatedActions = [];
  const actionsByName = {};

  // Sort actions by name for consistent processing
  const sortedActions = [...actions].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  sortedActions.forEach(action => {
    const actionName = (action.name || '').trim();
    
    if (!actionName) {
      debug.log('⚠️ Skipping action with no name');
      return;
    }

    if (!actionsByName[actionName]) {
      // First occurrence of this action
      actionsByName[actionName] = action;
      deduplicatedActions.push(action);
      debug.log(`📝 First occurrence of action: "${actionName}"`);
    } else {
      // Duplicate action - combine sources and other properties
      const existingAction = actionsByName[actionName];
      
      // Combine sources if they exist
      if (action.source && !existingAction.source.includes(action.source)) {
        existingAction.source = existingAction.source 
          ? existingAction.source + '; ' + action.source 
          : action.source;
        debug.log(`📝 Combined duplicate action "${actionName}": ${existingAction.source}`);
      }
      
      // Combine descriptions if they exist and are different
      if (action.description && action.description !== existingAction.description) {
        existingAction.description = existingAction.description 
          ? existingAction.description + '\n\n' + action.description 
          : action.description;
        debug.log(`📝 Combined descriptions for "${actionName}"`);
      }
      
      // Merge other useful properties
      if (action.uses && !existingAction.uses) {
        existingAction.uses = action.uses;
        debug.log(`📝 Added uses to "${actionName}"`);
      }
      
      if (action.damage && !existingAction.damage) {
        existingAction.damage = action.damage;
        debug.log(`📝 Added damage to "${actionName}"`);
      }
      
      if (action.attackRoll && !existingAction.attackRoll) {
        existingAction.attackRoll = action.attackRoll;
        debug.log(`📝 Added attackRoll to "${actionName}"`);
      }
      
      debug.log(`🔄 Merged duplicate action: "${actionName}"`);
    }
  });

  debug.log(`📊 Deduplicated ${actions.length} actions to ${deduplicatedActions.length} unique actions`);

  // Apply filters
  let filteredActions = deduplicatedActions.filter(action => {
    // Filter by action type
    if (actionFilters.actionType !== 'all') {
      const actionType = (action.actionType || '').toLowerCase();
      if (actionType !== actionFilters.actionType) {
        return false;
      }
    }
    
    // Filter by category
    if (actionFilters.category !== 'all') {
      const category = categorizeAction(action);
      if (category !== actionFilters.category) {
        return false;
      }
    }
    
    // Filter by search term
    if (actionFilters.search) {
      const searchLower = actionFilters.search;
      const name = (action.name || '').toLowerCase();
      const desc = (action.description || '').toLowerCase();
      if (!name.includes(searchLower) && !desc.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });

  debug.log(`🔍 Filtered ${deduplicatedActions.length} actions to ${filteredActions.length} actions`);

  // Check if character has Sneak Attack available (from DiceCloud)
  // We only check if it EXISTS, not whether it's enabled on DiceCloud
  // The toggle state on our sheet is independent and user-controlled
  // Use flexible matching in case the name has slight variations
  const sneakAttackAction = deduplicatedActions.find(a =>
    a.name === 'Sneak Attack' ||
    a.name.toLowerCase().includes('sneak attack')
  );
  debug.log('🎯 Sneak Attack search result:', sneakAttackAction);
  if (sneakAttackAction && sneakAttackAction.damage) {
    sneakAttackDamage = sneakAttackAction.damage;

    // Resolve variables in the damage formula for display
    const resolvedDamage = resolveVariablesInFormula(sneakAttackDamage);
    debug.log(`🎯 Sneak Attack damage: "${sneakAttackDamage}" resolved to "${resolvedDamage}"`);

    // Add toggle section at the top of actions
    const toggleSection = document.createElement('div');
    toggleSection.style.cssText = 'background: #2c3e50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;';

    const toggleLabel = document.createElement('label');
    toggleLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: bold;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'sneak-attack-toggle';
    checkbox.checked = sneakAttackEnabled;  // Always starts false - IGNORES DiceCloud toggle state
    checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    checkbox.addEventListener('change', (e) => {
      sneakAttackEnabled = e.target.checked;
      debug.log(`🎯 Sneak Attack toggle on our sheet: ${sneakAttackEnabled ? 'ON' : 'OFF'} (independent of DiceCloud)`);
    });

    const labelText = document.createElement('span');
    labelText.textContent = `Add Sneak Attack (${resolvedDamage}) to weapon damage`;

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(labelText);
    toggleSection.appendChild(toggleLabel);
    container.appendChild(toggleSection);
  }

  // Check if character has Elemental Weapon spell prepared (check spells list)
  // We only check if it EXISTS, the toggle is user-controlled
  const hasElementalWeapon = characterData.spells && characterData.spells.some(s =>
    s.name === 'Elemental Weapon' || (s.spell && s.spell.name === 'Elemental Weapon')
  );

  if (hasElementalWeapon) {
    debug.log(`⚔️ Elemental Weapon spell found, adding toggle`);

    // Add toggle section for Elemental Weapon
    const elementalToggleSection = document.createElement('div');
    elementalToggleSection.style.cssText = 'background: #8b4513; color: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;';

    const elementalToggleLabel = document.createElement('label');
    elementalToggleLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: bold;';

    const elementalCheckbox = document.createElement('input');
    elementalCheckbox.type = 'checkbox';
    elementalCheckbox.id = 'elemental-weapon-toggle';
    elementalCheckbox.checked = elementalWeaponEnabled;  // Always starts false
    elementalCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    elementalCheckbox.addEventListener('change', (e) => {
      elementalWeaponEnabled = e.target.checked;
      debug.log(`⚔️ Elemental Weapon toggle: ${elementalWeaponEnabled ? 'ON' : 'OFF'}`);
    });

    const elementalLabelText = document.createElement('span');
    elementalLabelText.textContent = `Add Elemental Weapon (${elementalWeaponDamage}) to weapon damage`;

    elementalToggleLabel.appendChild(elementalCheckbox);
    elementalToggleLabel.appendChild(elementalLabelText);
    elementalToggleSection.appendChild(elementalToggleLabel);
    container.appendChild(elementalToggleSection);
  }

  // Check if character has Lucky feat
  const hasLuckyFeat = characterData.features && characterData.features.some(f =>
    f.name && f.name.toLowerCase().includes('lucky')
  );

  if (hasLuckyFeat) {
    debug.log(`🎖️ Lucky feat found, adding action button`);

    // Add action button for Lucky feat
    const luckyActionSection = document.createElement('div');
    luckyActionSection.style.cssText = 'background: #f39c12; color: white; padding: 12px; border-radius: 5px; margin-bottom: 10px;';

    const luckyButton = document.createElement('button');
    luckyButton.id = 'lucky-action-button';
    luckyButton.style.cssText = `
      background: #e67e22;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      width: 100%;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    luckyButton.onmouseover = () => luckyButton.style.background = '#d35400';
    luckyButton.onmouseout = () => luckyButton.style.background = '#e67e22';

    // Update button text based on available luck points
    const luckyResource = getLuckyResource();
    const luckPointsAvailable = luckyResource ? luckyResource.current : 0;
    luckyButton.innerHTML = `
      <span style="font-size: 16px;">🎖️</span>
      <span>Use Lucky Point (${luckPointsAvailable}/3)</span>
    `;

    luckyButton.addEventListener('click', () => {
      const currentLuckyResource = getLuckyResource();
      if (!currentLuckyResource || currentLuckyResource.current <= 0) {
        showNotification('❌ No luck points available!', 'error');
        return;
      }

      // Show simple Lucky modal like metamagic
      showLuckyModal();
    });

    luckyActionSection.appendChild(luckyButton);
    container.appendChild(luckyActionSection);
  }

  filteredActions.forEach((action, index) => {
    // Skip rendering standalone Sneak Attack button if it exists
    if ((action.name === 'Sneak Attack' || action.name.toLowerCase().includes('sneak attack')) && action.actionType === 'feature') {
      debug.log('⏭️ Skipping standalone Sneak Attack button (using toggle instead)');
      return;
    }

    // Clean up weapon damage to remove sneak attack if it was auto-added
    // Pattern: remove any multi-dice formulas like "+3d6", "+4d6", etc. that come after the base damage
    if (action.damage && action.attackRoll && sneakAttackDamage) {
      // Remove the sneak attack damage pattern from weapon damage
      const sneakPattern = new RegExp(`\\+?${sneakAttackDamage.replace(/[+\-]/g, '')}`, 'g');
      const cleanedDamage = action.damage.replace(sneakPattern, '');
      if (cleanedDamage !== action.damage) {
        debug.log(`🧹 Cleaned weapon damage: "${action.damage}" -> "${cleanedDamage}"`);
        action.damage = cleanedDamage;
      }
    }

    const actionCard = document.createElement('div');
    actionCard.className = 'action-card';

    const actionHeader = document.createElement('div');
    actionHeader.className = 'action-header';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'action-name';

    // Show uses if available
    let nameText = action.name;

    // Rename "Recover Spell Slot" to "Harness Divine Power" (Cleric feature)
    if (nameText === 'Recover Spell Slot') {
      nameText = 'Harness Divine Power';
    }

    if (action.uses) {
      const usesTotal = action.uses.total || action.uses.value || action.uses;
      // Prefer usesLeft from DiceCloud if available, otherwise calculate from usesUsed
      const usesRemaining = action.usesLeft !== undefined ? action.usesLeft : (usesTotal - (action.usesUsed || 0));
      nameText += ` <span class="uses-badge">${usesRemaining}/${usesTotal} uses</span>`;
    }
    nameDiv.innerHTML = nameText;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'action-buttons';

    // Get action options with edge case modifications
    const actionOptionsResult = getActionOptions(action);
    const actionOptions = actionOptionsResult.options;

    // Check if this is a "utility only" action that should just announce
    if (actionOptionsResult.skipNormalButtons) {
      // Create simple action button for utility-only actions
      const actionBtn = document.createElement('button');
      actionBtn.className = 'action-btn';
      actionBtn.textContent = '✨ Use Action';
      actionBtn.style.cssText = `
        background: #9b59b6;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
      `;
      actionBtn.addEventListener('click', () => {
        // Check and decrement uses BEFORE announcing (so announcement shows correct count)
        if (action.uses && !decrementActionUses(action)) {
          return; // No uses remaining
        }

        // Check and decrement other resources
        if (!decrementActionResources(action)) {
          return; // Not enough resources
        }

        // Announce the action with description AFTER decrements
        announceAction(action);
      });
      buttonsDiv.appendChild(actionBtn);
    } else {
      // Create buttons for each action option
      actionOptions.forEach((option, optionIndex) => {
        const actionBtn = document.createElement('button');
        actionBtn.className = `${option.type}-btn`;

        // Add edge case note if present
        const edgeCaseNote = option.edgeCaseNote ? `<div style="font-size: 0.7em; color: #666; margin-top: 1px;">${option.edgeCaseNote}</div>` : '';
        actionBtn.innerHTML = `${option.label}${edgeCaseNote}`;

        actionBtn.style.cssText = `
          background: ${option.color};
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          margin-right: 4px;
          margin-bottom: 4px;
        `;

        actionBtn.addEventListener('click', () => {
          // Handle different option types
          if (option.type === 'attack') {
            // Mark action as used for attacks
            markActionAsUsed('action');

            // Add Sneak Attack if toggle is enabled and this is a weapon attack
            let attackFormula = option.formula;
            if (sneakAttackEnabled && sneakAttackDamage && action.attackRoll) {
              attackFormula += `+${sneakAttackDamage}`;
              debug.log(`🎯 Adding Sneak Attack to ${action.name}: ${attackFormula}`);
            }

            // Add Elemental Weapon if toggle is enabled and this is a weapon attack
            if (elementalWeaponEnabled && elementalWeaponDamage && action.attackRoll) {
              attackFormula += `+${elementalWeaponDamage}`;
              debug.log(`⚔️ Adding Elemental Weapon to ${action.name}: ${attackFormula}`);
            }
            
            roll(`${action.name} Attack`, attackFormula);
          } else if (option.type === 'healing' || option.type === 'temphp' || option.type === 'damage') {
            // Check and decrement uses before rolling
            if (action.uses && !decrementActionUses(action)) {
              return; // No uses remaining
            }

            // Check and decrement Ki points if action costs Ki
            const kiCost = getKiCostFromAction(action);
            if (kiCost > 0) {
              const kiResource = getKiPointsResource();
              if (!kiResource) {
                showNotification(`❌ No Ki Points resource found`, 'error');
                return;
              }
              if (kiResource.current < kiCost) {
                showNotification(`❌ Not enough Ki Points! Need ${kiCost}, have ${kiResource.current}`, 'error');
                return;
              }
              kiResource.current -= kiCost;
              saveCharacterData();
              debug.log(`✨ Used ${kiCost} Ki points for ${action.name}. Remaining: ${kiResource.current}/${kiResource.max}`);
              showNotification(`✨ ${action.name}! (${kiResource.current}/${kiResource.max} Ki left)`);
              buildSheet(characterData); // Refresh display
            }

            // Check and decrement Sorcery Points if action costs them
            const sorceryCost = getSorceryPointCostFromAction(action);
            if (sorceryCost > 0) {
              const sorceryResource = getSorceryPointsResource();
              if (!sorceryResource) {
                showNotification(`❌ No Sorcery Points resource found`, 'error');
                return;
              }
              if (sorceryResource.current < sorceryCost) {
                showNotification(`❌ Not enough Sorcery Points! Need ${sorceryCost}, have ${sorceryResource.current}`, 'error');
                return;
              }
              sorceryResource.current -= sorceryCost;
              saveCharacterData();
              debug.log(`✨ Used ${sorceryCost} Sorcery Points for ${action.name}. Remaining: ${sorceryResource.current}/${sorceryResource.max}`);
              showNotification(`✨ ${action.name}! (${sorceryResource.current}/${sorceryResource.max} SP left)`);
              buildSheet(characterData); // Refresh display
            }

            // Check and decrement other resources (Wild Shape, Breath Weapon, etc.)
            if (!decrementActionResources(action)) {
              return; // Not enough resources
            }

            // Only announce if this action has no attack roll (description was already announced on attack)
            if (action.description && !action.attackRoll) {
              announceAction(action);
            }

            // Roll the damage/healing
            const rollType = option.type === 'healing' ? 'Healing' : (option.type === 'temphp' ? 'Temp HP' : 'Damage');
            roll(`${action.name} ${rollType}`, option.formula);
          }
        });

        buttonsDiv.appendChild(actionBtn);
      });
    }

    // Add "Use" button for actions with no attack/damage but have descriptions
    if (actionOptions.length === 0 && action.description && !action.attackRoll && !action.damage) {
      const useBtn = document.createElement('button');
      useBtn.className = 'use-btn';
      useBtn.textContent = '✨ Use';
      useBtn.style.cssText = `
        background: #9b59b6;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
      `;
      useBtn.addEventListener('click', () => {
        // Special handling for Divine Spark
        if (action.name === 'Divine Spark') {
          // Find Channel Divinity resource from the resources array
          const channelDivinityResource = characterData.resources?.find(r =>
            r.name === 'Channel Divinity' ||
            r.variableName === 'channelDivinityCleric' ||
            r.variableName === 'channelDivinityPaladin' ||
            r.variableName === 'channelDivinity'
          );

          if (!channelDivinityResource) {
            showNotification('❌ No Channel Divinity resource found', 'error');
            return;
          }

          if (channelDivinityResource.current <= 0) {
            showNotification('❌ No Channel Divinity uses remaining!', 'error');
            return;
          }

          // Show the Divine Spark choice modal
          showDivineSparkModal(action, channelDivinityResource);
          return;
        }

        // Special handling for Harness Divine Power
        if (action.name === 'Harness Divine Power' || action.name === 'Recover Spell Slot') {
          // Find Channel Divinity resource from the resources array
          const channelDivinityResource = characterData.resources?.find(r =>
            r.name === 'Channel Divinity' ||
            r.variableName === 'channelDivinityCleric' ||
            r.variableName === 'channelDivinityPaladin' ||
            r.variableName === 'channelDivinity'
          );

          if (!channelDivinityResource) {
            showNotification('❌ No Channel Divinity resource found', 'error');
            return;
          }

          if (channelDivinityResource.current <= 0) {
            showNotification('❌ No Channel Divinity uses remaining!', 'error');
            return;
          }

          // Show the Harness Divine Power choice modal
          showHarnessDivinePowerModal(action, channelDivinityResource);
          return;
        }

        // Special handling for Elemental Weapon
        if (action.name === 'Elemental Weapon') {
          // Show the Elemental Weapon choice modal
          showElementalWeaponModal(action);
          return;
        }

        // Special handling for Divine Intervention
        if (action.name === 'Divine Intervention') {
          // Show the Divine Intervention modal
          showDivineInterventionModal(action);
          return;
        }

        // Special handling for Wild Shape
        if (action.name === 'Wild Shape' || action.name === 'Combat Wild Shape') {
          // Show the Wild Shape choice modal
          showWildShapeModal(action);
          return;
        }

        // Special handling for Shapechange
        if (action.name === 'Shapechange') {
          // Show the Shapechange choice modal
          showShapechangeModal(action);
          return;
        }

        // Special handling for True Polymorph
        if (action.name === 'True Polymorph') {
          // Show the True Polymorph choice modal
          showTruePolymorphModal(action);
          return;
        }

        // Special handling for Conjure Animals/Elementals/Fey/Celestial
        if (action.name && (
          action.name.includes('Conjure Animals') ||
          action.name.includes('Conjure Elemental') ||
          action.name.includes('Conjure Fey') ||
          action.name.includes('Conjure Celestial')
        )) {
          // Show the Conjure choice modal
          showConjureModal(action);
          return;
        }

        // Special handling for Planar Binding
        if (action.name === 'Planar Binding') {
          // Show the Planar Binding choice modal
          showPlanarBindingModal(action);
          return;
        }

        // Special handling for Teleport
        if (action.name === 'Teleport') {
          // Show the Teleport choice modal
          showTeleportModal(action);
          return;
        }

        // Special handling for Word of Recall
        if (action.name === 'Word of Recall') {
          // Show the Word of Recall choice modal
          showWordOfRecallModal(action);
          return;
        }

        // Special handling for Contingency
        if (action.name === 'Contingency') {
          // Show the Contingency choice modal
          showContingencyModal(action);
          return;
        }

        // Special handling for Glyph of Warding
        if (action.name === 'Glyph of Warding') {
          // Show the Glyph of Warding choice modal
          showGlyphOfWardingModal(action);
          return;
        }

        // Special handling for Symbol
        if (action.name === 'Symbol') {
          // Show the Symbol choice modal
          showSymbolModal(action);
          return;
        }

        // Special handling for Programmed Illusion
        if (action.name === 'Programmed Illusion') {
          // Show the Programmed Illusion choice modal
          showProgrammedIllusionModal(action);
          return;
        }

        // Special handling for Sequester
        if (action.name === 'Sequester') {
          // Show the Sequester choice modal
          showSequesterModal(action);
          return;
        }

        // Special handling for Clone
        if (action.name === 'Clone') {
          // Show the Clone choice modal
          showCloneModal(action);
          return;
        }

        // Special handling for Astral Projection
        if (action.name === 'Astral Projection') {
          // Show the Astral Projection choice modal
          showAstralProjectionModal(action);
          return;
        }

        // Special handling for Etherealness
        if (action.name === 'Etherealness') {
          // Show the Etherealness choice modal
          showEtherealnessModal(action);
          return;
        }

        // Special handling for Magic Jar
        if (action.name === 'Magic Jar') {
          // Show the Magic Jar choice modal
          showMagicJarModal(action);
          return;
        }

        // Special handling for Imprisonment
        if (action.name === 'Imprisonment') {
          // Show the Imprisonment choice modal
          showImprisonmentModal(action);
          return;
        }

        // Special handling for Time Stop
        if (action.name === 'Time Stop') {
          // Show the Time Stop choice modal
          showTimeStopModal(action);
          return;
        }

        // Special handling for Mirage Arcane
        if (action.name === 'Mirage Arcane') {
          // Show the Mirage Arcane choice modal
          showMirageArcaneModal(action);
          return;
        }

        // Special handling for Forcecage
        if (action.name === 'Forcecage') {
          // Show the Forcecage choice modal
          showForcecageModal(action);
          return;
        }

        // Special handling for Maze
        if (action.name === 'Maze') {
          // Show the Maze choice modal
          showMazeModal(action);
          return;
        }

        // Special handling for Wish
        if (action.name === 'Wish') {
          // Show the Wish choice modal
          showWishModal(action);
          return;
        }

        // Special handling for Simulacrum
        if (action.name === 'Simulacrum') {
          // Show the Simulacrum choice modal
          showSimulacrumModal(action);
          return;
        }

        // Special handling for Gate
        if (action.name === 'Gate') {
          // Show the Gate choice modal
          showGateModal(action);
          return;
        }

        // Special handling for Legend Lore
        if (action.name === 'Legend Lore') {
          // Show the Legend Lore choice modal
          showLegendLoreModal(action);
          return;
        }

        // Special handling for Commune
        if (action.name === 'Commune') {
          // Show the Commune choice modal
          showCommuneModal(action);
          return;
        }

        // Special handling for Augury
        if (action.name === 'Augury') {
          // Show the Augury choice modal
          showAuguryModal(action);
          return;
        }

        // Special handling for Divination
        if (action.name === 'Divination') {
          // Show the Divination choice modal
          showDivinationModal(action);
          return;
        }

        // Special handling for Contact Other Plane
        if (action.name === 'Contact Other Plane') {
          // Show the Contact Other Plane choice modal
          showContactOtherPlaneModal(action);
          return;
        }

        // Special handling for Find the Path
        if (action.name === 'Find the Path') {
          // Show the Find the Path choice modal
          showFindThePathModal(action);
          return;
        }

        // Special handling for Speak with Dead
        if (action.name === 'Speak with Dead') {
          // Show the Speak with Dead choice modal
          showSpeakWithDeadModal(action);
          return;
        }

        // Special handling for Speak with Animals
        if (action.name === 'Speak with Animals') {
          // Show the Speak with Animals choice modal
          showSpeakWithAnimalsModal(action);
          return;
        }

        // Special handling for Speak with Plants
        if (action.name === 'Speak with Plants') {
          // Show the Speak with Plants choice modal
          showSpeakWithPlantsModal(action);
          return;
        }

        // Special handling for Zone of Truth
        if (action.name === 'Zone of Truth') {
          // Show the Zone of Truth choice modal
          showZoneOfTruthModal(action);
          return;
        }

        // Special handling for Sending
        if (action.name === 'Sending') {
          // Show the Sending choice modal
          showSendingModal(action);
          return;
        }

        // Special handling for Dream
        if (action.name === 'Dream') {
          // Show the Dream choice modal
          showDreamModal(action);
          return;
        }

        // Special handling for Scrying
        if (action.name === 'Scrying') {
          // Show the Scrying choice modal
          showScryingModal(action);
          return;
        }

        // Special handling for Dispel Evil and Good
        if (action.name === 'Dispel Evil and Good') {
          // Show the Dispel Evil and Good choice modal
          showDispelEvilAndGoodModal(action);
          return;
        }

        // Special handling for Freedom of Movement
        if (action.name === 'Freedom of Movement') {
          // Show the Freedom of Movement choice modal
          showFreedomOfMovementModal(action);
          return;
        }

        // Special handling for Nondetection
        if (action.name === 'Nondetection') {
          // Show the Nondetection choice modal
          showNondetectionModal(action);
          return;
        }

        // Special handling for Protection from Energy
        if (action.name === 'Protection from Energy') {
          // Show the Protection from Energy choice modal
          showProtectionFromEnergyModal(action);
          return;
        }

        // Special handling for Protection from Evil and Good
        if (action.name === 'Protection from Evil and Good') {
          // Show the Protection from Evil and Good choice modal
          showProtectionFromEvilAndGoodModal(action);
          return;
        }

        // Special handling for Sanctuary
        if (action.name === 'Sanctuary') {
          // Show the Sanctuary choice modal
          showSanctuaryModal(action);
          return;
        }

        // Special handling for Silence
        if (action.name === 'Silence') {
          // Show the Silence choice modal
          showSilenceModal(action);
          return;
        }

        // Special handling for Magic Circle
        if (action.name === 'Magic Circle') {
          // Show the Magic Circle choice modal
          showMagicCircleModal(action);
          return;
        }

        // Special handling for Greater Restoration
        if (action.name === 'Greater Restoration') {
          // Show the Greater Restoration choice modal
          showGreaterRestorationModal(action);
          return;
        }

        // Special handling for Remove Curse
        if (action.name === 'Remove Curse') {
          // Show the Remove Curse choice modal
          showRemoveCurseModal(action);
          return;
        }

        // Special handling for Revivify
        if (action.name === 'Revivify') {
          // Show the Revivify choice modal
          showRevivifyModal(action);
          return;
        }

        // Special handling for Raise Dead
        if (action.name === 'Raise Dead') {
          // Show the Raise Dead choice modal
          showRaiseDeadModal(action);
          return;
        }

        // Special handling for Resurrection
        if (action.name === 'Resurrection') {
          // Show the Resurrection choice modal
          showResurrectionModal(action);
          return;
        }

        // Special handling for True Resurrection
        if (action.name === 'True Resurrection') {
          // Show the True Resurrection choice modal
          showTrueResurrectionModal(action);
          return;
        }

        // Special handling for Detect Magic
        if (action.name === 'Detect Magic') {
          // Show the Detect Magic choice modal
          showDetectMagicModal(action);
          return;
        }

        // Special handling for Identify
        if (action.name === 'Identify') {
          // Show the Identify choice modal
          showIdentifyModal(action);
          return;
        }

        // Special handling for Dispel Magic
        if (action.name === 'Dispel Magic') {
          // Show the Dispel Magic choice modal
          showDispelMagicModal(action);
          return;
        }

        // Special handling for Feather Fall
        if (action.name === 'Feather Fall') {
          // Show the Feather Fall choice modal
          showFeatherFallModal(action);
          return;
        }

        // Special handling for Hellish Rebuke
        if (action.name === 'Hellish Rebuke') {
          // Show the Hellish Rebuke choice modal
          showHellishRebukeModal(action);
          return;
        }

        // Special handling for Shield
        if (action.name === 'Shield') {
          // Show the Shield choice modal
          showShieldModal(action);
          return;
        }

        // Special handling for Absorb Elements
        if (action.name === 'Absorb Elements') {
          // Show the Absorb Elements choice modal
          showAbsorbElementsModal(action);
          return;
        }

        // Special handling for Counterspell
        if (action.name === 'Counterspell') {
          // Show the Counterspell choice modal
          showCounterspellModal(action);
          return;
        }

        // Special handling for Fire Shield
        if (action.name === 'Fire Shield') {
          // Show the Fire Shield choice modal
          showFireShieldModal(action);
          return;
        }

        // Special handling for Armor of Agathys
        if (action.name === 'Armor of Agathys') {
          // Show the Armor of Agathys choice modal
          showArmorOfAgathysModal(action);
          return;
        }

        // Special handling for Meld into Stone
        if (action.name === 'Meld into Stone') {
          // Show the Meld into Stone choice modal
          showMeldIntoStoneModal(action);
          return;
        }

        // Special handling for Vampiric Touch
        if (action.name === 'Vampiric Touch') {
          // Show the Vampiric Touch choice modal
          showVampiricTouchModal(action);
          return;
        }

        // Special handling for Life Transference
        if (action.name === 'Life Transference') {
          // Show the Life Transference choice modal
          showLifeTransferenceModal(action);
          return;
        }

        // Special handling for Geas
        if (action.name === 'Geas') {
          // Show the Geas choice modal
          showGeasModal(action);
          return;
        }

        // Special handling for Symbol
        if (action.name === 'Symbol') {
          // Show the Symbol choice modal
          showSymbolModal(action);
          return;
        }

        // Special handling for Spiritual Weapon
        if (action.name === 'Spiritual Weapon') {
          // Show the Spiritual Weapon choice modal
          showSpiritualWeaponModal(action);
          return;
        }

        // Special handling for Flaming Sphere
        if (action.name === 'Flaming Sphere') {
          // Show the Flaming Sphere choice modal
          showFlamingSphereModal(action);
          return;
        }

        // Special handling for Bigby's Hand
        if (action.name === 'Bigby\'s Hand') {
          // Show the Bigby's Hand choice modal
          showBigbysHandModal(action);
          return;
        }

        // Special handling for Animate Objects
        if (action.name === 'Animate Objects') {
          // Show the Animate Objects choice modal
          showAnimateObjectsModal(action);
          return;
        }

        // Special handling for Moonbeam
        if (action.name === 'Moonbeam') {
          // Show the Moonbeam choice modal
          showMoonbeamModal(action);
          return;
        }

        // Special handling for Healing Spirit
        if (action.name === 'Healing Spirit') {
          // Show the Healing Spirit choice modal
          showHealingSpiritModal(action);
          return;
        }

        // Special handling for Bless
        if (action.name === 'Bless') {
          // Show the Bless choice modal
          showBlessModal(action);
          return;
        }

        // Special handling for Bane
        if (action.name === 'Bane') {
          // Show the Bane choice modal
          showBaneModal(action);
          return;
        }

        // Special handling for Guidance
        if (action.name === 'Guidance') {
          // Show the Guidance choice modal
          showGuidanceModal(action);
          return;
        }

        // Special handling for Resistance
        if (action.name === 'Resistance') {
          // Show the Resistance choice modal
          showResistanceModal(action);
          return;
        }

        // Special handling for Hex
        if (action.name === 'Hex') {
          // Show the Hex choice modal
          showHexModal(action);
          return;
        }

        // Special handling for Hunter's Mark
        if (action.name === 'Hunter\'s Mark') {
          // Show the Hunter's Mark choice modal
          showHuntersMarkModal(action);
          return;
        }

        // Special handling for Magic Missile
        if (action.name === 'Magic Missile') {
          // Show the Magic Missile choice modal
          showMagicMissileModal(action);
          return;
        }

        // Special handling for Scorching Ray
        if (action.name === 'Scorching Ray') {
          // Show the Scorching Ray choice modal
          showScorchingRayModal(action);
          return;
        }

        // Special handling for Aid
        if (action.name === 'Aid') {
          // Show the Aid choice modal
          showAidModal(action);
          return;
        }

        // Note: Eldritch Blast uses standard attack/damage buttons, no special modal needed

        // Special handling for Spirit Guardians
        if (action.name === 'Spirit Guardians') {
          // Show the Spirit Guardians choice modal
          showSpiritGuardiansModal(action);
          return;
        }

        // Special handling for Cloud of Daggers
        if (action.name === 'Cloud of Daggers') {
          // Show the Cloud of Daggers choice modal
          showCloudOfDaggersModal(action);
          return;
        }

        // Special handling for Spike Growth
        if (action.name === 'Spike Growth') {
          // Show the Spike Growth choice modal
          showSpikeGrowthModal(action);
          return;
        }

        // Special handling for Wall of Fire
        if (action.name === 'Wall of Fire') {
          // Show the Wall of Fire choice modal
          showWallOfFireModal(action);
          return;
        }

        // Special handling for Haste
        if (action.name === 'Haste') {
          // Show the Haste choice modal
          showHasteModal(action);
          return;
        }

        // Special handling for Booming Blade
        if (action.name === 'Booming Blade') {
          // Show the Booming Blade choice modal
          showBoomingBladeModal(action);
          return;
        }

        // Special handling for Green-Flame Blade
        if (action.name === 'Green-Flame Blade') {
          // Show the Green-Flame Blade choice modal
          showGreenFlameBladeModal(action);
          return;
        }

        // Special handling for Chromatic Orb
        if (action.name === 'Chromatic Orb') {
          // Show the Chromatic Orb choice modal
          showChromaticOrbModal(action);
          return;
        }

        // Special handling for Dragon's Breath
        if (action.name === 'Dragon\'s Breath') {
          // Show the Dragons Breath choice modal
          showDragonsBreathModal(action);
          return;
        }

        // Special handling for Chaos Bolt
        if (action.name === 'Chaos Bolt') {
          // Show the Chaos Bolt choice modal
          showChaosBoltModal(action);
          return;
        }

        // Special handling for Delayed Blast Fireball
        if (action.name === 'Delayed Blast Fireball') {
          // Show the Delayed Blast Fireball choice modal
          showDelayedBlastFireballModal(action);
          return;
        }

        // Special handling for Polymorph
        if (action.name === 'Polymorph') {
          // Show the Polymorph choice modal
          showPolymorphModal(action);
          return;
        }

        // Special handling for True Polymorph
        if (action.name === 'True Polymorph') {
          // Show the True Polymorph choice modal
          showTruePolymorphModal(action);
          return;
        }

        // Default handling for other actions

        // Check and decrement uses BEFORE announcing (so announcement shows correct count)
        if (action.uses && !decrementActionUses(action)) {
          return; // No uses remaining
        }

        // Check and decrement Ki points if action costs Ki
        const kiCost = getKiCostFromAction(action);
        if (kiCost > 0) {
          const kiResource = getKiPointsResource();
          if (!kiResource) {
            showNotification(`❌ No Ki Points resource found`, 'error');
            return;
          }
          if (kiResource.current < kiCost) {
            showNotification(`❌ Not enough Ki Points! Need ${kiCost}, have ${kiResource.current}`, 'error');
            return;
          }
          kiResource.current -= kiCost;
          saveCharacterData();
          debug.log(`✨ Used ${kiCost} Ki points for ${action.name}. Remaining: ${kiResource.current}/${kiResource.max}`);
          showNotification(`✨ ${action.name}! (${kiResource.current}/${kiResource.max} Ki left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement Sorcery Points if action costs them
        const sorceryCost = getSorceryPointCostFromAction(action);
        if (sorceryCost > 0) {
          const sorceryResource = getSorceryPointsResource();
          if (!sorceryResource) {
            showNotification(`❌ No Sorcery Points resource found`, 'error');
            return;
          }
          if (sorceryResource.current < sorceryCost) {
            showNotification(`❌ Not enough Sorcery Points! Need ${sorceryCost}, have ${sorceryResource.current}`, 'error');
            return;
          }
          sorceryResource.current -= sorceryCost;
          saveCharacterData();
          debug.log(`✨ Used ${sorceryCost} Sorcery Points for ${action.name}. Remaining: ${sorceryResource.current}/${sorceryResource.max}`);
          showNotification(`✨ ${action.name}! (${sorceryResource.current}/${sorceryResource.max} SP left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement other resources (Wild Shape, Breath Weapon, etc.)
        if (!decrementActionResources(action)) {
          return; // Not enough resources
        }

        // Announce the action AFTER all decrements (so announcement shows correct counts)
        announceAction(action);

        // Mark action as used based on action type
        const actionType = action.actionType || 'action';
        debug.log(`🎯 Action type for "${action.name}": "${actionType}"`);

        if (actionType === 'bonus action' || actionType === 'bonus' || actionType === 'Bonus Action' || actionType === 'Bonus') {
          markActionAsUsed('bonus action');
        } else if (actionType === 'reaction' || actionType === 'Reaction') {
          markActionAsUsed('reaction');
        } else {
          markActionAsUsed('action');
        }
      });
      buttonsDiv.appendChild(useBtn);
    }

    // Append nameDiv and buttonsDiv to actionHeader
    actionHeader.appendChild(nameDiv);
    actionHeader.appendChild(buttonsDiv);

    // Append actionHeader to actionCard
    actionCard.appendChild(actionHeader);

    // Add description if available
    if (action.description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'action-description';
      // Resolve any variables in the description (like {bardicInspirationDie})
      const resolvedDescription = resolveVariablesInFormula(action.description);
      descDiv.innerHTML = `
        <div style="margin-top: 10px;">${resolvedDescription}</div>
      `;

      actionCard.appendChild(descDiv);
    }

    container.appendChild(actionCard);
  });
}

/*
// Calculate total currency from inventory items
function calculateTotalCurrency(inventory) {
  console.log('💰💰💰 calculateTotalCurrency called, inventory length:', inventory ? inventory.length : 0);

  if (!inventory || inventory.length === 0) {
    console.log('💰 No inventory, returning zeros');
    return { pp: 0, gp: 0, sp: 0, cp: 0 };
  }

  let pp = 0;
  let gp = 0;
  let sp = 0;
  let cp = 0;

  // Build a map of item IDs to names for parent lookup
  const itemMap = new Map();
  inventory.forEach(item => {
    if (item._id) {
      itemMap.set(item._id, item.name);
    }
  });

  inventory.forEach(item => {
    const itemName = (item.name || '').toLowerCase();
    const quantity = item.quantity;
    const parentId = item.parent && item.parent.id ? item.parent.id : null;
    const parentName = parentId ? itemMap.get(parentId) || 'Unknown' : 'None';

    console.log(`💰 Item: "${item.name}" | qty: ${quantity} | parent: ${parentName} (${parentId})`);

    // Skip items with no quantity or quantity of 0
    if (!quantity || quantity <= 0) {
      console.log(`💰 ❌ SKIPPED - quantity is ${quantity}`);
      return;
    }

    // Check if this is currency
    const isCurrency = (itemName.includes('platinum') || itemName.includes('gold') ||
                       itemName.includes('silver') || itemName.includes('copper')) &&
                       (itemName.includes('piece') || itemName.includes('coin'));

    if (!isCurrency) return;

    // ONLY count currency that's inside ANY container (has a parent)
    // Skip root-level currency items (no parent)
    if (!parentId) {
      console.log(`💰 ❌ SKIPPED CURRENCY - no parent (root-level item)`);
      return;
    }

    // Count currency by type (inside containers only)
    if (itemName.includes('platinum')) {
      console.log(`💰💰 ✅ MATCHED PLATINUM in "${parentName}" - adding ${quantity}`, item);
      pp += quantity;
    } else if (itemName.includes('gold')) {
      console.log(`💰💰 ✅ MATCHED GOLD in "${parentName}" - adding ${quantity}`, item);
      gp += quantity;
    } else if (itemName.includes('silver')) {
      console.log(`💰💰 ✅ MATCHED SILVER in "${parentName}" - adding ${quantity}`, item);
      sp += quantity;
    } else if (itemName.includes('copper')) {
      console.log(`💰💰 ✅ MATCHED COPPER in "${parentName}" - adding ${quantity}`, item);
      cp += quantity;
    }
  });

  console.log(`💰💰💰 FINAL CURRENCY TOTALS: pp=${pp}, gp=${gp}, sp=${sp}, cp=${cp}`);
  return { pp, gp, sp, cp };
}
*/

/*
// Update currency display in inventory section header
function updateInventoryCurrencyDisplay(inventory) {
  const headerElement = document.querySelector('#inventory-section h3');
  if (!headerElement) return;

  const currency = calculateTotalCurrency(inventory);

  // Remove existing currency display if any
  const existingDisplay = headerElement.querySelector('.currency-display');
  if (existingDisplay) {
    existingDisplay.remove();
  }

  // Create currency display
  const currencyDisplay = document.createElement('span');
  currencyDisplay.className = 'currency-display';
  currencyDisplay.style.cssText = 'margin-left: 12px; display: inline-flex; gap: 8px; font-size: 0.85em; font-weight: normal;';

  // Add currency circles (only if value > 0)
  if (currency.pp > 0) {
    const ppCircle = document.createElement('span');
    ppCircle.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    ppCircle.innerHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #e8e8e8; border: 1px solid #ccc;"></span><span>${currency.pp}</span>`;
    currencyDisplay.appendChild(ppCircle);
  }

  if (currency.gp > 0) {
    const gpCircle = document.createElement('span');
    gpCircle.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    gpCircle.innerHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ffd700; border: 1px solid #daa520;"></span><span>${currency.gp}</span>`;
    currencyDisplay.appendChild(gpCircle);
  }

  if (currency.sp > 0) {
    const spCircle = document.createElement('span');
    spCircle.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    spCircle.innerHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #c0c0c0; border: 1px solid #999;"></span><span>${currency.sp}</span>`;
    currencyDisplay.appendChild(spCircle);
  }

  if (currency.cp > 0) {
    const cpCircle = document.createElement('span');
    cpCircle.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    cpCircle.innerHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #8b4513; border: 1px solid #654321;"></span><span>${currency.cp}</span>`;
    currencyDisplay.appendChild(cpCircle);
  }

  // Only add if there's any currency
  if (currency.pp > 0 || currency.gp > 0 || currency.sp > 0 || currency.cp > 0) {
    headerElement.appendChild(currencyDisplay);
  }
}
*/

// Build and display inventory with filtering
function buildInventoryDisplay(container, inventory) {
  // Clear container
  container.innerHTML = '';

  // Update currency display in header
  // updateInventoryCurrencyDisplay(inventory); // Commented out currency viewer

  if (!inventory || inventory.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No items in inventory</p>';
    return;
  }

  debug.log(`🎒 Building inventory display with ${inventory.length} items`);

  // Apply filters
  let filteredInventory = inventory.filter(item => {
    // Filter out coins (currency) - they're tracked separately
    const lowerName = (item.name || '').toLowerCase();
    const coinPatterns = ['platinum piece', 'gold piece', 'silver piece', 'copper piece', 'electrum piece',
                          'platinum coin', 'gold coin', 'silver coin', 'copper coin', 'electrum coin',
                          'pp', 'gp', 'sp', 'cp', 'ep'];
    // Check for exact matches or plurals
    const isCoin = coinPatterns.some(pattern => {
      if (pattern.length <= 2) {
        // Short patterns (pp, gp, etc.) - match exactly or with quantity prefix
        return lowerName === pattern || lowerName === pattern + 's' || lowerName.match(new RegExp(`^\\d+\\s*${pattern}s?$`));
      }
      // Longer patterns - match if name contains it
      return lowerName.includes(pattern);
    });
    if (isCoin) {
      return false;
    }

    // Filter by type
    if (inventoryFilters.filter === 'equipped' && !item.equipped) {
      return false;
    }
    if (inventoryFilters.filter === 'attuned' && !item.attuned) {
      return false;
    }
    if (inventoryFilters.filter === 'container' && item.type !== 'container') {
      return false;
    }

    // Filter by search term
    if (inventoryFilters.search) {
      const searchLower = inventoryFilters.search;
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const tagsString = (item.tags || []).join(' ').toLowerCase();
      if (!name.includes(searchLower) && !desc.includes(searchLower) && !tagsString.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  if (filteredInventory.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No items match filters</p>';
    return;
  }

  // Sort inventory: equipped first, then by name
  filteredInventory.sort((a, b) => {
    if (a.equipped && !b.equipped) return -1;
    if (!a.equipped && b.equipped) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Group items by category/container
  filteredInventory.forEach(item => {
    const itemCard = createInventoryCard(item);
    container.appendChild(itemCard);
  });

  debug.log(`🎒 Displayed ${filteredInventory.length} items`);
}

// Create individual inventory item card
function createInventoryCard(item) {
  const card = document.createElement('div');
  card.className = 'action-card'; // Reuse action card styling
  card.style.cssText = `
    background: var(--bg-card);
    border-left: 4px solid ${item.equipped ? '#27ae60' : item.attuned ? '#9b59b6' : '#95a5a6'};
    padding: 15px;
    margin-bottom: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    ${item.equipped ? 'box-shadow: 0 0 10px rgba(39, 174, 96, 0.3);' : ''}
  `;

  card.onmouseover = () => {
    card.style.background = 'var(--bg-card-hover)';
    card.style.transform = 'translateX(2px)';
  };
  card.onmouseout = () => {
    card.style.background = 'var(--bg-card)';
    card.style.transform = 'translateX(0)';
  };

  // Header with name and quantity
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

  const nameSection = document.createElement('div');
  nameSection.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const itemName = document.createElement('strong');
  itemName.textContent = item.name || 'Unnamed Item';
  itemName.style.cssText = 'color: var(--text-primary); font-size: 1.1em;';
  nameSection.appendChild(itemName);

  // Add badges for equipped/attuned
  if (item.equipped) {
    const equippedBadge = document.createElement('span');
    equippedBadge.textContent = '⚔️ Equipped';
    equippedBadge.style.cssText = 'background: #27ae60; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold;';
    nameSection.appendChild(equippedBadge);
  }

  if (item.attuned) {
    const attunedBadge = document.createElement('span');
    attunedBadge.textContent = '✨ Attuned';
    attunedBadge.style.cssText = 'background: #9b59b6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold;';
    nameSection.appendChild(attunedBadge);
  }

  if (item.requiresAttunement && !item.attuned) {
    const requiresBadge = document.createElement('span');
    requiresBadge.textContent = '(Requires Attunement)';
    requiresBadge.style.cssText = 'color: var(--text-muted); font-size: 0.85em; font-style: italic;';
    nameSection.appendChild(requiresBadge);
  }

  header.appendChild(nameSection);

  // Quantity display
  const metaSection = document.createElement('div');
  metaSection.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; gap: 4px;';

  if (item.quantity > 1 || item.showIncrement) {
    const quantitySpan = document.createElement('span');
    quantitySpan.textContent = `×${item.quantity}`;
    quantitySpan.style.cssText = 'color: var(--text-secondary); font-weight: bold; font-size: 1.1em;';
    metaSection.appendChild(quantitySpan);
  }

  header.appendChild(metaSection);
  card.appendChild(header);

  // Weight
  if (item.weight && item.weight > 0) {
    const weightDiv = document.createElement('div');
    const totalWeight = item.weight * item.quantity;
    weightDiv.textContent = `⚖️ ${totalWeight} lb${totalWeight !== 1 ? 's' : ''}`;
    weightDiv.style.cssText = 'color: var(--text-secondary); font-size: 0.85em; margin-bottom: 4px;';
    card.appendChild(weightDiv);
  }

  // Tags
  if (item.tags && item.tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0;';
    item.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.textContent = tag;
      tagSpan.style.cssText = 'background: var(--bg-tertiary); color: var(--text-secondary); padding: 2px 6px; border-radius: 8px; font-size: 0.75em;';
      tagsDiv.appendChild(tagSpan);
    });
    card.appendChild(tagsDiv);
  }

  // Description (collapsed by default, click to expand)
  if (item.description && item.description.trim()) {
    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'color: var(--text-secondary); font-size: 0.9em; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; line-height: 1.4; max-height: 0; overflow: hidden; transition: max-height 0.3s;';
    descDiv.innerHTML = item.description.replace(/\n/g, '<br>');

    card.addEventListener('click', () => {
      if (descDiv.style.maxHeight === '0px' || !descDiv.style.maxHeight) {
        descDiv.style.maxHeight = '500px';
        descDiv.style.paddingTop = '8px';
      } else {
        descDiv.style.maxHeight = '0px';
        descDiv.style.paddingTop = '0px';
      }
    });

    card.appendChild(descDiv);
  }

  return card;
}

function buildCompanionsDisplay(companions) {
  const container = document.getElementById('companions-container');
  const section = document.getElementById('companions-section');

  // Show the companions section
  section.style.display = 'block';

  container.innerHTML = '';

  companions.forEach(companion => {
    debug.log('🔍 DEBUG: Companion object in popup:', companion);
    debug.log('🔍 DEBUG: Companion abilities:', companion.abilities);
    debug.log('🔍 DEBUG: Companion abilities keys:', Object.keys(companion.abilities));

    const companionCard = document.createElement('div');
    companionCard.className = 'action-card';
    companionCard.style.background = 'var(--bg-card)';
    companionCard.style.borderColor = 'var(--border-card)';

    // Header with name and basic info
    const header = document.createElement('div');
    header.className = 'action-header';
    header.style.cursor = 'pointer';

    const nameDiv = document.createElement('div');
    nameDiv.innerHTML = `
      <div class="action-name">🐾 ${companion.name}</div>
      <div style="font-size: 0.85em; color: var(--text-secondary); font-style: italic;">
        ${companion.size} ${companion.type}${companion.alignment ? ', ' + companion.alignment : ''}
      </div>
    `;

    header.appendChild(nameDiv);
    companionCard.appendChild(header);

    // Stats block
    const statsDiv = document.createElement('div');
    statsDiv.className = 'action-description expanded';
    statsDiv.style.display = 'block';
    statsDiv.style.background = 'var(--bg-secondary)';
    statsDiv.style.padding = '12px';
    statsDiv.style.borderRadius = '4px';
    statsDiv.style.marginTop = '10px';

    let statsHTML = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">';

    // AC, HP, Speed
    if (companion.ac) statsHTML += `<div><strong>AC:</strong> ${companion.ac}</div>`;
    if (companion.hp) statsHTML += `<div><strong>HP:</strong> ${companion.hp}</div>`;
    if (companion.speed) statsHTML += `<div style="grid-column: span 3;"><strong>Speed:</strong> ${companion.speed}</div>`;

    statsHTML += '</div>';

    // Abilities
    if (Object.keys(companion.abilities).length > 0) {
      statsHTML += '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center; margin: 10px 0; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">';
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
        if (companion.abilities[ability]) {
          const abil = companion.abilities[ability];
          statsHTML += `
            <div>
              <div style="font-weight: bold; font-size: 0.75em; color: var(--text-secondary);">${ability.toUpperCase()}</div>
              <div style="font-size: 1.1em; color: var(--text-primary);">${abil.score}</div>
              <div style="font-size: 0.9em; color: var(--accent-success);">(${abil.modifier >= 0 ? '+' : ''}${abil.modifier})</div>
            </div>
          `;
        }
      });
      statsHTML += '</div>';
    }

    // Senses, Languages, PB
    if (companion.senses) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Senses:</strong> ${companion.senses}</div>`;
    if (companion.languages) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Languages:</strong> ${companion.languages}</div>`;
    if (companion.proficiencyBonus) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Proficiency Bonus:</strong> +${companion.proficiencyBonus}</div>`;

    // Features
    if (companion.features && companion.features.length > 0) {
      statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">';
      companion.features.forEach(feature => {
        statsHTML += `<div style="margin: 8px 0; color: var(--text-primary);"><strong>${feature.name}.</strong> ${feature.description}</div>`;
      });
      statsHTML += '</div>';
    }

    // Actions with attack buttons
    if (companion.actions && companion.actions.length > 0) {
      statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-primary);"><strong>Actions</strong></div>';
      companion.actions.forEach(action => {
        statsHTML += `
          <div style="margin: 10px 0; padding: 8px; background: var(--bg-action); border: 1px solid var(--accent-danger); border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="color: var(--text-primary);">
                <strong>${action.name}.</strong> Melee Weapon Attack: +${action.attackBonus} to hit, ${action.reach}. <em>Hit:</em> ${action.damage}
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="attack-btn companion-attack-btn" data-name="${companion.name} - ${action.name}" data-bonus="${action.attackBonus}">⚔️ Attack</button>
                <button class="damage-btn companion-damage-btn" data-name="${companion.name} - ${action.name}" data-damage="${action.damage}">💥 Damage</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    statsDiv.innerHTML = statsHTML;
    companionCard.appendChild(statsDiv);

    // Add event listeners for attack/damage buttons
    companionCard.querySelectorAll('.companion-attack-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.name;
        const bonus = parseInt(btn.dataset.bonus);
        roll(`${name} - Attack`, `1d20+${bonus}`);
      });
    });

    companionCard.querySelectorAll('.companion-damage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.name;
        const damage = btn.dataset.damage;
        roll(`${name} - Damage`, damage);
      });
    });

    container.appendChild(companionCard);
  });
}

function decrementActionUses(action) {
  if (!action.uses) {
    return true; // No uses to track, allow action
  }

  const usesTotal = action.uses.total || action.uses.value || action.uses;
  const usesUsed = action.usesUsed || 0;
  const usesRemaining = action.usesLeft !== undefined ? action.usesLeft : (usesTotal - usesUsed);

  if (usesRemaining <= 0) {
    showNotification(`❌ No uses remaining for ${action.name}`, 'error');
    return false;
  }

  // Increment usesUsed and decrement usesLeft
  action.usesUsed = usesUsed + 1;
  if (action.usesLeft !== undefined) {
    action.usesLeft = usesRemaining - 1;
  }
  const newRemaining = action.usesLeft !== undefined ? action.usesLeft : (usesTotal - action.usesUsed);

  // Update character data and save
  saveCharacterData();

  // Show notification
  showNotification(`✅ Used ${action.name} (${newRemaining}/${usesTotal} remaining)`);

  // Rebuild the actions display to show updated count
  const actionsContainer = document.getElementById('actions-container');
  buildActionsDisplay(actionsContainer, characterData.actions);

  return true;
}

function buildResourcesDisplay() {
  const container = document.getElementById('resources-container');

  if (!characterData || !characterData.resources || characterData.resources.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No class resources available</p>';
    debug.log('⚠️ No resources in character data');
    // Collapse the section when empty
    collapseSectionByContainerId('resources-container');
    return;
  }

  // Expand the section when it has content
  expandSectionByContainerId('resources-container');

  debug.log(`📊 Building resources display with ${characterData.resources.length} resources:`, 
    characterData.resources.map(r => `${r.name} (${r.current}/${r.max})`));

  const resourcesGrid = document.createElement('div');
  resourcesGrid.className = 'spell-slots-grid'; // Reuse spell slot styling

  characterData.resources.forEach(resource => {
    // Skip Lucky resources since they have their own action button
    const lowerName = resource.name.toLowerCase().trim();
    if (lowerName.includes('lucky point') || lowerName.includes('luck point') || lowerName === 'lucky points' || lowerName === 'lucky') {
      debug.log(`⏭️ Skipping Lucky resource from display: ${resource.name}`);
      return;
    }
    
    debug.log(`📊 Displaying resource: ${resource.name} (${resource.current}/${resource.max})`);
    
    const resourceCard = document.createElement('div');
    resourceCard.className = resource.current > 0 ? 'spell-slot-card' : 'spell-slot-card empty';
    resourceCard.innerHTML = `
      <div class="spell-slot-level">${resource.name}</div>
      <div class="spell-slot-count">${resource.current}/${resource.max}</div>
    `;

    // Add click to manually adjust resource
    resourceCard.addEventListener('click', () => {
      adjustResource(resource);
    });
    resourceCard.style.cursor = 'pointer';

    resourcesGrid.appendChild(resourceCard);
  });

  container.innerHTML = '';
  container.appendChild(resourcesGrid);

  const note = document.createElement('p');
  note.style.cssText = 'text-align: center; color: #95a5a6; font-size: 0.85em; margin-top: 10px;';
  note.textContent = 'Click a resource to manually adjust';
  container.appendChild(note);
}

function adjustResource(resource) {
  const newValue = prompt(`Adjust ${resource.name}\n\nCurrent: ${resource.current}/${resource.max}\n\nEnter new current value (0-${resource.max}):`);

  if (newValue === null) return; // Cancelled

  const parsed = parseInt(newValue);
  if (isNaN(parsed) || parsed < 0 || parsed > resource.max) {
    alert(`Please enter a number between 0 and ${resource.max}`);
    return;
  }

  resource.current = parsed;

  // Also update otherVariables to keep data in sync
  if (characterData.otherVariables && resource.varName) {
    characterData.otherVariables[resource.varName] = resource.current;
  }

  saveCharacterData();
  buildSheet(characterData);

  showNotification(`✅ ${resource.name} updated to ${resource.current}/${resource.max}`);
}

function showSpellSlotRestorationModal(channelDivinityResource, maxSlotLevel) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 400px; max-width: 500px;';

  // Build spell slot buttons
  let slotButtonsHTML = '';
  const spellSlots = characterData.spellSlots || {};

  for (let level = 1; level <= maxSlotLevel; level++) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;
    const current = spellSlots[slotVar] || 0;
    const max = spellSlots[slotMaxVar] || 0;

    const isAvailable = max > 0 && current < max;
    const disabled = !isAvailable ? 'disabled' : '';
    const bgColor = isAvailable ? '#9b59b6' : '#bdc3c7';
    const cursor = isAvailable ? 'pointer' : 'not-allowed';
    const opacity = isAvailable ? '1' : '0.6';

    slotButtonsHTML += `
      <button
        class="spell-slot-restore-btn"
        data-level="${level}"
        ${disabled}
        style="width: 100%; padding: 15px; background: ${bgColor}; color: white; border: none; border-radius: 8px; cursor: ${cursor}; font-weight: bold; margin-bottom: 10px; opacity: ${opacity};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Level ${level} Spell Slot</span>
          <span style="font-size: 0.9em;">${current}/${max}</span>
        </div>
      </button>
    `;
  }

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">🔮 Harness Divine Power</h3>
    <p style="text-align: center; margin-bottom: 20px; color: #555; font-size: 0.95em;">
      Choose which spell slot to restore (max level ${maxSlotLevel})
    </p>
    <div style="margin-bottom: 20px;">
      ${slotButtonsHTML}
    </div>
    <button id="cancel-restore-modal" style="width: 100%; padding: 12px; background: #7f8c8d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Cancel
    </button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add click handlers to spell slot buttons
  const slotButtons = modal.querySelectorAll('.spell-slot-restore-btn:not([disabled])');
  slotButtons.forEach(button => {
    button.addEventListener('click', () => {
      const level = parseInt(button.getAttribute('data-level'));
      restoreSpellSlot(level, channelDivinityResource);
      modal.remove();
    });
  });

  // Cancel button
  document.getElementById('cancel-restore-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function restoreSpellSlot(level, channelDivinityResource) {
  const slotVar = `level${level}SpellSlots`;
  const slotMaxVar = `level${level}SpellSlotsMax`;

  if (!characterData.spellSlots) {
    showNotification('❌ No spell slots available!', 'error');
    return;
  }

  const current = characterData.spellSlots[slotVar] || 0;
  const max = characterData.spellSlots[slotMaxVar] || 0;

  if (max === 0) {
    showNotification('❌ No spell slots at that level!', 'error');
    return;
  }

  if (current >= max) {
    showNotification(`❌ Level ${level} spell slots already full!`, 'error');
    return;
  }

  // Restore the spell slot
  characterData.spellSlots[slotVar] = Math.min(current + 1, max);

  // Expend Channel Divinity use
  channelDivinityResource.current = Math.max(0, channelDivinityResource.current - 1);

  // Update character data - sync with otherVariables using the correct variable name
  if (characterData.otherVariables && channelDivinityResource.variableName) {
    characterData.otherVariables[channelDivinityResource.variableName] = channelDivinityResource.current;
  } else if (characterData.otherVariables && channelDivinityResource.varName) {
    characterData.otherVariables[channelDivinityResource.varName] = channelDivinityResource.current;
  }

  saveCharacterData();
  buildSheet(characterData);

  // Announce to Roll20
  const colorBanner = getColoredBanner();
  const newCurrent = characterData.spellSlots[slotVar];
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} uses Harness Divine Power}} {{🔮=Restored a Level ${level} spell slot! (${newCurrent}/${max})}}`,
    color: characterData.notificationColor
  };

  // Send to Roll20
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }

  showNotification(`🔮 Harness Divine Power! Restored Level ${level} spell slot. Channel Divinity: ${channelDivinityResource.current}/${channelDivinityResource.max}`);
  debug.log(`✨ Harness Divine Power used to restore Level ${level} spell slot`);
}

/**
 * Show modal for Divine Spark choice (Heal, Necrotic, or Radiant)
 * @param {Object} action - The Divine Spark action
 * @param {Object} channelDivinityResource - The Channel Divinity resource
 */
function showDivineSparkModal(action, channelDivinityResource) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Get cleric level for damage calculation
  const clericLevel = characterData.otherVariables?.clericLevel || characterData.otherVariables?.cleric?.level || 1;
  const wisdomMod = characterData.abilityScores?.wisdom?.modifier || 0;

  // Calculate number of d8 dice based on cleric level
  const diceArray = [1,1,1,1,1,1,2,2,2,2,2,2,3,3,3,3,3,4,4,4];
  const numDice = diceArray[Math.min(clericLevel, 20) - 1] || 1;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: #2a2a2a;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    color: #fff;
  `;

  modalContent.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 16px; color: #ffd700; text-align: center;">
      ✨ Divine Spark
    </h3>
    <p style="margin-bottom: 8px; text-align: center; color: #ccc;">
      Roll: ${numDice}d8 + ${wisdomMod}
    </p>
    <p style="margin-bottom: 20px; text-align: center; font-size: 14px; color: #aaa;">
      Channel Divinity: ${channelDivinityResource.current}/${channelDivinityResource.max}
    </p>
    <p style="margin-bottom: 20px; text-align: center; color: #fff;">
      Choose the effect:
    </p>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <button id="divine-spark-heal" style="
        padding: 12px 20px;
        font-size: 16px;
        border: 2px solid #4ade80;
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      ">💚 Heal Target</button>
      <button id="divine-spark-necrotic" style="
        padding: 12px 20px;
        font-size: 16px;
        border: 2px solid #a78bfa;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      ">🖤 Necrotic Damage</button>
      <button id="divine-spark-radiant" style="
        padding: 12px 20px;
        font-size: 16px;
        border: 2px solid #fbbf24;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      ">✨ Radiant Damage</button>
      <button id="divine-spark-cancel" style="
        padding: 10px 20px;
        font-size: 14px;
        background: #444;
        color: white;
        border: 1px solid #666;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 8px;
      ">Cancel</button>
    </div>
  `;

  modal.appendChild(modalContent);

  // Add hover effects
  const buttons = modalContent.querySelectorAll('button:not(#divine-spark-cancel)');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
  });

  // Helper function to execute Divine Spark
  const executeDivineSpark = (type, color, damageType = null) => {
    // Consume Channel Divinity use
    channelDivinityResource.current -= 1;
    saveCharacterData();

    // Set the Divine Spark Choice variable in DiceCloud
    const choiceValue = type === 'heal' ? 1 : (type === 'necrotic' ? 2 : 3);
    if (characterData.otherVariables) {
      characterData.otherVariables.divineSparkChoice = choiceValue;
    }

    // Build the roll formula
    const rollFormula = `${numDice}d8 + ${wisdomMod}`;

    // Create roll description
    const effectText = type === 'heal' ? 'Healing' : `${damageType} Damage`;
    const colorBanner = `<span style="color: ${color}; font-weight: bold;">`;

    // Send the roll to Roll20
    const messageData = {
      action: 'sendRoll20Message',
      message: `&{template:default} {{name=${colorBanner}${characterData.name} uses Divine Spark}} {{Effect=${effectText}}} {{Roll=[[${rollFormula}]]}} {{Channel Divinity=${channelDivinityResource.current}/${channelDivinityResource.max}}}`,
      color: color
    };

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    } else {
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }

    // Show notification
    showNotification(`✨ Divine Spark (${effectText})! Channel Divinity: ${channelDivinityResource.current}/${channelDivinityResource.max}`, 'success');
    debug.log(`✨ Divine Spark used: ${effectText}`);

    // Rebuild sheet to show updated Channel Divinity count
    buildSheet(characterData);

    // Remove modal
    modal.remove();
  };

  // Add button click handlers
  document.getElementById('divine-spark-heal')?.addEventListener('click', () => {
    executeDivineSpark('heal', '#22c55e');
  });

  document.getElementById('divine-spark-necrotic')?.addEventListener('click', () => {
    executeDivineSpark('necrotic', '#8b5cf6', 'Necrotic');
  });

  document.getElementById('divine-spark-radiant')?.addEventListener('click', () => {
    executeDivineSpark('radiant', '#f59e0b', 'Radiant');
  });

  document.getElementById('divine-spark-cancel')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Add to document
  document.body.appendChild(modal);

  // Wait for modal to be in DOM before adding event listeners
  requestAnimationFrame(() => {
    const healBtn = document.getElementById('divine-spark-heal');
    const necroticBtn = document.getElementById('divine-spark-necrotic');
    const radiantBtn = document.getElementById('divine-spark-radiant');
    const cancelBtn = document.getElementById('divine-spark-cancel');

    healBtn?.addEventListener('click', () => executeDivineSpark('heal', '#22c55e'));
    necroticBtn?.addEventListener('click', () => executeDivineSpark('necrotic', '#8b5cf6', 'Necrotic'));
    radiantBtn?.addEventListener('click', () => executeDivineSpark('radiant', '#f59e0b', 'Radiant'));
    cancelBtn?.addEventListener('click', () => modal.remove());
  });
}

function buildSpellSlotsDisplay() {
  const container = document.getElementById('spell-slots-container');

  if (!characterData || !characterData.spellSlots) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No spell slots available</p>';
    debug.log('⚠️ No spell slots in character data');
    // Collapse the section when empty
    collapseSectionByContainerId('spell-slots-container');
    return;
  }

  const slotsGrid = document.createElement('div');
  slotsGrid.className = 'spell-slots-grid';

  let hasAnySlots = false;
  let totalCurrentSlots = 0;
  let totalMaxSlots = 0;

  // Check for Pact Magic (Warlock) - stored separately from regular slots
  // Check both spellSlots and otherVariables since data may come from either source
  // DiceCloud uses various variable names: pactSlot, pactMagicSlots, pactSlotLevelVisible, etc.
  const pactMagicSlotLevel = characterData.spellSlots?.pactMagicSlotLevel ||
                             characterData.otherVariables?.pactMagicSlotLevel ||
                             characterData.otherVariables?.pactSlotLevelVisible ||
                             characterData.otherVariables?.pactSlotLevel ||
                             characterData.otherVariables?.slotLevel;
  const pactMagicSlots = characterData.spellSlots?.pactMagicSlots ??
                         characterData.otherVariables?.pactMagicSlots ??
                         characterData.otherVariables?.pactSlot ?? 0;
  const pactMagicSlotsMax = characterData.spellSlots?.pactMagicSlotsMax ??
                            characterData.otherVariables?.pactMagicSlotsMax ??
                            characterData.otherVariables?.pactSlotMax ?? 0;
  const hasPactMagic = pactMagicSlotsMax > 0;
  // Default slot level to 5 (max pact level) if we have slots but couldn't detect level
  const effectivePactLevel = pactMagicSlotLevel || (hasPactMagic ? 5 : 0);

  debug.log(`🔮 Spell slots display - Pact Magic: level=${pactMagicSlotLevel} (effective=${effectivePactLevel}), slots=${pactMagicSlots}/${pactMagicSlotsMax}, hasPact=${hasPactMagic}`);

  // Add Pact Magic slots first if present
  if (hasPactMagic) {
    hasAnySlots = true;
    totalCurrentSlots += pactMagicSlots;
    totalMaxSlots += pactMagicSlotsMax;

    const slotCard = document.createElement('div');
    slotCard.className = pactMagicSlots > 0 ? 'spell-slot-card pact-magic' : 'spell-slot-card pact-magic empty';
    slotCard.style.cssText = 'background: linear-gradient(135deg, #6b3fa0, #9b59b6); border: 2px solid #8e44ad;';

    slotCard.innerHTML = `
      <div class="spell-slot-level">Pact (${effectivePactLevel})</div>
      <div class="spell-slot-count">${pactMagicSlots}/${pactMagicSlotsMax}</div>
    `;

    // Add click to manually adjust Pact Magic slots
    slotCard.addEventListener('click', () => {
      adjustSpellSlot(`pact:${effectivePactLevel}`, pactMagicSlots, pactMagicSlotsMax, true);
    });
    slotCard.style.cursor = 'pointer';
    slotCard.title = 'Click to adjust Pact Magic slots (recharge on short rest)';

    slotsGrid.appendChild(slotCard);
  }

  // Check each level (1-9) for regular spell slots
  for (let level = 1; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;

    const maxSlots = characterData.spellSlots[slotMaxVar] || 0;

    // Only show if character has regular slots at this level
    if (maxSlots > 0) {
      hasAnySlots = true;
      const currentSlots = characterData.spellSlots[slotVar] || 0;

      // Track totals
      totalCurrentSlots += currentSlots;
      totalMaxSlots += maxSlots;

      const slotCard = document.createElement('div');
      slotCard.className = currentSlots > 0 ? 'spell-slot-card' : 'spell-slot-card empty';

      slotCard.innerHTML = `
        <div class="spell-slot-level">Level ${level}</div>
        <div class="spell-slot-count">${currentSlots}/${maxSlots}</div>
      `;

      // Add click to manually adjust slots with hover effect
      slotCard.addEventListener('click', () => {
        adjustSpellSlot(level, currentSlots, maxSlots);
      });
      slotCard.style.cursor = 'pointer';
      slotCard.title = 'Click to adjust spell slots';

      slotsGrid.appendChild(slotCard);
    }
  }

  if (hasAnySlots) {
    container.innerHTML = '';
    
    // Add total slots summary
    const summaryCard = document.createElement('div');
    summaryCard.className = 'spell-slots-summary';
    summaryCard.style.cssText = `
      background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
      color: white;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 15px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(155, 89, 182, 0.3);
    `;
    
    const totalPercent = totalMaxSlots > 0 ? (totalCurrentSlots / totalMaxSlots) * 100 : 0;
    summaryCard.innerHTML = `
      <div style="font-size: 14px; opacity: 0.9;">Total Spell Slots</div>
      <div style="font-size: 20px; margin: 4px 0;">${totalCurrentSlots}/${totalMaxSlots}</div>
      <div style="font-size: 12px; opacity: 0.8;">${Math.round(totalPercent)}% remaining</div>
    `;
    
    container.appendChild(summaryCard);
    container.appendChild(slotsGrid);

    // Add a small note
    const note = document.createElement('p');
    note.style.cssText = 'text-align: center; color: #666; font-size: 0.85em; margin-top: 8px;';
    note.textContent = 'Click a slot to manually adjust';
    container.appendChild(note);
    
    debug.log(`✨ Spell slots display: ${totalCurrentSlots}/${totalMaxSlots} total slots across ${Math.max(...Array.from({length: 9}, (_, i) => i + 1).filter(level => characterData.spellSlots[`level${level}SpellSlotsMax`] > 0))} levels`);
    // Expand the section when it has content
    expandSectionByContainerId('spell-slots-container');
  } else {
    container.innerHTML = '<p style="text-align: center; color: #666;">No spell slots available</p>';
    debug.log('⚠️ Character has 0 max slots for all levels');
    // Collapse the section when empty
    collapseSectionByContainerId('spell-slots-container');
  }
}

function adjustSpellSlot(level, current, max, isPactMagic = false) {
  // Check if this is a Pact Magic slot (format: "pact:${level}")
  const isPact = isPactMagic || (typeof level === 'string' && level.startsWith('pact:'));
  const actualLevel = isPact ? parseInt(level.toString().split(':')[1] || level) : level;

  const slotLabel = isPact ? `Pact Magic (Level ${actualLevel})` : `Level ${actualLevel}`;
  const newValue = prompt(`Adjust ${slotLabel} Spell Slots\n\nCurrent: ${current}/${max}\n\nEnter new current value (0-${max}):`);

  if (newValue === null) return; // Cancelled

  const parsed = parseInt(newValue);
  if (isNaN(parsed) || parsed < 0 || parsed > max) {
    showNotification('❌ Invalid value', 'error');
    return;
  }

  if (isPact) {
    characterData.spellSlots.pactMagicSlots = parsed;
  } else {
    const slotVar = `level${actualLevel}SpellSlots`;
    characterData.spellSlots[slotVar] = parsed;
  }
  saveCharacterData();
  buildSheet(characterData);

  showNotification(`✅ ${slotLabel} slots set to ${parsed}/${max}`);
}

function showHPModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 300px;';

  const currentHP = characterData.hitPoints.current;
  const maxHP = characterData.hitPoints.max;
  const tempHP = characterData.temporaryHP || 0;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Adjust Hit Points</h3>
    <div style="text-align: center; font-size: 1.2em; margin-bottom: 20px; color: #7f8c8d;">
      Current: <strong>${currentHP}${tempHP > 0 ? `+${tempHP}` : ''} / ${maxHP}</strong>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Amount:</label>
      <input type="number" id="hp-amount" min="1" value="1" style="width: 100%; padding: 10px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box;">
    </div>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Action:</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
        <button id="hp-toggle-heal" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #27ae60; background: #27ae60; color: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          💚 Heal
        </button>
        <button id="hp-toggle-damage" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #bdc3c7; background: white; color: #7f8c8d; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          💔 Damage
        </button>
        <button id="hp-toggle-temp" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #bdc3c7; background: white; color: #7f8c8d; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          🛡️ Temp HP
        </button>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="hp-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="hp-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Confirm
      </button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Toggle state: 'heal', 'damage', or 'temp'
  let actionType = 'heal';

  const healBtn = document.getElementById('hp-toggle-heal');
  const damageBtn = document.getElementById('hp-toggle-damage');
  const tempBtn = document.getElementById('hp-toggle-temp');
  const amountInput = document.getElementById('hp-amount');

  // Helper function to reset all buttons
  const resetButtons = () => {
    healBtn.style.background = 'white';
    healBtn.style.color = '#7f8c8d';
    healBtn.style.borderColor = '#bdc3c7';
    damageBtn.style.background = 'white';
    damageBtn.style.color = '#7f8c8d';
    damageBtn.style.borderColor = '#bdc3c7';
    tempBtn.style.background = 'white';
    tempBtn.style.color = '#7f8c8d';
    tempBtn.style.borderColor = '#bdc3c7';
  };

  // Toggle button handlers
  healBtn.addEventListener('click', () => {
    actionType = 'heal';
    resetButtons();
    healBtn.style.background = '#27ae60';
    healBtn.style.color = 'white';
    healBtn.style.borderColor = '#27ae60';
  });

  damageBtn.addEventListener('click', () => {
    actionType = 'damage';
    resetButtons();
    damageBtn.style.background = '#e74c3c';
    damageBtn.style.color = 'white';
    damageBtn.style.borderColor = '#e74c3c';
  });

  tempBtn.addEventListener('click', () => {
    actionType = 'temp';
    resetButtons();
    tempBtn.style.background = '#3498db';
    tempBtn.style.color = 'white';
    tempBtn.style.borderColor = '#3498db';
  });

  // Cancel button
  document.getElementById('hp-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // Confirm button
  document.getElementById('hp-confirm').addEventListener('click', () => {
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      showNotification('❌ Please enter a valid amount', 'error');
      return;
    }

    const oldHP = characterData.hitPoints.current;
    const oldTempHP = characterData.temporaryHP || 0;
    const colorBanner = getColoredBanner();
    let messageData;

    if (actionType === 'heal') {
      // Healing: increase current HP (up to max), doesn't affect temp HP (RAW)
      characterData.hitPoints.current = Math.min(currentHP + amount, maxHP);
      const actualHealing = characterData.hitPoints.current - oldHP;

      // Reset death saves on healing
      if (actualHealing > 0 && (characterData.deathSaves.successes > 0 || characterData.deathSaves.failures > 0)) {
        characterData.deathSaves.successes = 0;
        characterData.deathSaves.failures = 0;
        debug.log('♻️ Death saves reset due to healing');
      }

      showNotification(`💚 Healed ${actualHealing} HP! (${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP})`);

      messageData = {
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} regains HP}} {{💚 Healing=${actualHealing} HP}} {{Current HP=${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP}}}`,
        color: characterData.notificationColor
      };
    } else if (actionType === 'damage') {
      // Damage: deplete temp HP first, then current HP (RAW)
      let remainingDamage = amount;
      let tempHPLost = 0;
      let actualDamage = 0;

      if (characterData.temporaryHP > 0) {
        tempHPLost = Math.min(characterData.temporaryHP, remainingDamage);
        characterData.temporaryHP -= tempHPLost;
        remainingDamage -= tempHPLost;
      }

      if (remainingDamage > 0) {
        characterData.hitPoints.current = Math.max(currentHP - remainingDamage, 0);
        actualDamage = oldHP - characterData.hitPoints.current;
      }

      const damageMsg = tempHPLost > 0
        ? `💔 Took ${amount} damage! (${tempHPLost} temp HP${actualDamage > 0 ? ` + ${actualDamage} HP` : ''})`
        : `💔 Took ${actualDamage} damage!`;

      showNotification(`${damageMsg} (${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP})`);

      const damageDetails = tempHPLost > 0
        ? `{{Temp HP Lost=${tempHPLost}}}${actualDamage > 0 ? ` {{HP Lost=${actualDamage}}}` : ''}`
        : `{{HP Lost=${actualDamage}}}`;

      messageData = {
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} takes damage}} {{💔 Total Damage=${amount}}} ${damageDetails} {{Current HP=${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP}}}`,
        color: characterData.notificationColor
      };
    } else if (actionType === 'temp') {
      // Temp HP: RAW rules - new temp HP replaces old if higher, otherwise keep old
      const newTempHP = amount;
      if (newTempHP > oldTempHP) {
        characterData.temporaryHP = newTempHP;
        showNotification(`🛡️ Gained ${newTempHP} temp HP! (${characterData.hitPoints.current}+${characterData.temporaryHP}/${maxHP})`);

        messageData = {
          action: 'announceSpell',
          message: `&{template:default} {{name=${colorBanner}${characterData.name} gains temp HP}} {{🛡️ Temp HP=${newTempHP}}} {{Current HP=${characterData.hitPoints.current}+${characterData.temporaryHP}/${maxHP}}}`,
          color: characterData.notificationColor
        };
      } else {
        showNotification(`⚠️ Kept ${oldTempHP} temp HP (higher than ${newTempHP})`);
        modal.remove();
        return; // Don't send message if temp HP wasn't gained
      }
    }

    // Send message to Roll20
    if (messageData) {
      // Try window.opener first (Chrome)
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(messageData, '*');
        } catch (error) {
          debug.warn('⚠️ Could not send via window.opener:', error.message);
          // Fallback to background script relay
          browserAPI.runtime.sendMessage({
            action: 'relayRollToRoll20',
            roll: messageData
          });
        }
      } else {
        // Fallback: Use background script to relay to Roll20 (Firefox)
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    }

    saveCharacterData();
    buildSheet(characterData);
    modal.remove();
  });

  // Focus on input
  amountInput.focus();
  amountInput.select();

  // Allow Enter key to confirm
  amountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('hp-confirm').click();
    }
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function toggleInspiration() {
  if (!characterData) return;

  if (!characterData.inspiration) {
    // Show modal to gain inspiration
    showGainInspirationModal();
  } else {
    // Show modal to choose how to use inspiration (2014 vs 2024)
    showUseInspirationModal();
  }
}

function showGainInspirationModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 350px; max-width: 450px;';

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">⭐ Gain Inspiration</h3>
    <p style="text-align: center; margin-bottom: 25px; color: #555;">
      You're about to gain Inspiration! This can be used for:
    </p>
    <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <div style="margin-bottom: 12px;">
        <strong style="color: #3498db;">📖 D&D 2014:</strong> Gain advantage on an attack roll, saving throw, or ability check
      </div>
      <div>
        <strong style="color: #e74c3c;">📖 D&D 2024:</strong> Reroll any die immediately after rolling it
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button id="gain-inspiration" style="padding: 15px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        ⭐ Gain It
      </button>
      <button id="cancel-modal" style="padding: 15px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Gain inspiration button
  document.getElementById('gain-inspiration').addEventListener('click', () => {
    characterData.inspiration = true;
    const emoji = '⭐';

    debug.log(`${emoji} Inspiration gained`);
    showNotification(`${emoji} Inspiration gained!`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const messageData = {
      action: 'announceSpell',
      message: `&{template:default} {{name=${colorBanner}${characterData.name} gains Inspiration}} {{${emoji}=You now have Inspiration!}}`,
      color: characterData.notificationColor
    };

    // Send to Roll20
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    } else {
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }

    saveCharacterData();
    buildSheet(characterData);
    modal.remove();
  });

  // Cancel button
  document.getElementById('cancel-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showUseInspirationModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 400px; max-width: 500px;';

  const lastRollInfo = characterData.lastRoll
    ? `<div style="margin-bottom: 20px; padding: 12px; background: #e8f5e9; border-left: 4px solid #27ae60; border-radius: 4px;">
         <strong>Last Roll:</strong> ${characterData.lastRoll.name}
       </div>`
    : `<div style="margin-bottom: 20px; padding: 12px; background: #ffebee; border-left: 4px solid #e74c3c; border-radius: 4px;">
         <strong>⚠️ No previous roll to reroll</strong>
       </div>`;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">✨ Use Inspiration</h3>
    <p style="text-align: center; margin-bottom: 20px; color: #555;">
      How do you want to use your Inspiration?
    </p>
    ${lastRollInfo}
    <div style="display: grid; gap: 12px; margin-bottom: 20px;">
      <button id="use-2014" style="padding: 18px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; text-align: left;">
        <div style="font-size: 1.1em; margin-bottom: 5px;">📖 D&D 2014 - Advantage</div>
        <div style="font-size: 0.85em; opacity: 0.9;">Gain advantage on your next attack roll, saving throw, or ability check</div>
      </button>
      <button id="use-2024" ${!characterData.lastRoll ? 'disabled' : ''} style="padding: 18px; background: ${!characterData.lastRoll ? '#95a5a6' : '#e74c3c'}; color: white; border: none; border-radius: 8px; cursor: ${!characterData.lastRoll ? 'not-allowed' : 'pointer'}; font-weight: bold; text-align: left;">
        <div style="font-size: 1.1em; margin-bottom: 5px;">📖 D&D 2024 - Reroll</div>
        <div style="font-size: 0.85em; opacity: 0.9;">Reroll your last roll and use the new result</div>
      </button>
    </div>
    <button id="cancel-use-modal" style="width: 100%; padding: 12px; background: #7f8c8d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Cancel
    </button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 2014 Advantage button
  document.getElementById('use-2014').addEventListener('click', () => {
    characterData.inspiration = false;
    const emoji = '✨';

    debug.log(`${emoji} Inspiration spent (2014 - Advantage)`);
    showNotification(`${emoji} Inspiration used! Gain advantage on your next roll.`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const messageData = {
      action: 'announceSpell',
      message: `&{template:default} {{name=${colorBanner}${characterData.name} uses Inspiration (2014)}} {{${emoji}=Gain advantage on your next attack roll, saving throw, or ability check!}}`,
      color: characterData.notificationColor
    };

    // Send to Roll20
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    } else {
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }

    saveCharacterData();
    buildSheet(characterData);
    modal.remove();
  });

  // 2024 Reroll button
  if (characterData.lastRoll) {
    document.getElementById('use-2024').addEventListener('click', () => {
      characterData.inspiration = false;
      const emoji = '✨';

      debug.log(`${emoji} Inspiration spent (2024 - Reroll): ${characterData.lastRoll.name}`);
      showNotification(`${emoji} Inspiration used! Rerolling ${characterData.lastRoll.name}...`);

      // Announce to Roll20
      const colorBanner = getColoredBanner();
      const messageData = {
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} uses Inspiration (2024)}} {{${emoji}=Rerolling: ${characterData.lastRoll.name}}}`,
        color: characterData.notificationColor
      };

      // Send to Roll20
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(messageData, '*');
        } catch (error) {
          debug.warn('⚠️ Could not send via window.opener:', error.message);
          browserAPI.runtime.sendMessage({
            action: 'relayRollToRoll20',
            roll: messageData
          });
        }
      } else {
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }

      // Execute the reroll
      const lastRoll = characterData.lastRoll;
      executeRoll(lastRoll.name, lastRoll.formula, lastRoll.effectNotes || []);

      saveCharacterData();
      buildSheet(characterData);
      modal.remove();
    });
  }

  // Cancel button
  document.getElementById('cancel-use-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showDeathSavesModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 300px;';

  const successes = characterData.deathSaves.successes || 0;
  const failures = characterData.deathSaves.failures || 0;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Death Saves</h3>
    <div style="text-align: center; font-size: 1.2em; margin-bottom: 20px;">
      <div style="margin-bottom: 10px;">
        <span style="color: #27ae60; font-weight: bold;">Successes: ${successes}/3</span>
      </div>
      <div>
        <span style="color: #e74c3c; font-weight: bold;">Failures: ${failures}/3</span>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <button id="roll-death-save" style="width: 100%; padding: 15px; font-size: 1.1em; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 15px;">
        🎲 Roll Death Save
      </button>
    </div>

    <div style="margin-bottom: 20px; border-top: 1px solid #ecf0f1; padding-top: 20px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Manual Adjustment:</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <button id="add-success" style="padding: 10px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          + Success
        </button>
        <button id="add-failure" style="padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          + Failure
        </button>
      </div>
      <button id="reset-death-saves" style="width: 100%; padding: 10px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Reset All
      </button>
    </div>

    <button id="close-modal" style="width: 100%; padding: 12px; font-size: 1em; background: #7f8c8d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Close
    </button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Roll death save button
  document.getElementById('roll-death-save').addEventListener('click', () => {
    // Roll 1d20 locally to determine outcome
    const rollResult = Math.floor(Math.random() * 20) + 1;
    debug.log(`🎲 Death Save rolled: ${rollResult}`);

    // Determine outcome based on D&D 5e rules
    let message = '';
    let isSuccess = false;

    if (rollResult === 20) {
      // Natural 20: regain 1 HP (represented as 2 successes in death saves)
      if (characterData.deathSaves.successes < 3) {
        characterData.deathSaves.successes += 2;
        if (characterData.deathSaves.successes > 3) characterData.deathSaves.successes = 3;
      }
      message = `💚 NAT 20! Death Save Success x2 (${characterData.deathSaves.successes}/3)`;
      isSuccess = true;
    } else if (rollResult === 1) {
      // Natural 1: counts as 2 failures
      if (characterData.deathSaves.failures < 3) {
        characterData.deathSaves.failures += 2;
        if (characterData.deathSaves.failures > 3) characterData.deathSaves.failures = 3;
      }
      message = `💀 NAT 1! Death Save Failure x2 (${characterData.deathSaves.failures}/3)`;
    } else if (rollResult >= 10) {
      // Success
      if (characterData.deathSaves.successes < 3) {
        characterData.deathSaves.successes++;
      }
      message = `✓ Death Save Success (${characterData.deathSaves.successes}/3)`;
      isSuccess = true;
    } else {
      // Failure
      if (characterData.deathSaves.failures < 3) {
        characterData.deathSaves.failures++;
      }
      message = `✗ Death Save Failure (${characterData.deathSaves.failures}/3)`;
    }

    // Save updated death saves
    saveCharacterData();
    showNotification(message);

    // Send roll result to Roll20 (show result in name since we rolled locally)
    roll(`Death Save: ${rollResult}`, '1d20', rollResult);

    // Rebuild sheet to show updated death saves
    buildSheet(characterData);
    modal.remove();
  });

  // Add success button
  document.getElementById('add-success').addEventListener('click', () => {
    if (characterData.deathSaves.successes < 3) {
      characterData.deathSaves.successes++;
      saveCharacterData();
      showNotification(`✓ Death Save Success (${characterData.deathSaves.successes}/3)`);
      buildSheet(characterData);
      modal.remove();
    }
  });

  // Add failure button
  document.getElementById('add-failure').addEventListener('click', () => {
    if (characterData.deathSaves.failures < 3) {
      characterData.deathSaves.failures++;
      saveCharacterData();
      showNotification(`✗ Death Save Failure (${characterData.deathSaves.failures}/3)`);
      buildSheet(characterData);
      modal.remove();
    }
  });

  // Reset button
  document.getElementById('reset-death-saves').addEventListener('click', () => {
    characterData.deathSaves.successes = 0;
    characterData.deathSaves.failures = 0;
    saveCharacterData();
    showNotification('♻️ Death saves reset');
    buildSheet(characterData);
    modal.remove();
  });

  // Close button
  document.getElementById('close-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ===== CARD CREATION =====
// Moved to modules/card-creator.js - using wrapper for compatibility
function createCard(title, main, sub, onClick) {
  return window.CardCreator.createCard(title, main, sub, onClick);
}

function createSpellCard(spell, index) {
  const card = document.createElement('div');
  card.className = 'spell-card';

  const header = document.createElement('div');
  header.className = 'spell-header';

  // Build tags string
  let tags = '';
  if (spell.concentration) {
    tags += '<span class="concentration-tag">🧠 Concentration</span>';
  }
  if (spell.ritual) {
    tags += '<span class="ritual-tag">📖 Ritual</span>';
  }

  // All spells get a single Cast button that opens a modal with options
  const castButtonHTML = `<button class="cast-spell-modal-btn" data-spell-index="${index}" style="padding: 6px 12px; background: #9b59b6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">✨ Cast</button>`;

  // Custom macro override button (for magic items and custom spells) - only shown if setting is enabled
  const overrideButtonHTML = showCustomMacroButtons
    ? `<button class="custom-macro-btn" data-spell-index="${index}" style="padding: 6px 12px; background: #34495e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" title="Configure custom macros for this spell">⚙️</button>`
    : '';

  header.innerHTML = `
    <div>
      <span style="font-weight: bold;">${spell.name}</span>
      ${spell.level ? `<span style="margin-left: 10px; color: #666;">Level ${spell.level}</span>` : ''}
      ${tags}
    </div>
    <div style="display: flex; gap: 8px;">
      ${castButtonHTML}
      ${overrideButtonHTML}
      <button class="toggle-btn">▼ Details</button>
    </div>
  `;

  const desc = document.createElement('div');
  desc.className = 'spell-description';
  desc.id = `spell-desc-${index}`;

  // Debug spell data
  if (spell.attackRoll || spell.damage) {
    debug.log(`📝 Spell "${spell.name}" has attack/damage:`, { attackRoll: spell.attackRoll, damage: spell.damage, damageType: spell.damageType });
  }

  desc.innerHTML = `
    ${spell.castingTime ? `<div><strong>Casting Time:</strong> ${spell.castingTime}</div>` : ''}
    ${spell.range ? `<div><strong>Range:</strong> ${spell.range}</div>` : ''}
    ${spell.components ? `<div><strong>Components:</strong> ${spell.components}</div>` : ''}
    ${spell.duration ? `<div><strong>Duration:</strong> ${spell.duration}</div>` : ''}
    ${spell.school ? `<div><strong>School:</strong> ${spell.school}</div>` : ''}
    ${spell.source ? `<div><strong>Source:</strong> ${spell.source}</div>` : ''}
    ${spell.description ? `<div style="margin-top: 10px;">${spell.description}</div>` : ''}
    ${spell.formula ? `<button class="roll-btn">🎲 Roll ${spell.formula}</button>` : ''}
  `;

  // Toggle functionality
  const toggleBtn = header.querySelector('.toggle-btn');
  header.addEventListener('click', (e) => {
    if (!e.target.classList.contains('roll-btn') && !e.target.classList.contains('cast-spell-modal-btn')) {
      desc.classList.toggle('expanded');
      toggleBtn.textContent = desc.classList.contains('expanded') ? '▲ Hide' : '▼ Details';
    }
  });

  // Roll button
  const rollBtn = desc.querySelector('.roll-btn');
  if (rollBtn && spell.formula) {
    rollBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      roll(spell.name, spell.formula);
    });
  }

  // Cast spell modal button
  const castModalBtn = header.querySelector('.cast-spell-modal-btn');
  if (castModalBtn) {
    castModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const spellOptionsResult = getSpellOptions(spell);
      const options = spellOptionsResult.options;

      // Check if this is a "too complicated" spell that should only announce
      if (spellOptionsResult.skipNormalButtons) {
        announceSpellDescription(spell);
        castSpell(spell, index, null, null, [], false, true); // skipAnnouncement = true
        return;
      }

      if (options.length === 0) {
        // No rolls - announce description and cast immediately
        announceSpellDescription(spell);
        castSpell(spell, index, null, null, [], false, true); // skipAnnouncement = true
      } else {
        // Has rolls - show modal with options
        // Check if concentration recast option will exist in modal
        const hasConcentrationRecast = spell.concentration && concentratingSpell === spell.name;

        if (!hasConcentrationRecast) {
          // No concentration recast option - announce description immediately
          announceSpellDescription(spell);
          showSpellModal(spell, index, options, true); // descriptionAnnounced = true
        } else {
          // Has concentration recast - announce from modal button handlers
          showSpellModal(spell, index, options, false); // descriptionAnnounced = false
        }
      }
    });
  }

  // Custom macro override button
  const customMacroBtn = header.querySelector('.custom-macro-btn');
  if (customMacroBtn) {
    customMacroBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showCustomMacroModal(spell, index);
    });
  }

  card.appendChild(header);
  card.appendChild(desc);
  return card;
}

/**
 * Validate spell data and log any issues
 * Cross-checks parsed data against spell description
 */
function validateSpellData(spell) {
  const issues = [];
  const warnings = [];

  // Check if spell has children data
  if (!spell.damageRolls && !spell.attackRoll) {
    console.log(`ℹ️ Spell "${spell.name}" has no attack or damage data (utility spell)`);
    return { valid: true, issues: [], warnings: [] };
  }

  // Validate attack roll
  if (spell.attackRoll && spell.attackRoll !== '(none)') {
    if (typeof spell.attackRoll !== 'string' || spell.attackRoll.trim() === '') {
      issues.push(`Attack roll is invalid: ${spell.attackRoll}`);
    }
  }

  // Validate damage rolls
  if (spell.damageRolls && Array.isArray(spell.damageRolls)) {
    spell.damageRolls.forEach((roll, index) => {
      if (!roll.damage) {
        issues.push(`Damage roll ${index} missing formula`);
      } else if (typeof roll.damage !== 'string' || roll.damage.trim() === '') {
        issues.push(`Damage roll ${index} has invalid formula: ${roll.damage}`);
      }

      if (!roll.damageType) {
        warnings.push(`Damage roll ${index} missing damage type (will show as "untyped")`);
      }

      // Check for dice notation
      const hasDice = /d\d+/i.test(roll.damage);
      if (!hasDice) {
        warnings.push(`Damage roll "${roll.damage}" doesn't contain dice notation - might be a variable reference`);
      }
    });
  }

  // Cross-check against description
  const description = (spell.description || '').toLowerCase();
  const summary = (spell.summary || '').toLowerCase();
  const fullText = `${summary} ${description}`;

  if (fullText) {
    // Check for attack mention (use word boundaries to avoid false positives like Shield's "triggering attack")
    const hasAttackMention = /\b(spell attack|attack roll)\b/i.test(fullText);
    const hasAttackData = spell.attackRoll && spell.attackRoll !== '(none)';

    if (hasAttackMention && !hasAttackData) {
      warnings.push(`Description mentions attack but no attack roll found`);
    } else if (!hasAttackMention && hasAttackData) {
      warnings.push(`Has attack roll but description doesn't mention attack`);
    }

    // Check for damage mention
    const damageMentions = fullText.match(/(\d+d\d+)/g);
    const hasDamageMention = damageMentions && damageMentions.length > 0;
    const hasDamageData = spell.damageRolls && spell.damageRolls.length > 0;

    if (hasDamageMention && !hasDamageData) {
      warnings.push(`Description mentions ${damageMentions.join(', ')} but no damage rolls found`);
    } else if (hasDamageData && !hasDamageMention) {
      // This is fine - description might use variables like "spell level" instead of exact dice
      console.log(`ℹ️ "${spell.name}" has ${spell.damageRolls.length} damage rolls but description doesn't show explicit dice`);
    }
  }

  if (issues.length > 0) {
    console.warn(`❌ Validation issues for spell "${spell.name}":`, issues);
  }

  if (warnings.length > 0) {
    console.warn(`⚠️ Validation warnings for spell "${spell.name}":`, warnings);
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log(`✅ Spell "${spell.name}" validated successfully`);
  }

  return { valid: issues.length === 0, issues, warnings };
}

/**
 * Get available spell options (attack/damage rolls)
 */
function getSpellOptions(spell) {
  // Validate spell data first
  const validation = validateSpellData(spell);

  // Detailed debug logging to trace damage data
  console.log(`🔮 getSpellOptions for "${spell.name}":`, {
    attackRoll: spell.attackRoll,
    damageRolls: spell.damageRolls,
    damageRollsLength: spell.damageRolls ? spell.damageRolls.length : 'undefined',
    damageRollsContent: JSON.stringify(spell.damageRolls),
    concentration: spell.concentration
  });

  const options = [];

  // Check for attack (exclude Shield spell which should never have attack button)
  const isShield = spell.name && spell.name.toLowerCase() === 'shield';
  if (spell.attackRoll && spell.attackRoll !== '(none)' && !isShield) {
    // Handle special flag from dicecloud.js that indicates we should use spell attack bonus
    let attackFormula = spell.attackRoll;
    if (attackFormula === 'use_spell_attack_bonus') {
      const attackBonus = getSpellAttackBonus();
      attackFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
    }

    options.push({
      type: 'attack',
      label: '⚔️ Spell Attack',
      formula: attackFormula,
      icon: '⚔️',
      color: '#e74c3c'
    });
  }

  // Check for damage/healing rolls
  if (spell.damageRolls && spell.damageRolls.length > 0) {
    // Handle lifesteal spells specially (damage + healing based on damage dealt)
    if (spell.isLifesteal) {
      const damageRoll = spell.damageRolls.find(r => r.damageType && r.damageType.toLowerCase() !== 'healing');
      const healingRoll = spell.damageRolls.find(r => r.damageType && r.damageType.toLowerCase() === 'healing');

      if (damageRoll && healingRoll) {
        // Resolve formula for display
        let displayFormula = damageRoll.damage;
        if (displayFormula.includes('~target.level') && characterData.level) {
          displayFormula = displayFormula.replace(/~target\.level/g, characterData.level);
        }
        displayFormula = resolveVariablesInFormula(displayFormula);
        displayFormula = evaluateMathInFormula(displayFormula);

        // Format damage type
        let damageTypeLabel = '';
        if (damageRoll.damageType && damageRoll.damageType !== 'untyped') {
          damageTypeLabel = damageRoll.damageType.charAt(0).toUpperCase() + damageRoll.damageType.slice(1);
        }

        // Check healing formula to determine healing ratio
        const healingFormula = healingRoll.damage.toLowerCase();
        let healingRatio = 'full';
        if (healingFormula.includes('/ 2') || healingFormula.includes('*0.5') || healingFormula.includes('half')) {
          healingRatio = 'half';
        }

        options.push({
          type: 'lifesteal',
          label: `${displayFormula} ${damageTypeLabel} + Heal (${healingRatio})`,
          damageFormula: damageRoll.damage,
          healingFormula: healingRoll.damage,
          damageType: damageRoll.damageType,
          healingRatio: healingRatio,
          icon: '💉',
          color: 'linear-gradient(135deg, #c0392b 0%, #27ae60 100%)'
        });
      }
    } else {
      // Normal spells - show separate buttons for each damage/healing type
      spell.damageRolls.forEach((roll, index) => {
        // Skip rolls that are part of an OR group (they'll be represented by the main roll)
        if (roll.isOrGroupMember) {
          return;
        }

        const isHealing = roll.damageType && roll.damageType.toLowerCase() === 'healing';
        const isTempHP = roll.damageType && (
          roll.damageType.toLowerCase() === 'temphp' ||
          roll.damageType.toLowerCase() === 'temporary' ||
          roll.damageType.toLowerCase().includes('temp')
        );

        // Resolve non-slot-dependent variables for display (character level, ability mods, etc.)
        // Keep slotLevel as-is since we don't know what slot will be used yet
        let displayFormula = roll.damage;

        // Replace ~target.level with character level (for cantrips like Toll the Dead)
        if (displayFormula.includes('~target.level') && characterData.level) {
          displayFormula = displayFormula.replace(/~target\.level/g, characterData.level);
        }

        displayFormula = resolveVariablesInFormula(displayFormula);
        displayFormula = evaluateMathInFormula(displayFormula);

        // If this roll has OR choices, create separate buttons for each choice
        if (roll.orChoices && roll.orChoices.length > 1) {
          roll.orChoices.forEach(choice => {
            // Format damage type nicely
            let damageTypeLabel = '';
            if (choice.damageType && choice.damageType !== 'untyped') {
              damageTypeLabel = choice.damageType.charAt(0).toUpperCase() + choice.damageType.slice(1);
            }

            const label = damageTypeLabel ? `${displayFormula} ${damageTypeLabel}` : displayFormula;

            const choiceIsTempHP = choice.damageType === 'temphp' || choice.damageType === 'temporary' ||
                                    (choice.damageType && choice.damageType.toLowerCase().includes('temp'));

            options.push({
              type: choiceIsTempHP ? 'temphp' : (isHealing ? 'healing' : 'damage'),
              label: label,
              formula: roll.damage,
              damageType: choice.damageType,
              index: index,
              icon: choiceIsTempHP ? '🛡️' : (isHealing ? '💚' : '💥'),
              color: choiceIsTempHP ? '#3498db' : (isHealing ? '#27ae60' : '#e67e22')
            });
          });
        } else {
          // Single damage type - create one button
          // Format damage type nicely
          let damageTypeLabel = '';
          if (roll.damageType && roll.damageType !== 'untyped') {
            // Capitalize first letter
            damageTypeLabel = roll.damageType.charAt(0).toUpperCase() + roll.damageType.slice(1);
          }

          // Build label: formula + damage type
          const label = damageTypeLabel ? `${displayFormula} ${damageTypeLabel}` : displayFormula;

          options.push({
            type: isTempHP ? 'temphp' : (isHealing ? 'healing' : 'damage'),
            label: label,
            formula: roll.damage, // Keep original formula for actual rolling
            damageType: roll.damageType,
            index: index,
            icon: isTempHP ? '🛡️' : (isHealing ? '💚' : '💥'),
            color: isTempHP ? '#3498db' : (isHealing ? '#27ae60' : '#e67e22')
          });
        }
      });
    }
  }

  // Log options before edge case modifications
  console.log(`📋 getSpellOptions "${spell.name}" - options before edge cases:`, options.map(o => `${o.type}: ${o.label}`));

  // Apply edge case modifications
  const result = applyEdgeCaseModifications(spell, options);
  console.log(`📋 getSpellOptions "${spell.name}" - final options:`, result.options?.map(o => `${o.type}: ${o.label}`), 'skipNormalButtons:', result.skipNormalButtons);
  return result;
}

/**
 * Show spell casting modal with options
 * @param {boolean} descriptionAnnounced - Whether spell description was already announced
 */
function showSpellModal(spell, spellIndex, options, descriptionAnnounced = false) {
  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Check for custom macros
  const customMacros = getCustomMacros(spell.name);
  const hasCustomMacros = customMacros && customMacros.buttons && customMacros.buttons.length > 0;

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'spell-modal-overlay';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'spell-modal';
  modal.style.cssText = `background: ${colors.background}; padding: 24px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);`;

  // Modal header
  const header = document.createElement('div');
  header.style.cssText = `margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${colors.border};`;

  // Format spell level text
  let levelText = '';
  if (spell.level === 0) {
    levelText = `<div style="color: ${colors.infoText}; font-size: 14px;">Cantrip</div>`;
  } else if (spell.level) {
    levelText = `<div style="color: ${colors.infoText}; font-size: 14px;">Level ${spell.level} Spell</div>`;
  }

  header.innerHTML = `
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Cast ${spell.name}</h2>
    ${levelText}
  `;

  modal.appendChild(header);

  // Slot selection (for leveled spells)
  let slotSelect = null;
  if (spell.level && spell.level > 0) {
    const slotSection = document.createElement('div');
    slotSection.style.cssText = `margin-bottom: 16px; padding: 12px; background: ${colors.infoBox}; border-radius: 6px;`;

    const slotLabel = document.createElement('label');
    slotLabel.style.cssText = `display: block; margin-bottom: 8px; font-weight: bold; color: ${colors.text};`;
    slotLabel.textContent = 'Cast at level:';

    slotSelect = document.createElement('select');
    slotSelect.style.cssText = `width: 100%; padding: 8px; border: 2px solid ${colors.border}; border-radius: 4px; font-size: 14px; background: ${colors.background}; color: ${colors.text};`;

    // Check for Pact Magic slots (Warlock) - these are SEPARATE from regular spell slots
    // Check both spellSlots and otherVariables since data may come from either source
    // DiceCloud uses various variable names: pactSlot, pactMagicSlots, pactSlotLevelVisible, etc.
    const pactMagicSlotLevel = characterData.spellSlots?.pactMagicSlotLevel ||
                               characterData.otherVariables?.pactMagicSlotLevel ||
                               characterData.otherVariables?.pactSlotLevelVisible ||
                               characterData.otherVariables?.pactSlotLevel ||
                               characterData.otherVariables?.slotLevel;
    const pactMagicSlots = characterData.spellSlots?.pactMagicSlots ??
                           characterData.otherVariables?.pactMagicSlots ??
                           characterData.otherVariables?.pactSlot ?? 0;
    const pactMagicSlotsMax = characterData.spellSlots?.pactMagicSlotsMax ??
                              characterData.otherVariables?.pactMagicSlotsMax ??
                              characterData.otherVariables?.pactSlotMax ?? 0;
    const hasPactMagic = pactMagicSlotsMax > 0;
    // Default slot level to 1 if we have slots but couldn't detect level
    const effectivePactLevel = pactMagicSlotLevel || (hasPactMagic ? 5 : 0); // Default to max (5) if level unknown

    debug.log(`🔮 Pact Magic check: level=${pactMagicSlotLevel} (effective=${effectivePactLevel}), slots=${pactMagicSlots}/${pactMagicSlotsMax}, hasPact=${hasPactMagic}`);

    // Add options for available spell slots (spell level and higher)
    let hasAnySlots = false;
    let firstValidOption = null;

    // First, add Pact Magic slots if available and spell level is compatible
    // Pact Magic slots can cast any spell from level 1 up to the pact slot level
    if (hasPactMagic && spell.level <= effectivePactLevel) {
      hasAnySlots = true;
      const option = document.createElement('option');
      option.value = `pact:${effectivePactLevel}`; // Special format to identify pact slots
      option.textContent = `Level ${effectivePactLevel} - Pact Magic (${pactMagicSlots}/${pactMagicSlotsMax})`;
      option.disabled = pactMagicSlots === 0;
      slotSelect.appendChild(option);
      if (!option.disabled && !firstValidOption) {
        firstValidOption = option;
      }
      debug.log(`🔮 Added Pact Magic slot option: Level ${effectivePactLevel} (${pactMagicSlots}/${pactMagicSlotsMax})`);
    }

    // Then add regular spell slots (excluding the pact magic level to avoid duplicates)
    for (let level = spell.level; level <= 9; level++) {
      const slotsProp = `level${level}SpellSlots`;
      const maxSlotsProp = `level${level}SpellSlotsMax`;
      let available = characterData.spellSlots?.[slotsProp] || characterData[slotsProp] || 0;
      let max = characterData.spellSlots?.[maxSlotsProp] || characterData[maxSlotsProp] || 0;

      // If this level has Pact Magic, subtract pact slots from the total (they're counted separately)
      if (hasPactMagic && level === effectivePactLevel) {
        available = Math.max(0, available - pactMagicSlots);
        max = Math.max(0, max - pactMagicSlotsMax);
      }

      if (max > 0) {
        hasAnySlots = true;
        const option = document.createElement('option');
        option.value = level; // Regular level number for normal slots
        option.textContent = `Level ${level} (${available}/${max} slots)`;
        option.disabled = available === 0;
        slotSelect.appendChild(option);
        if (!option.disabled && !firstValidOption) {
          firstValidOption = option;
        }
      }
    }

    // Select the first valid (non-disabled) option
    if (firstValidOption) {
      firstValidOption.selected = true;
    }

    // If no slots available at all, show a message
    if (!hasAnySlots) {
      const noSlotsOption = document.createElement('option');
      noSlotsOption.value = spell.level;
      noSlotsOption.textContent = 'No spell slots available';
      noSlotsOption.disabled = true;
      noSlotsOption.selected = true;
      slotSelect.appendChild(noSlotsOption);
    }

    slotSection.appendChild(slotLabel);
    slotSection.appendChild(slotSelect);
    modal.appendChild(slotSection);

    // Store reference to update button labels later
    // (will be set after buttons are created)
    slotSelect.updateButtonLabels = null;
  }

  // Concentration spell recast option OR special spells that allow reuse without slots
  // (if already concentrating on this spell, or for spells like Spiritual Weapon, Meld into Stone)
  // NOTE: Cantrips (level 0) never use slots, so don't show this checkbox for them
  let skipSlotCheckbox = null;
  const isCantrip = spell.level === 0;
  const isConcentrationRecast = spell.concentration && concentratingSpell === spell.name;

  // Spells that allow repeated use without consuming slots (non-concentration)
  // Exclude cantrips since they never use slots anyway
  const isReuseableSpellType = !isCantrip && isReuseableSpell(spell.name, characterData);

  // Check if this spell was already cast (stored in localStorage or session)
  const castSpellsKey = `castSpells_${characterData.name}`;
  const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
  const wasAlreadyCast = castSpells.includes(spell.name);

  // Show checkbox for concentration recasts OR for all reuseable spells (even on first cast)
  // But NOT for cantrips since they never consume slots
  if (!isCantrip && (isConcentrationRecast || isReuseableSpellType)) {
    const recastSection = document.createElement('div');
    recastSection.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #fff3cd; border-radius: 6px; border: 2px solid #f39c12;';

    const checkboxContainer = document.createElement('label');
    checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';

    skipSlotCheckbox = document.createElement('input');
    skipSlotCheckbox.type = 'checkbox';
    // Default checked if concentration recast OR if reuseable spell was already cast
    skipSlotCheckbox.checked = isConcentrationRecast || wasAlreadyCast;
    skipSlotCheckbox.style.cssText = 'width: 20px; height: 20px;';

    const checkboxLabel = document.createElement('span');
    checkboxLabel.style.cssText = 'font-weight: bold; color: #856404;';
    if (isConcentrationRecast) {
      checkboxLabel.textContent = '🧠 Already concentrating - don\'t consume spell slot';
    } else if (wasAlreadyCast) {
      checkboxLabel.textContent = '⚔️ Spell already active - don\'t consume spell slot';
    } else {
      checkboxLabel.textContent = '⚔️ Reuse spell effect without consuming slot (first cast required)';
    }

    checkboxContainer.appendChild(skipSlotCheckbox);
    checkboxContainer.appendChild(checkboxLabel);
    recastSection.appendChild(checkboxContainer);

    const helpText = document.createElement('div');
    helpText.style.cssText = 'font-size: 0.85em; color: #856404; margin-top: 6px; margin-left: 28px;';
    if (isConcentrationRecast) {
      helpText.textContent = 'You can use this spell\'s effect again while concentrating on it without recasting.';
    } else {
      helpText.textContent = 'You can use this spell\'s effect again while it\'s active without recasting.';
    }
    recastSection.appendChild(helpText);

    modal.appendChild(recastSection);

    // If skip slot is checked, disable slot selection
    skipSlotCheckbox.addEventListener('change', () => {
      if (slotSelect) {
        slotSelect.disabled = skipSlotCheckbox.checked;
        slotSelect.style.opacity = skipSlotCheckbox.checked ? '0.5' : '1';
      }
    });

    // Initialize disabled state
    if (slotSelect && skipSlotCheckbox.checked) {
      slotSelect.disabled = true;
      slotSelect.style.opacity = '0.5';
    }
  }

  // Metamagic options (if character has metamagic features)
  // Only the 8 official Sorcerer metamagic options from PHB
  const metamagicCheckboxes = [];
  const validMetamagicNames = [
    'Careful Spell',
    'Distant Spell',
    'Empowered Spell',
    'Extended Spell',
    'Heightened Spell',
    'Quickened Spell',
    'Subtle Spell',
    'Twinned Spell'
  ];
  const metamagicFeatures = characterData.features ? characterData.features.filter(f =>
    f.name && validMetamagicNames.includes(f.name)
  ) : [];

  if (metamagicFeatures.length > 0) {
    const metamagicSection = document.createElement('div');
    metamagicSection.style.cssText = `margin-bottom: 16px; padding: 12px; background: ${colors.infoBox}; border-radius: 6px; border: 1px solid ${colors.border};`;

    const metamagicTitle = document.createElement('div');
    metamagicTitle.style.cssText = `font-weight: bold; margin-bottom: 8px; color: ${colors.text};`;
    metamagicTitle.textContent = 'Metamagic:';
    metamagicSection.appendChild(metamagicTitle);

    metamagicFeatures.forEach(feature => {
      const checkboxContainer = document.createElement('label');
      checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = feature.name;
      checkbox.style.cssText = 'width: 18px; height: 18px;';

      const label = document.createElement('span');
      label.textContent = feature.name;
      label.style.cssText = `font-size: 14px; color: ${colors.infoText};`;

      checkboxContainer.appendChild(checkbox);
      checkboxContainer.appendChild(label);
      metamagicSection.appendChild(checkboxContainer);

      metamagicCheckboxes.push(checkbox);
    });

    modal.appendChild(metamagicSection);
  }

  // Track whether spell has been cast (for attack spells)
  let spellCast = false;
  let usedSlot = null;

  // Check if spell has both attack and damage options
  const hasAttack = options.some(opt => opt.type === 'attack');
  const hasDamage = options.some(opt => opt.type === 'damage' || opt.type === 'healing');

  // Options container (spell action buttons)
  const optionsContainer = document.createElement('div');
  optionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  // Helper function to get resolved label for an option based on slot level
  function getResolvedLabel(option, selectedSlotLevel) {
    if (option.type === 'attack') {
      return option.label; // Attack doesn't change with slot level
    }

    // Get the formula for this option
    let formula = option.type === 'lifesteal' ? option.damageFormula : option.formula;
    debug.log(`🏷️ getResolvedLabel called with formula: "${formula}", slotLevel: ${selectedSlotLevel}`);

    // Replace slotLevel with actual slot level (check for null/undefined, but allow 0)
    // Use case-insensitive regex to handle slotLevel, slotlevel, SlotLevel, etc.
    if (selectedSlotLevel != null && formula && /slotlevel/i.test(formula)) {
      const originalFormula = formula;
      formula = formula.replace(/slotlevel/gi, String(selectedSlotLevel));
      debug.log(`  ✅ Replaced slotLevel: "${originalFormula}" -> "${formula}"`);
    }

    // Replace ~target.level with character level
    if (formula && formula.includes('~target.level') && characterData.level) {
      formula = formula.replace(/~target\.level/g, characterData.level);
    }

    // Resolve variables and evaluate math
    formula = resolveVariablesInFormula(formula);
    formula = evaluateMathInFormula(formula);
    debug.log(`  📊 Final resolved formula: "${formula}"`);

    // Build label based on option type
    if (option.type === 'lifesteal') {
      let damageTypeLabel = '';
      if (option.damageType && option.damageType !== 'untyped') {
        damageTypeLabel = option.damageType.charAt(0).toUpperCase() + option.damageType.slice(1);
      }
      return `${formula} ${damageTypeLabel} + Heal (${option.healingRatio})`;
    } else if (option.type === 'damage' || option.type === 'healing' || option.type === 'temphp') {
      let damageTypeLabel = '';
      if (option.damageType && option.damageType !== 'untyped') {
        damageTypeLabel = option.damageType.charAt(0).toUpperCase() + option.damageType.slice(1);
      }
      return damageTypeLabel ? `${formula} ${damageTypeLabel}` : formula;
    }

    return option.label;
  }

  // Add buttons for each option
  const optionButtons = []; // Store buttons so we can update them when slot changes

  // Add custom macro buttons if configured
  if (hasCustomMacros) {
    customMacros.buttons.forEach((customBtn, index) => {
      const btn = document.createElement('button');
      btn.className = 'spell-custom-macro-btn';
      btn.style.cssText = `
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 16px;
        text-align: left;
        transition: opacity 0.2s, transform 0.2s;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      `;
      btn.innerHTML = customBtn.label;

      btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '0.9';
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      });

      btn.addEventListener('click', () => {
        // Send custom macro to chat
        const colorBanner = getColoredBanner();
        const message = customBtn.macro;

        const messageData = {
          action: 'announceSpell',
          message: message,
          color: characterData.notificationColor
        };

        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(messageData, '*');
            debug.log('✅ Custom macro sent via window.opener');
          } catch (error) {
            debug.warn('⚠️ Could not send via window.opener:', error.message);
          }
        } else {
          browserAPI.runtime.sendMessage({
            action: 'relayRollToRoll20',
            roll: messageData
          });
        }

        showNotification(`✨ ${spell.name} - Custom Macro Sent!`, 'success');
        document.body.removeChild(overlay);
      });

      optionsContainer.appendChild(btn);
    });

    // If skipNormalButtons is true, don't add normal spell option buttons
    if (customMacros.skipNormalButtons) {
      debug.log(`⚙️ Skipping normal spell buttons for "${spell.name}" (custom macros only)`);
      // Skip the normal options.forEach below
      options = [];
    }
  }

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = `spell-option-btn-${option.type}`;

    // Special styling for lifesteal buttons to make them more visually distinct
    const isLifesteal = option.type === 'lifesteal';
    const boxShadow = isLifesteal ? 'box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2);' : '';
    const border = isLifesteal ? 'border: 2px solid rgba(255,255,255,0.3);' : 'border: none;';

    btn.style.cssText = `
      padding: 12px 16px;
      background: ${option.color};
      color: white;
      ${border}
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      font-size: 16px;
      text-align: left;
      transition: opacity 0.2s, transform 0.2s;
      ${boxShadow}
    `;

    // Set initial label (with default slot level)
    const initialSlotLevel = spell.level || null;
    const resolvedLabel = getResolvedLabel(option, initialSlotLevel);
    const edgeCaseNote = option.edgeCaseNote ? `<div style="font-size: 0.8em; color: #666; margin-top: 2px;">${option.edgeCaseNote}</div>` : '';
    btn.innerHTML = `${option.icon} ${resolvedLabel}${edgeCaseNote}`;
    btn.dataset.optionIndex = optionButtons.length; // Store index for later updates

    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '0.9';
      if (isLifesteal) btn.style.transform = 'translateY(-2px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '1';
      if (isLifesteal) btn.style.transform = 'translateY(0)';
    });

    optionButtons.push({ button: btn, option: option });

    btn.addEventListener('click', () => {
      // Get selected slot level
      const selectedSlotLevel = slotSelect ? parseInt(slotSelect.value) : (spell.level || null);

      // Get selected metamagic options
      const selectedMetamagic = metamagicCheckboxes
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      // Check if we should skip slot consumption (concentration recast)
      const skipSlot = skipSlotCheckbox ? skipSlotCheckbox.checked : false;

      if (option.type === 'cast') {
        // Cast spell only (for spells with conditional damage like Meld into Stone)
        // Announce description only if not already announced AND not using concentration recast
        if (!descriptionAnnounced && !skipSlot) {
          announceSpellDescription(spell);
        }

        const afterCast = (spell, slot) => {
          usedSlot = slot;
          showNotification(`✨ ${spell.name} cast successfully!`, 'success');
        };
        // Description announced (if needed), don't announce again in castSpell
        castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
        spellCast = true;

        // Disable cast button after casting
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';

        // Don't close modal - allow rolling damage if needed

      } else if (option.type === 'attack') {
        // Cast spell + roll attack, but keep modal open
        // Announce description only if not already announced AND not using concentration recast
        if (!descriptionAnnounced && !skipSlot) {
          announceSpellDescription(spell);
        }

        const afterCast = (spell, slot) => {
          usedSlot = slot;
          const attackBonus = getSpellAttackBonus();
          const attackFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
          roll(`${spell.name} - Spell Attack`, attackFormula);
        };
        // Description announced (if needed), don't announce again in castSpell
        castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
        spellCast = true;

        // Disable slot selection and metamagic after casting
        if (slotSelect) slotSelect.disabled = true;
        metamagicCheckboxes.forEach(cb => cb.disabled = true);

        // Disable attack button after casting
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';

      } else if (option.type === 'damage' || option.type === 'healing' || option.type === 'temphp') {
        // If spell not cast yet (no attack roll), cast it first
        if (!spellCast) {
          // Announce description only if not already announced AND not using concentration recast
          if (!descriptionAnnounced && !skipSlot) {
            announceSpellDescription(spell);
          }

          const afterCast = (spell, slot) => {
            usedSlot = slot;
            let formula = option.formula;
            const actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (slot && slot.level);
            if (actualSlotLevel != null) {
              formula = formula.replace(/slotlevel/gi, actualSlotLevel);
            }
            // Replace ~target.level with character level (for cantrips)
            if (formula.includes('~target.level') && characterData.level) {
              formula = formula.replace(/~target\.level/g, characterData.level);
            }
            formula = resolveVariablesInFormula(formula);
            formula = evaluateMathInFormula(formula);

            const label = option.type === 'healing' ?
              `${spell.name} - Healing` :
              (option.type === 'temphp' ?
                `${spell.name} - Temp HP` :
                `${spell.name} - Damage (${option.damageType || ''})`);
            roll(label, formula);
          };
          // Description announced (if needed), don't announce again in castSpell
          castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
        } else {
          // Spell already cast (via attack), just roll damage
          let formula = option.formula;
          const actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (usedSlot && usedSlot.level);
          if (actualSlotLevel != null) {
            formula = formula.replace(/slotlevel/gi, actualSlotLevel);
          }
          // Replace ~target.level with character level (for cantrips)
          if (formula.includes('~target.level') && characterData.level) {
            formula = formula.replace(/~target\.level/g, characterData.level);
          }
          formula = resolveVariablesInFormula(formula);
          formula = evaluateMathInFormula(formula);

          const label = option.type === 'healing' ?
            `${spell.name} - Healing` :
            (option.type === 'temphp' ?
              `${spell.name} - Temp HP` :
              `${spell.name} - Damage (${option.damageType || ''})`);
          roll(label, formula);
        }

        // Close modal after rolling damage
        document.body.removeChild(overlay);

      } else if (option.type === 'lifesteal') {
        // Lifesteal: Cast spell, roll damage, calculate and apply healing
        // Announce description only if not already announced AND not using concentration recast
        if (!descriptionAnnounced && !skipSlot) {
          announceSpellDescription(spell);
        }

        const afterCast = (spell, slot) => {
          let damageFormula = option.damageFormula;
          const actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (slot && slot.level);
          if (actualSlotLevel != null) {
            damageFormula = damageFormula.replace(/slotlevel/gi, actualSlotLevel);
          }
          if (damageFormula.includes('~target.level') && characterData.level) {
            damageFormula = damageFormula.replace(/~target\.level/g, characterData.level);
          }
          damageFormula = resolveVariablesInFormula(damageFormula);
          damageFormula = evaluateMathInFormula(damageFormula);

          // Roll damage
          roll(`${spell.name} - Lifesteal Damage (${option.damageType})`, damageFormula);

          // After a short delay, prompt for damage dealt to calculate healing
          setTimeout(() => {
            const healingText = option.healingRatio === 'half' ? 'half' : 'the full amount';
            const damageDealt = prompt(`💉 Lifesteal: Enter the damage dealt\n\nYou regain HP equal to ${healingText} of the damage.`);

            if (damageDealt && !isNaN(damageDealt)) {
              const damage = parseInt(damageDealt);
              const healing = option.healingRatio === 'half' ? Math.floor(damage / 2) : damage;

              // Apply healing
              const oldHP = characterData.hitPoints.current;
              const maxHP = characterData.hitPoints.max;
              characterData.hitPoints.current = Math.min(oldHP + healing, maxHP);
              const actualHealing = characterData.hitPoints.current - oldHP;

              // Reset death saves if healing from 0 HP
              if (oldHP === 0 && actualHealing > 0) {
                characterData.deathSaves = { successes: 0, failures: 0 };
                debug.log('♻️ Death saves reset due to healing');
              }

              saveCharacterData();
              buildSheet(characterData);

              // Announce healing
              const colorBanner = getColoredBanner();
              const message = `&{template:default} {{name=${colorBanner}${characterData.name} - Lifesteal}} {{💉 Damage Dealt=${damage}}} {{💚 HP Regained=${actualHealing}}} {{Current HP=${characterData.hitPoints.current}/${maxHP}}}`;

              const messageData = {
                action: 'announceSpell',
                message: message,
                color: characterData.notificationColor
              };

              if (window.opener && !window.opener.closed) {
                try {
                  window.opener.postMessage(messageData, '*');
                } catch (error) {
                  debug.warn('⚠️ Could not send via window.opener:', error.message);
                }
              } else {
                browserAPI.runtime.sendMessage({
                  action: 'relayRollToRoll20',
                  roll: messageData
                });
              }

              showNotification(`💉 Lifesteal! Dealt ${damage} damage, regained ${actualHealing} HP`, 'success');
            }
          }, 500);
        };
        // Description announced (if needed), don't announce again in castSpell
        castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);

        // Close modal after rolling
        document.body.removeChild(overlay);
      }
    });

    optionsContainer.appendChild(btn);
  });

  // Set up slot selection change handler to update button labels
  if (slotSelect) {
    const updateButtonLabels = () => {
      const selectedSlotLevel = parseInt(slotSelect.value);
      optionButtons.forEach(({ button, option }) => {
        const resolvedLabel = getResolvedLabel(option, selectedSlotLevel);
        const edgeCaseNote = option.edgeCaseNote ? `<div style="font-size: 0.8em; color: #666; margin-top: 2px;">${option.edgeCaseNote}</div>` : '';
        button.innerHTML = `${option.icon} ${resolvedLabel}${edgeCaseNote}`;
      });
    };

    // Add change event listener
    slotSelect.addEventListener('change', updateButtonLabels);

    // Call initially to set correct labels for default selection
    updateButtonLabels();
  }

  // Add "Done" button if spell has attack (to close modal after attacking without rolling damage)
  if (hasAttack && hasDamage) {
    const doneBtn = document.createElement('button');
    doneBtn.style.cssText = 'padding: 10px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    optionsContainer.appendChild(doneBtn);
  }

  modal.appendChild(optionsContainer);

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'margin-top: 16px; padding: 10px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  modal.appendChild(cancelBtn);
  overlay.appendChild(modal);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });

  // Add to DOM
  document.body.appendChild(overlay);
}

/**
 * Handle spell option click (attack or damage)
 */
function handleSpellOption(spell, spellIndex, option) {
  if (option.type === 'attack') {
    // Cast spell + roll attack
    const afterCast = (spell, slot) => {
      const attackBonus = getSpellAttackBonus();
      const attackFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
      roll(`${spell.name} - Spell Attack`, attackFormula);
    };
    castSpell(spell, spellIndex, afterCast);
  } else if (option.type === 'damage' || option.type === 'healing') {
    // Handle OR choices if present
    let damageType = option.damageType;
    if (option.orChoices && option.orChoices.length > 1) {
      const choiceText = option.orChoices.map((c, i) => `${i + 1}. ${c.damageType}`).join('\n');
      const choice = prompt(`Choose damage type for ${spell.name}:\n${choiceText}\n\nEnter number (1-${option.orChoices.length}):`);

      if (choice === null) return; // User cancelled

      const choiceIndex = parseInt(choice) - 1;
      if (choiceIndex >= 0 && choiceIndex < option.orChoices.length) {
        damageType = option.orChoices[choiceIndex].damageType;
      } else {
        alert(`Invalid choice. Please try again.`);
        return;
      }
    }

    // Cast spell + roll damage/healing
    const afterCast = (spell, slot) => {
      let formula = option.formula;
      // Replace slotLevel with actual slot level (case-insensitive)
      if (slot && slot.level) {
        formula = formula.replace(/slotlevel/gi, slot.level);
      }
      // Resolve other DiceCloud variables
      formula = resolveVariablesInFormula(formula);
      // Evaluate simple math expressions
      formula = evaluateMathInFormula(formula);

      const label = option.type === 'healing' ?
        `${spell.name} - Healing` :
        (damageType ? `${spell.name} - Damage (${damageType})` : `${spell.name} - Damage`);
      roll(label, formula);
    };
    castSpell(spell, spellIndex, afterCast);
  }
}

// ===== CUSTOM MACRO SYSTEM =====

/**
 * Get custom macros for a spell
 */
function getCustomMacros(spellName) {
  const key = `customMacros_${characterData.name}`;
  const allMacros = JSON.parse(localStorage.getItem(key) || '{}');
  return allMacros[spellName] || null;
}

/**
 * Save custom macros for a spell
 */
function saveCustomMacros(spellName, macros) {
  const key = `customMacros_${characterData.name}`;
  const allMacros = JSON.parse(localStorage.getItem(key) || '{}');

  if (macros && macros.buttons && macros.buttons.length > 0) {
    allMacros[spellName] = macros;
  } else {
    delete allMacros[spellName]; // Remove if no macros defined
  }

  localStorage.setItem(key, JSON.stringify(allMacros));
  debug.log(`💾 Saved custom macros for "${spellName}":`, macros);
}

/**
 * Show custom macro configuration modal
 */
function showCustomMacroModal(spell, spellIndex) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background: white; padding: 24px; border-radius: 8px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

  const existingMacros = getCustomMacros(spell.name);
  const skipNormalButtons = existingMacros?.skipNormalButtons || false;

  modal.innerHTML = `
    <h2 style="margin: 0 0 16px 0; color: #333;">Custom Macros: ${spell.name}</h2>
    <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
      Configure custom macro buttons for this spell. Use this for magic item spells or custom variants that don't work with the default buttons.
    </p>

    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="checkbox" id="skipNormalButtons" ${skipNormalButtons ? 'checked' : ''} style="width: 18px; height: 18px;">
        <span style="font-weight: bold;">Replace default buttons (hide attack/damage buttons)</span>
      </label>
      <p style="margin: 4px 0 0 26px; color: #666; font-size: 13px;">
        Check this to only show your custom macros, hiding the default spell buttons
      </p>
    </div>

    <div id="macro-buttons-container" style="margin-bottom: 16px;">
      <!-- Macro buttons will be added here -->
    </div>

    <button id="add-macro-btn" style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 16px;">
      ➕ Add Macro Button
    </button>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #eee; display: flex; gap: 12px; justify-content: flex-end;">
      <button id="clear-macros-btn" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        🗑️ Clear All
      </button>
      <button id="cancel-macros-btn" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="save-macros-btn" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        💾 Save
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const container = modal.querySelector('#macro-buttons-container');
  const addBtn = modal.querySelector('#add-macro-btn');
  const clearBtn = modal.querySelector('#clear-macros-btn');
  const cancelBtn = modal.querySelector('#cancel-macros-btn');
  const saveBtn = modal.querySelector('#save-macros-btn');

  let macroCounter = 0;

  function addMacroButton(label = '', macro = '') {
    const macroDiv = document.createElement('div');
    macroDiv.className = 'macro-button-config';
    macroDiv.style.cssText = 'padding: 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 12px; border: 2px solid #dee2e6;';
    macroDiv.dataset.macroId = macroCounter++;

    macroDiv.innerHTML = `
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; color: #333;">Button Label:</label>
        <input type="text" class="macro-label" value="${label}" placeholder="e.g., ⚔️ Attack, 💥 Damage, ✨ Cast" style="width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; color: #333;">Macro Text:</label>
        <textarea class="macro-text" placeholder="&{template:default} {{name=My Spell}} {{effect=Custom effect}}" style="width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 4px; font-size: 13px; font-family: monospace; min-height: 80px;">${macro}</textarea>
      </div>
      <button class="remove-macro-btn" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
        ❌ Remove
      </button>
    `;

    const removeBtn = macroDiv.querySelector('.remove-macro-btn');
    removeBtn.addEventListener('click', () => {
      macroDiv.remove();
    });

    container.appendChild(macroDiv);
  }

  // Add existing macros or one empty macro
  if (existingMacros && existingMacros.buttons && existingMacros.buttons.length > 0) {
    existingMacros.buttons.forEach(btn => {
      addMacroButton(btn.label, btn.macro);
    });
  } else {
    addMacroButton();
  }

  addBtn.addEventListener('click', () => addMacroButton());

  clearBtn.addEventListener('click', () => {
    if (confirm(`Clear all custom macros for "${spell.name}"?`)) {
      saveCustomMacros(spell.name, null);
      document.body.removeChild(overlay);
      showNotification(`🗑️ Cleared custom macros for ${spell.name}`, 'success');
    }
  });

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  saveBtn.addEventListener('click', () => {
    const macroConfigs = Array.from(container.querySelectorAll('.macro-button-config'));
    const buttons = macroConfigs.map(config => {
      const label = config.querySelector('.macro-label').value.trim();
      const macro = config.querySelector('.macro-text').value.trim();
      return { label, macro };
    }).filter(btn => btn.label && btn.macro); // Only save if both label and macro are provided

    const skipNormalButtons = modal.querySelector('#skipNormalButtons').checked;

    saveCustomMacros(spell.name, {
      buttons,
      skipNormalButtons
    });

    document.body.removeChild(overlay);
    showNotification(`💾 Saved custom macros for ${spell.name}`, 'success');
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

// ===== SPELL CASTING =====

function castSpell(spell, index, afterCast = null, selectedSlotLevel = null, selectedMetamagic = [], skipSlotConsumption = false, skipAnnouncement = false) {
  debug.log('✨ Attempting to cast:', spell.name, spell, 'at level:', selectedSlotLevel, 'with metamagic:', selectedMetamagic, 'skipSlot:', skipSlotConsumption, 'skipAnnouncement:', skipAnnouncement);

  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  // Check if spell is from a magic item (doesn't consume spell slots)
  const isMagicItemSpell = spell.source && (
    spell.source.toLowerCase().includes('amulet') ||
    spell.source.toLowerCase().includes('ring') ||
    spell.source.toLowerCase().includes('wand') ||
    spell.source.toLowerCase().includes('staff') ||
    spell.source.toLowerCase().includes('rod') ||
    spell.source.toLowerCase().includes('cloak') ||
    spell.source.toLowerCase().includes('boots') ||
    spell.source.toLowerCase().includes('bracers') ||
    spell.source.toLowerCase().includes('gauntlets') ||
    spell.source.toLowerCase().includes('helm') ||
    spell.source.toLowerCase().includes('armor') ||
    spell.source.toLowerCase().includes('weapon') ||
    spell.source.toLowerCase().includes('talisman') ||
    spell.source.toLowerCase().includes('orb') ||
    spell.source.toLowerCase().includes('scroll') ||
    spell.source.toLowerCase().includes('potion')
  );

  // Check if spell has resources field indicating it doesn't consume spell slots
  // Only treat as free if resources.itemsConsumed is explicitly defined (magic items)
  // Normal spells should NOT match this condition
  const isFreeSpell = spell.resources &&
                       spell.resources.itemsConsumed &&
                       spell.resources.itemsConsumed.length > 0;

  // Cantrips (level 0), magic item spells, free spells, or concentration recast don't need slots
  if (!spell.level || spell.level === 0 || spell.level === '0' || isMagicItemSpell || isFreeSpell || skipSlotConsumption) {
    const reason = skipSlotConsumption ? 'concentration recast' : (isMagicItemSpell ? 'magic item' : (isFreeSpell ? 'free spell' : 'cantrip'));
    debug.log(`✨ Casting ${reason} (no spell slot needed)`);
    if (!skipAnnouncement) {
      announceSpellCast(spell, skipSlotConsumption ? 'concentration recast (no slot)' : ((isMagicItemSpell || isFreeSpell) ? `${spell.source} (no slot)` : null));
    }
    showNotification(`✨ ${skipSlotConsumption ? 'Using' : 'Cast'} ${spell.name}!`);

    // Handle concentration
    if (spell.concentration && !skipSlotConsumption) {
      setConcentration(spell.name);
    }

    // Track reuseable spells (Spiritual Weapon, Meld into Stone, etc.)
    const shouldTrackAsReusable = isReuseableSpell(spell.name, characterData);
    if (shouldTrackAsReusable && !skipSlotConsumption) {
      const castSpellsKey = `castSpells_${characterData.name}`;
      const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
      if (!castSpells.includes(spell.name)) {
        castSpells.push(spell.name);
        localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
        debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
      }
    }

    // Execute afterCast with a fake slot for magic items and free spells to allow formulas to work
    if (afterCast && typeof afterCast === 'function') {
      setTimeout(() => {
        // For magic items, free spells, and concentration recasts, create a slot object with the appropriate level
        const fakeSlotLevel = skipSlotConsumption && selectedSlotLevel ? selectedSlotLevel : spell.level;
        const fakeSlot = ((isMagicItemSpell || isFreeSpell || skipSlotConsumption) && fakeSlotLevel) ? { level: parseInt(fakeSlotLevel) } : null;
        afterCast(spell, fakeSlot);
      }, 300);
    }
    return;
  }

  const spellLevel = parseInt(spell.level);

  // If slot level was selected in modal, use it directly
  if (selectedSlotLevel !== null) {
    // Check if slots are nested in spellSlots object or at top level
    const slotsObject = characterData.spellSlots || characterData;

    // Check if this is a Pact Magic slot (format: "pact:${level}")
    const isPactMagicSlot = typeof selectedSlotLevel === 'string' && selectedSlotLevel.startsWith('pact:');
    let actualLevel, slotVar, currentSlots, slotLabel;

    if (isPactMagicSlot) {
      // Parse pact magic slot level
      actualLevel = parseInt(selectedSlotLevel.split(':')[1]);
      slotVar = 'pactMagicSlots';
      // Check both spellSlots and otherVariables for Pact Magic
      currentSlots = slotsObject.pactMagicSlots ?? characterData.otherVariables?.pactMagicSlots ?? 0;
      slotLabel = `Pact Magic (level ${actualLevel})`;
      debug.log(`🔮 Using Pact Magic slot at level ${actualLevel}, current=${currentSlots}`);
    } else {
      // Regular spell slot
      actualLevel = parseInt(selectedSlotLevel);
      slotVar = `level${actualLevel}SpellSlots`;
      currentSlots = slotsObject[slotVar] || 0;
      slotLabel = `level ${actualLevel} slot`;
    }

    if (currentSlots <= 0) {
      showNotification(`❌ No ${slotLabel} remaining!`, 'error');
      return;
    }

    // Consume the slot - update both spellSlots and otherVariables for Pact Magic
    if (isPactMagicSlot) {
      // Decrement pact magic in all locations where it might be stored
      if (slotsObject.pactMagicSlots !== undefined) {
        slotsObject.pactMagicSlots = currentSlots - 1;
      }
      if (characterData.otherVariables?.pactMagicSlots !== undefined) {
        characterData.otherVariables.pactMagicSlots = currentSlots - 1;
      }
      debug.log(`🔮 Consumed Pact Magic slot: ${currentSlots} -> ${currentSlots - 1}`);
    } else {
      slotsObject[slotVar] = currentSlots - 1;
    }
    saveCharacterData();
    buildSheet(characterData);

    // Apply metamagic costs
    if (selectedMetamagic && selectedMetamagic.length > 0) {
      // TODO: Deduct sorcery points based on selected metamagic
      debug.log('Metamagic selected:', selectedMetamagic);
    }

    // Update selectedSlotLevel to actual level for formula resolution
    selectedSlotLevel = actualLevel;

    if (!skipAnnouncement) {
      announceSpellCast(spell, slotLabel);
    }
    showNotification(`✨ Cast ${spell.name} using ${slotLabel}!`);

    // Handle concentration
    if (spell.concentration) {
      setConcentration(spell.name);
    }

    // Track reuseable spells (Spiritual Weapon, Meld into Stone, etc.)
    const shouldTrackAsReusable = isReuseableSpell(spell.name, characterData);
    if (shouldTrackAsReusable) {
      const castSpellsKey = `castSpells_${characterData.name}`;
      const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
      if (!castSpells.includes(spell.name)) {
        castSpells.push(spell.name);
        localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
        debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
      }
    }

    // Execute afterCast
    if (afterCast && typeof afterCast === 'function') {
      setTimeout(() => {
        afterCast(spell, { level: selectedSlotLevel });
      }, 300);
    }
    return;
  }

  // No slot level selected - show upcast choice (legacy behavior)
  showUpcastChoice(spell, spellLevel, afterCast);
}

function detectClassResources(spell) {
  const resources = [];
  const otherVars = characterData.otherVariables || {};

  // Check for Ki (Monk)
  if (otherVars.ki !== undefined || otherVars.kiPoints !== undefined) {
    const ki = otherVars.ki || otherVars.kiPoints || 0;
    const kiMax = otherVars.kiMax || otherVars.kiPointsMax || 0;
    const kiVarName = otherVars.ki !== undefined ? 'ki' : 'kiPoints';
    // Always include Ki if max > 0, even when current is 0 (for proper sync)
    if (kiMax > 0) {
      resources.push({
        name: 'Ki',
        current: ki,
        max: kiMax,
        varName: kiVarName,
        variableName: kiVarName // Add variableName for resource deduction
      });
    }
  }

  // NOTE: Sorcery Points are NOT a casting resource - they're only used for metamagic
  // Metamagic is handled in the spell slot casting flow, not as an alternative resource

  // Check for Pact Magic slots (Warlock)
  if (otherVars.pactMagicSlots !== undefined) {
    const slots = otherVars.pactMagicSlots || 0;
    const slotsMax = otherVars.pactMagicSlotsMax || 0;
    // Always include Pact Magic if max > 0, even when current is 0 (for proper sync)
    if (slotsMax > 0) {
      resources.push({
        name: 'Pact Magic',
        current: slots,
        max: slotsMax,
        varName: 'pactMagicSlots',
        variableName: 'pactMagicSlots' // Add variableName for resource deduction
      });
    }
  }

  // Check for Channel Divinity (Cleric/Paladin)
  // Try class-specific variable names first (channelDivinityCleric, channelDivinityPaladin), then fall back to generic
  let channelDivinityVarName = null;
  let channelDivinityUses = 0;
  let channelDivinityMax = 0;

  if (otherVars.channelDivinityCleric !== undefined) {
    channelDivinityVarName = 'channelDivinityCleric';
    channelDivinityUses = otherVars.channelDivinityCleric || 0;
    channelDivinityMax = otherVars.channelDivinityClericMax || 0;
  } else if (otherVars.channelDivinityPaladin !== undefined) {
    channelDivinityVarName = 'channelDivinityPaladin';
    channelDivinityUses = otherVars.channelDivinityPaladin || 0;
    channelDivinityMax = otherVars.channelDivinityPaladinMax || 0;
  } else if (otherVars.channelDivinity !== undefined) {
    channelDivinityVarName = 'channelDivinity';
    channelDivinityUses = otherVars.channelDivinity || 0;
    channelDivinityMax = otherVars.channelDivinityMax || 0;
  }

  if (channelDivinityVarName && channelDivinityMax > 0) {
    resources.push({
      name: 'Channel Divinity',
      current: channelDivinityUses,
      max: channelDivinityMax,
      varName: channelDivinityVarName,
      variableName: channelDivinityVarName // Add variableName for resource deduction
    });
  }

  return resources;
}

function showResourceChoice(spell, spellLevel, spellSlots, maxSlots, classResources) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let buttonsHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Cast ${spell.name}</h3>
    <p style="text-align: center; color: #7f8c8d; margin-bottom: 25px;">Choose a resource:</p>
    <div style="display: flex; flex-direction: column; gap: 12px;">
  `;

  // Add spell slot option if available
  if (spellSlots > 0) {
    buttonsHTML += `
      <button class="resource-choice-btn" data-type="spell-slot" data-level="${spellLevel}" style="padding: 15px; font-size: 1em; font-weight: bold; background: #9b59b6; color: white; border: 2px solid #9b59b6; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Level ${spellLevel} Spell Slot</span>
          <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${spellSlots}/${maxSlots}</span>
        </div>
      </button>
    `;
  }

  // Add class resource options
  classResources.forEach((resource, idx) => {
    const colors = {
      'Ki': { bg: '#f39c12', border: '#f39c12' },
      'Sorcery Points': { bg: '#e74c3c', border: '#e74c3c' },
      'Pact Magic': { bg: '#16a085', border: '#16a085' },
      'Channel Divinity': { bg: '#3498db', border: '#3498db' }
    };
    const color = colors[resource.name] || { bg: '#95a5a6', border: '#95a5a6' };

    buttonsHTML += `
      <button class="resource-choice-btn" data-type="class-resource" data-index="${idx}" style="padding: 15px; font-size: 1em; font-weight: bold; background: ${color.bg}; color: white; border: 2px solid ${color.border}; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>${resource.name}</span>
          <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${resource.current}/${resource.max}</span>
        </div>
      </button>
    `;
  });

  buttonsHTML += `
    </div>
    <button id="resource-cancel" style="width: 100%; margin-top: 20px; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
      Cancel
    </button>
  `;

  modalContent.innerHTML = buttonsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add hover effects
  const resourceBtns = modalContent.querySelectorAll('.resource-choice-btn');
  resourceBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    });

    btn.addEventListener('click', () => {
      const type = btn.dataset.type;

      if (type === 'spell-slot') {
        const level = parseInt(btn.dataset.level);
        modal.remove();
        // Check if they want to upcast
        showUpcastChoice(spell, level);
      } else if (type === 'class-resource') {
        const resourceIdx = parseInt(btn.dataset.index);
        const resource = classResources[resourceIdx];
        modal.remove();
        if (useClassResource(resource, spell)) {
          announceSpellCast(spell, resource.name);
        }
      }
    });
  });

  // Cancel button
  document.getElementById('resource-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showUpcastChoice(spell, originalLevel, afterCast = null) {
  // Get all available spell slots at this level or higher
  const availableSlots = [];

  // Check for Pact Magic slots (Warlock) - these are SEPARATE from regular spell slots
  const pactMagicSlotLevel = characterData.spellSlots?.pactMagicSlotLevel ||
                             characterData.otherVariables?.pactMagicSlotLevel ||
                             characterData.otherVariables?.pactSlotLevelVisible ||
                             characterData.otherVariables?.pactSlotLevel;
  const pactMagicSlots = characterData.spellSlots?.pactMagicSlots ??
                         characterData.otherVariables?.pactMagicSlots ??
                         characterData.otherVariables?.pactSlot ?? 0;
  const pactMagicSlotsMax = characterData.spellSlots?.pactMagicSlotsMax ??
                            characterData.otherVariables?.pactMagicSlotsMax ?? 0;
  const effectivePactLevel = typeof pactMagicSlotLevel === 'number' ? pactMagicSlotLevel :
                             (pactMagicSlotLevel?.value || (pactMagicSlotsMax > 0 ? 5 : 0));

  // Add Pact Magic slots first if available and spell level is compatible
  if (pactMagicSlotsMax > 0 && originalLevel <= effectivePactLevel && pactMagicSlots > 0) {
    availableSlots.push({
      level: effectivePactLevel,
      current: pactMagicSlots,
      max: pactMagicSlotsMax,
      slotVar: 'pactMagicSlots',
      slotMaxVar: 'pactMagicSlotsMax',
      isPactMagic: true,
      label: `Level ${effectivePactLevel} - Pact Magic`
    });
    debug.log(`🔮 Added Pact Magic to upcast options: Level ${effectivePactLevel} (${pactMagicSlots}/${pactMagicSlotsMax})`);
  }

  // Then check regular spell slots
  for (let level = originalLevel; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;
    let current = characterData.spellSlots?.[slotVar] || 0;
    let max = characterData.spellSlots?.[slotMaxVar] || 0;

    // Skip if this level's slots are actually Pact Magic slots (avoid duplicates)
    if (pactMagicSlotsMax > 0 && level === effectivePactLevel) {
      // Pact Magic is already added separately above
      continue;
    }

    if (current > 0) {
      availableSlots.push({ level, current, max, slotVar, slotMaxVar });
    }
  }

  // Check for metamagic options
  const metamagicOptions = getAvailableMetamagic();
  const sorceryPoints = getSorceryPointsResource();
  debug.log('🔮 Metamagic detection:', {
    metamagicOptions,
    sorceryPoints,
    hasMetamagic: metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0
  });
  const hasMetamagic = metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0;

  // If only the original level is available and no metamagic, just cast it
  if (availableSlots.length === 1 && !hasMetamagic) {
    castWithSlot(spell, availableSlots[0], [], afterCast);
    return;
  }

  // Show upcast modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let dropdownHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Cast ${spell.name}</h3>
    <p style="text-align: center; color: #7f8c8d; margin-bottom: 20px;">Level ${originalLevel} spell</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Spell Slot Level:</label>
      <select id="upcast-slot-select" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  availableSlots.forEach((slot, index) => {
    let label;
    if (slot.isPactMagic) {
      label = `${slot.label} - ${slot.current}/${slot.max} remaining`;
    } else if (slot.level === originalLevel) {
      label = `Level ${slot.level} (Normal) - ${slot.current}/${slot.max} remaining`;
    } else {
      label = `Level ${slot.level} (Upcast) - ${slot.current}/${slot.max} remaining`;
    }
    // Store index so we can identify Pact Magic vs regular slots
    dropdownHTML += `<option value="${index}" data-level="${slot.level}" data-pact="${slot.isPactMagic || false}">${label}</option>`;
  });

  dropdownHTML += `
      </select>
    </div>
  `;

  // Add metamagic options if available
  if (hasMetamagic) {
    dropdownHTML += `
      <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #9b59b6;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 8px;" onclick="document.getElementById('metamagic-container').style.display = document.getElementById('metamagic-container').style.display === 'none' ? 'flex' : 'none'; this.querySelector('.toggle-arrow').textContent = document.getElementById('metamagic-container').style.display === 'none' ? '▶' : '▼';">
          <label style="font-weight: bold; color: #9b59b6; cursor: pointer;">✨ Metamagic (Sorcery Points: ${sorceryPoints.current}/${sorceryPoints.max})</label>
          <span class="toggle-arrow" style="color: #9b59b6; font-size: 0.8em;">▼</span>
        </div>
        <div id="metamagic-container" style="display: flex; flex-direction: column; gap: 6px;">
    `;

    metamagicOptions.forEach((meta, index) => {
      const cost = meta.cost === 'variable' ? calculateMetamagicCost(meta.name, originalLevel) : meta.cost;
      const canAfford = sorceryPoints.current >= cost;
      const disabledStyle = !canAfford ? 'opacity: 0.5; cursor: not-allowed;' : '';

      dropdownHTML += `
          <label style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 4px; cursor: pointer; ${disabledStyle}" title="${meta.description || ''}">
            <input type="checkbox" class="metamagic-option" data-name="${meta.name}" data-cost="${cost}" ${!canAfford ? 'disabled' : ''} style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
            <span style="flex: 1; color: #2c3e50; font-size: 0.95em;">${meta.name}</span>
            <span style="color: #9b59b6; font-weight: bold; font-size: 0.9em;">${cost} SP</span>
          </label>
      `;
    });

    dropdownHTML += `
        </div>
        <div id="metamagic-cost" style="margin-top: 8px; text-align: right; font-weight: bold; color: #2c3e50; font-size: 0.9em;">Total Cost: 0 SP</div>
      </div>
    `;
  }

  dropdownHTML += `
    <div style="display: flex; gap: 10px;">
      <button id="upcast-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="upcast-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cast Spell
      </button>
    </div>
  `;

  modalContent.innerHTML = dropdownHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('upcast-slot-select');
  const confirmBtn = document.getElementById('upcast-confirm');
  const cancelBtn = document.getElementById('upcast-cancel');

  // Track metamagic selections
  let selectedMetamagic = [];

  if (hasMetamagic) {
    const metamagicCheckboxes = document.querySelectorAll('.metamagic-option');
    const costDisplay = document.getElementById('metamagic-cost');

    // Update selected spell level when it changes (affects Twinned Spell cost)
    selectElement.addEventListener('change', () => {
      const selectedIndex = parseInt(selectElement.value);
      const selectedLevel = availableSlots[selectedIndex]?.level || originalLevel;

      // Recalculate costs for variable-cost metamagic
      metamagicCheckboxes.forEach(checkbox => {
        const metaName = checkbox.dataset.name;
        const metaOption = metamagicOptions.find(m => m.name === metaName);
        if (metaOption && metaOption.cost === 'variable') {
          const newCost = calculateMetamagicCost(metaName, selectedLevel);
          checkbox.dataset.cost = newCost;

          // Update display
          const label = checkbox.closest('label');
          const costSpan = label.querySelector('span:last-child');
          costSpan.textContent = `${newCost} SP`;

          // Check if still affordable
          if (sorceryPoints.current < newCost && checkbox.checked) {
            checkbox.checked = false;
          }
        }
      });

      // Update total cost
      updateMetamagicCost();
    });

    function updateMetamagicCost() {
      let totalCost = 0;
      selectedMetamagic = [];

      metamagicCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          const cost = parseInt(checkbox.dataset.cost);
          totalCost += cost;
          selectedMetamagic.push({
            name: checkbox.dataset.name,
            cost: cost
          });
        }
      });

      costDisplay.textContent = `Total Cost: ${totalCost} SP`;

      // Disable confirm if not enough sorcery points
      if (totalCost > sorceryPoints.current) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
      } else {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
      }
    }

    metamagicCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateMetamagicCost);
    });
  }

  confirmBtn.addEventListener('click', () => {
    const selectedIndex = parseInt(selectElement.value);
    const selectedSlot = availableSlots[selectedIndex];
    debug.log(`🔮 Selected slot from upcast modal:`, selectedSlot);
    modal.remove();
    castWithSlot(spell, selectedSlot, selectedMetamagic, afterCast);
  });

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function castWithSlot(spell, slot, metamagicOptions = [], afterCast = null) {
  // Deduct spell slot
  characterData.spellSlots[slot.slotVar] = slot.current - 1;

  // Also update otherVariables for Pact Magic to keep in sync
  if (slot.isPactMagic && characterData.otherVariables?.pactMagicSlots !== undefined) {
    characterData.otherVariables.pactMagicSlots = slot.current - 1;
  }

  // Deduct sorcery points for metamagic
  let totalMetamagicCost = 0;
  let metamagicNames = [];

  if (metamagicOptions && metamagicOptions.length > 0) {
    const sorceryPoints = getSorceryPointsResource();
    if (sorceryPoints) {
      metamagicOptions.forEach(meta => {
        totalMetamagicCost += meta.cost;
        metamagicNames.push(meta.name);
      });

      // Deduct sorcery points
      sorceryPoints.current = Math.max(0, sorceryPoints.current - totalMetamagicCost);
      debug.log(`✨ Used ${totalMetamagicCost} sorcery points for metamagic. Remaining: ${sorceryPoints.current}/${sorceryPoints.max}`);
    }
  }

  // Don't call markActionAsUsed - announceSpellCast already announces to chat

  saveCharacterData();

  let resourceText;
  if (slot.isPactMagic) {
    resourceText = `Pact Magic (Level ${slot.level})`;
  } else if (slot.level > parseInt(spell.level)) {
    resourceText = `Level ${slot.level} slot (upcast from ${spell.level})`;
  } else {
    resourceText = `Level ${slot.level} slot`;
  }

  // Add metamagic to resource text
  if (metamagicNames.length > 0) {
    resourceText += ` + ${metamagicNames.join(', ')} (${totalMetamagicCost} SP)`;
  }

  debug.log(`✅ Used spell slot. Remaining: ${characterData.spellSlots[slot.slotVar]}/${slot.max}`);

  let notificationText = `✨ Cast ${spell.name}! (${characterData.spellSlots[slot.slotVar]}/${slot.max} slots left)`;
  if (metamagicNames.length > 0) {
    const sorceryPoints = getSorceryPointsResource();
    notificationText += ` with ${metamagicNames.join(', ')}! (${sorceryPoints.current}/${sorceryPoints.max} SP left)`;
  }

  announceSpellCast(spell, resourceText);
  showNotification(notificationText);

  // Handle concentration
  if (spell.concentration) {
    setConcentration(spell.name);
  }

  // Track reuseable spells (Spiritual Weapon, Meld into Stone, etc.)
  const shouldTrackAsReusable = isReuseableSpell(spell.name, characterData);
  if (shouldTrackAsReusable) {
    const castSpellsKey = `castSpells_${characterData.name}`;
    const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
    if (!castSpells.includes(spell.name)) {
      castSpells.push(spell.name);
      localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
      debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
    }
  }

  // Update the display
  buildSheet(characterData);

  // Execute after-cast callback (for rolling attack/damage/healing)
  if (afterCast && typeof afterCast === 'function') {
    setTimeout(() => {
      afterCast(spell, slot);
    }, 300); // Small delay to ensure chat message is sent first
  }
}

function useClassResource(resource, spell) {
  if (resource.current <= 0) {
    showNotification(`❌ No ${resource.name} remaining!`, 'error');
    return false;
  }

  characterData.otherVariables[resource.varName] = resource.current - 1;

  // Don't call markActionAsUsed - announceSpellCast already announces to chat

  saveCharacterData();

  debug.log(`✅ Used ${resource.name}. Remaining: ${characterData.otherVariables[resource.varName]}/${resource.max}`);
  showNotification(`✨ Cast ${spell.name}! (${characterData.otherVariables[resource.varName]}/${resource.max} ${resource.name} left)`);

  // Handle concentration
  if (spell.concentration) {
    setConcentration(spell.name);
  }

  // Track reuseable spells (Spiritual Weapon, Meld into Stone, etc.)
  const shouldTrackAsReusable = isReuseableSpell(spell.name, characterData);
  if (shouldTrackAsReusable) {
    const castSpellsKey = `castSpells_${characterData.name}`;
    const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
    if (!castSpells.includes(spell.name)) {
      castSpells.push(spell.name);
      localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
      debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
    }
  }

  buildSheet(characterData);
  return true;
}

// ===== COLOR UTILITIES =====
// Moved to modules/color-utils.js - using wrapper functions for compatibility
function getColorEmoji(color) {
  return window.ColorUtils.getColorEmoji(color);
}

function getColoredBanner() {
  return window.ColorUtils.getColoredBanner(characterData);
}

function getColorName(hexColor) {
  return window.ColorUtils.getColorName(hexColor);
}

// Get the spellcasting ability modifier based on character class
function getSpellcastingAbilityMod() {
  if (!characterData || !characterData.abilityMods) {
    return 0;
  }

  const charClass = (characterData.class || '').toLowerCase();

  // Map classes to their spellcasting abilities
  // Wisdom-based: Cleric, Druid, Ranger, Monk
  if (charClass.includes('cleric') || charClass.includes('druid') ||
      charClass.includes('ranger') || charClass.includes('monk')) {
    return characterData.abilityMods.wisdomMod || 0;
  }
  // Intelligence-based: Wizard, Artificer, Eldritch Knight, Arcane Trickster
  else if (charClass.includes('wizard') || charClass.includes('artificer') ||
           charClass.includes('eldritch knight') || charClass.includes('arcane trickster')) {
    return characterData.abilityMods.intelligenceMod || 0;
  }
  // Charisma-based: Sorcerer, Bard, Warlock, Paladin
  else if (charClass.includes('sorcerer') || charClass.includes('bard') ||
           charClass.includes('warlock') || charClass.includes('paladin')) {
    return characterData.abilityMods.charismaMod || 0;
  }

  // Default to highest mental stat
  const intMod = characterData.abilityMods.intelligenceMod || 0;
  const wisMod = characterData.abilityMods.wisdomMod || 0;
  const chaMod = characterData.abilityMods.charismaMod || 0;
  return Math.max(intMod, wisMod, chaMod);
}

// Calculate spell attack bonus
function getSpellAttackBonus() {
  const spellMod = getSpellcastingAbilityMod();
  const profBonus = characterData.proficiencyBonus || 0;
  return spellMod + profBonus;
}

// Calculate total AC including active effects
function calculateTotalAC() {
  const baseAC = characterData.armorClass || 10;
  let totalAC = baseAC;

  // Combine all active effects
  const allEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && e.autoApply && e.modifier && e.modifier.ac);

  // Apply AC modifiers from active effects
  for (const effect of allEffects) {
    const acMod = effect.modifier.ac;
    if (typeof acMod === 'number') {
      totalAC += acMod;
      debug.log(`🛡️ Applied AC modifier: ${acMod} from ${effect.name} (${effect.type})`);
    }
  }

  debug.log(`🛡️ Total AC calculation: ${baseAC} (base) + modifiers = ${totalAC}`);
  return totalAC;
}

/**
 * Announce spell description to chat
 * Called immediately when Cast button is clicked, before any modal
 */
function announceSpellDescription(spell) {
  // Build a fancy formatted message using Roll20 template syntax with custom color
  const colorBanner = getColoredBanner();
  let message = `&{template:default} {{name=${colorBanner}${characterData.name} casts ${spell.name}!}}`;

  // Add spell level and school
  if (spell.level && spell.level > 0) {
    let levelText = `Level ${spell.level}`;
    if (spell.school) {
      levelText += ` ${spell.school}`;
    }
    message += ` {{Level=${levelText}}}`;
  } else if (spell.school) {
    message += ` {{Level=${spell.school} cantrip}}`;
  }

  // Add casting details
  if (spell.castingTime) {
    message += ` {{Casting Time=${spell.castingTime}}}`;
  }
  if (spell.range) {
    message += ` {{Range=${spell.range}}}`;
  }
  if (spell.duration) {
    message += ` {{Duration=${spell.duration}}}`;
  }

  // Add components if available
  if (spell.components) {
    message += ` {{Components=${spell.components}}}`;
  }

  // Add description
  if (spell.description) {
    message += ` {{Description=${spell.description}}}`;
  }

  // Send to Roll20 chat
  const messageData = {
    action: 'announceSpell',
    spellName: spell.name,
    characterName: characterData.name,
    message: message,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      debug.log('✅ Spell description announced via window.opener');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fall through to background script relay
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    debug.log('📡 Using background script to relay spell announcement to Roll20...');
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    }, (response) => {
      if (browserAPI.runtime.lastError) {
        debug.error('❌ Error relaying spell announcement:', browserAPI.runtime.lastError);
      } else if (response && response.success) {
        debug.log('✅ Spell description announced to Roll20');
      }
    });
  }
}

/**
 * Legacy function kept for backward compatibility with utility spells
 * For attack/damage spells, use announceSpellDescription() instead
 */
function announceSpellCast(spell, resourceUsed) {
  // For spells with attack/damage, description was already announced
  // This just announces resource usage
  if (resourceUsed) {
    const colorBanner = getColoredBanner();
    let message = `&{template:default} {{name=${colorBanner}${spell.name}}}`;
    message += ` {{Resource Used=${resourceUsed}}}`;

    const messageData = {
      action: 'announceSpell',
      spellName: spell.name,
      characterName: characterData.name,
      message: message,
      color: characterData.notificationColor
    };

    // Try window.opener first (Chrome)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
        debug.log('✅ Spell resource usage sent via window.opener');
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
      }
    } else {
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      }, (response) => {
        if (browserAPI.runtime.lastError) {
          debug.error('❌ Error relaying spell announcement:', browserAPI.runtime.lastError);
        }
      });
    }
  }

  // Also roll if there's a formula (utility spells)
  if (spell.formula) {
    setTimeout(() => {
      roll(spell.name, spell.formula);
    }, 500);
  }
}

// ===== METAMAGIC SYSTEM =====

function getAvailableMetamagic() {
  // Metamagic costs (in sorcery points)
  const metamagicCosts = {
    'Careful Spell': 1,
    'Distant Spell': 1,
    'Empowered Spell': 1,
    'Extended Spell': 1,
    'Heightened Spell': 3,
    'Quickened Spell': 2,
    'Subtle Spell': 1,
    'Twinned Spell': 'variable' // Cost equals spell level (min 1 for cantrips)
  };

  if (!characterData || !characterData.features) {
    debug.log('🔮 No characterData or features for metamagic detection');
    return [];
  }

  // DEBUG: Log all features to see what we have
  debug.log('🔮 All character features:', characterData.features.map(f => f.name));

  // Find metamagic features (case-insensitive matching)
  const metamagicOptions = characterData.features.filter(feature => {
    const name = feature.name.trim();
    // Try exact match first
    let matchedName = null;
    if (metamagicCosts.hasOwnProperty(name)) {
      matchedName = name;
    } else {
      // Try case-insensitive match
      matchedName = Object.keys(metamagicCosts).find(key =>
        key.toLowerCase() === name.toLowerCase()
      );
    }

    if (matchedName) {
      debug.log(`🔮 Found metamagic feature: "${name}" (matched as "${matchedName}")`);
      feature._matchedName = matchedName; // Store for later use
      return true;
    }
    return false;
  }).map(feature => {
    const matchedName = feature._matchedName || feature.name.trim();
    return {
      name: matchedName,
      cost: metamagicCosts[matchedName],
      description: feature.description || ''
    };
  });

  debug.log('🔮 Found metamagic options:', metamagicOptions.map(m => m.name));
  return metamagicOptions;
}

function getSorceryPointsResource() {
  if (!characterData || !characterData.resources) {
    debug.log('🔮 No characterData or resources for sorcery points detection');
    return null;
  }

  // DEBUG: Log all resources to see what we have
  debug.log('🔮 All character resources:', characterData.resources.map(r => ({ name: r.name, current: r.current, max: r.max })));

  // Find sorcery points in resources (flexible matching)
  const sorceryResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase().trim();
    const isSorceryPoints =
      lowerName.includes('sorcery point') ||
      lowerName === 'sorcery points' ||
      lowerName === 'sorcery' ||
      lowerName.includes('sorcerer point');
    if (isSorceryPoints) {
      debug.log(`🔮 Found sorcery points resource: "${r.name}" (${r.current}/${r.max})`);
    }
    return isSorceryPoints;
  });

  if (!sorceryResource) {
    debug.log('🔮 No sorcery points resource found');
  }

  return sorceryResource || null;
}

function getKiPointsResource() {
  if (!characterData || !characterData.resources) return null;

  // Find ki points in resources
  const kiResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase();
    return lowerName.includes('ki point') || lowerName === 'ki points' || lowerName === 'ki';
  });

  return kiResource || null;
}

function getLayOnHandsResource() {
  if (!characterData || !characterData.resources) return null;

  // Find Lay on Hands pool in resources
  const layOnHandsResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase();
    return lowerName.includes('lay on hands') || lowerName === 'lay on hands pool';
  });

  return layOnHandsResource || null;
}

function handleLayOnHands(action) {
  const layOnHandsPool = getLayOnHandsResource();

  if (!layOnHandsPool) {
    showNotification(`❌ No Lay on Hands pool resource found`, 'error');
    return;
  }

  if (layOnHandsPool.current <= 0) {
    showNotification(`❌ No Lay on Hands points remaining!`, 'error');
    return;
  }

  // Prompt user for how many points to spend
  const maxPoints = layOnHandsPool.current;
  const amountStr = prompt(
    `Lay on Hands\n\n` +
    `Available Points: ${layOnHandsPool.current}/${layOnHandsPool.max}\n\n` +
    `How many hit points do you want to restore?\n` +
    `(Enter 1-${maxPoints}, or 5 to cure disease/poison)`
  );

  if (amountStr === null) return; // Cancelled

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount < 1) {
    showNotification(`❌ Please enter a valid number`, 'error');
    return;
  }

  if (amount > maxPoints) {
    showNotification(`❌ Not enough points! You have ${maxPoints} remaining`, 'error');
    return;
  }

  // Deduct points
  layOnHandsPool.current -= amount;
  saveCharacterData();

  // Announce the healing
  debug.log(`💚 Used ${amount} Lay on Hands points. Remaining: ${layOnHandsPool.current}/${layOnHandsPool.max}`);

  if (amount === 5) {
    // Might be curing disease/poison
    announceAction({
      name: 'Lay on Hands',
      description: `Restored ${amount} HP (or cured disease/poison)`
    });
    showNotification(`💚 Lay on Hands: ${amount} HP (${layOnHandsPool.current}/${layOnHandsPool.max} points left)`);
  } else {
    announceAction({
      name: 'Lay on Hands',
      description: `Restored ${amount} HP`
    });
    showNotification(`💚 Lay on Hands: Restored ${amount} HP (${layOnHandsPool.current}/${layOnHandsPool.max} points left)`);
  }

  // Refresh display to show updated pool
  buildSheet(characterData);
}

function handleRecoverSpellSlot(action) {
  // Calculate max recoverable level from proficiency bonus
  const profBonus = characterData.proficiencyBonus || 2;
  const maxLevel = Math.ceil(profBonus / 2);
  
  debug.log(`🔮 Recover Spell Slot: proficiencyBonus=${profBonus}, maxLevel=${maxLevel}`);
  
  // Find available spell slots of eligible levels
  const eligibleSlots = [];
  for (let level = 1; level <= maxLevel && level <= 9; level++) {
    const slotKey = `level${level}SpellSlots`;
    const maxKey = `level${level}SpellSlotsMax`;
    
    if (characterData[slotKey] !== undefined && characterData[maxKey] !== undefined) {
      const current = characterData[slotKey];
      const max = characterData[maxKey];
      
      if (current < max) {
        eligibleSlots.push({ level, current, max, slotKey, maxKey });
      }
    }
  }
  
  if (eligibleSlots.length === 0) {
    showNotification(`❌ No spell slots to recover (max level: ${maxLevel})`, 'error');
    return;
  }
  
  // If only one eligible slot, recover it automatically
  if (eligibleSlots.length === 1) {
    const slot = eligibleSlots[0];
    recoverSpellSlot(slot, action, maxLevel);
    return;
  }
  
  // If multiple slots, let user choose
  let message = `Recover Spell Slot (max level: ${maxLevel})\n\nChoose which spell slot to recover:\n\n`;
  eligibleSlots.forEach((slot, index) => {
    message += `${index + 1}. Level ${slot.level}: ${slot.current}/${slot.max}\n`;
  });
  
  const choice = prompt(message);
  if (choice === null) return; // Cancelled
  
  const choiceIndex = parseInt(choice) - 1;
  if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= eligibleSlots.length) {
    showNotification('❌ Invalid choice', 'error');
    return;
  }
  
  const selectedSlot = eligibleSlots[choiceIndex];
  recoverSpellSlot(selectedSlot, action, maxLevel);
}

function recoverSpellSlot(slot, action, maxLevel) {
  // Increment the spell slot
  characterData[slot.slotKey] = Math.min(characterData[slot.slotKey] + 1, characterData[slot.maxKey]);
  saveCharacterData();
  
  // Create description with resolved formula
  const description = `You expend a use of your Channel Divinity to fuel your spells. As a bonus action, you touch your holy symbol, utter a prayer, and regain one expended spell slot, the level of which can be no higher than ${maxLevel}.`;
  
  // Announce the action
  announceAction({
    name: action.name,
    description: description,
    actionType: action.actionType || 'bonus'
  });
  
  showNotification(`🔮 Recovered Level ${slot.level} Spell Slot (${characterData[slot.slotKey]}/${characterData[slot.maxKey]})`, 'success');
  
  // Refresh display
  buildSheet(characterData);
}

// Helper function to find resources with flexible Channel Divinity matching
function findResourceByVariableName(variableName) {
  // Check for exact match first
  let resource = characterData.resources?.find(r => r.variableName === variableName);

  if (resource) {
    return resource;
  }

  // Special handling for Channel Divinity - try all possible variable names
  if (variableName === 'channelDivinity' ||
      variableName === 'channelDivinityCleric' ||
      variableName === 'channelDivinityPaladin') {
    resource = characterData.resources?.find(r =>
      r.name === 'Channel Divinity' ||
      r.variableName === 'channelDivinityCleric' ||
      r.variableName === 'channelDivinityPaladin' ||
      r.variableName === 'channelDivinity'
    );
  }

  return resource;
}

function getResourceCostsFromAction(action) {
  // Use DiceCloud's structured resource consumption data instead of regex parsing
  if (!action || !action.resources || !action.resources.attributesConsumed) {
    return [];
  }

  const costs = action.resources.attributesConsumed.map(consumed => {
    const quantity = consumed.quantity?.value || 0;
    return {
      name: consumed.statName || '',
      variableName: consumed.variableName || '',
      quantity: quantity
    };
  });

  if (costs.length > 0) {
    debug.log(`💰 Resource costs for ${action.name}:`, costs);
    // Debug: Log each cost with its variableName
    costs.forEach(cost => {
      debug.log(`   📋 Cost: ${cost.name || 'unnamed'}, variableName: "${cost.variableName}", quantity: ${cost.quantity}`);
    });
  }

  return costs;
}

// Legacy functions for backwards compatibility (now use structured data)
function getKiCostFromAction(action) {
  const costs = getResourceCostsFromAction(action);
  const kiCost = costs.find(c =>
    c.variableName === 'kiPoints' ||
    c.name.toLowerCase().includes('ki point')
  );

  if (kiCost) {
    debug.log(`💨 Ki cost for ${action.name}: ${kiCost.quantity} ki points`);
    return kiCost.quantity;
  }

  return 0;
}

function getSorceryPointCostFromAction(action) {
  const costs = getResourceCostsFromAction(action);
  const sorceryCost = costs.find(c =>
    c.variableName === 'sorceryPoints' ||
    c.name.toLowerCase().includes('sorcery point')
  );

  if (sorceryCost) {
    debug.log(`✨ Sorcery Point cost for ${action.name}: ${sorceryCost.quantity} SP`);
    return sorceryCost.quantity;
  }

  return 0;
}

function decrementActionResources(action) {
  // Decrement all resource costs for an action (Wild Shape uses, Breath Weapon uses, etc.)
  const costs = getResourceCostsFromAction(action);

  if (!costs || costs.length === 0) {
    return true; // No resources to decrement
  }

  // Check all resources have sufficient quantities before decrementing any
  for (const cost of costs) {
    // Skip Ki and Sorcery Points as they're handled separately
    if (cost.variableName === 'kiPoints' || cost.variableName === 'sorceryPoints') {
      continue;
    }

    if (!cost.variableName) {
      debug.log(`⚠️ Resource cost missing variableName for ${action.name}:`, cost);
      continue;
    }

    // Find the resource in character data (with flexible Channel Divinity matching)
    const resource = findResourceByVariableName(cost.variableName);

    if (!resource) {
      debug.log(`⚠️ Resource not found: ${cost.variableName} for ${action.name}`);
      continue;
    }

    if (resource.current < cost.quantity) {
      showNotification(`❌ Not enough ${cost.name || cost.variableName}! Need ${cost.quantity}, have ${resource.current}`, 'error');
      return false;
    }
  }

  // All checks passed, now decrement the resources
  for (const cost of costs) {
    // Skip Ki and Sorcery Points as they're handled separately
    if (cost.variableName === 'kiPoints' || cost.variableName === 'sorceryPoints') {
      continue;
    }

    if (!cost.variableName) {
      continue;
    }

    // Find the resource (with flexible Channel Divinity matching)
    const resource = findResourceByVariableName(cost.variableName);

    if (resource) {
      resource.current -= cost.quantity;

      // Also update otherVariables to keep data in sync
      if (characterData.otherVariables && resource.varName) {
        characterData.otherVariables[resource.varName] = resource.current;
      }

      debug.log(`✅ Used ${cost.quantity} ${cost.name || cost.variableName} for ${action.name}. Remaining: ${resource.current}/${resource.max}`);
      showNotification(`✅ Used ${action.name}! (${resource.current}/${resource.max} ${cost.name || cost.variableName} left)`);
    }
  }

  saveCharacterData();
  buildSheet(characterData); // Refresh display
  return true;
}

function calculateMetamagicCost(metamagicName, spellLevel) {
  const metamagicCosts = {
    'Careful Spell': 1,
    'Distant Spell': 1,
    'Empowered Spell': 1,
    'Extended Spell': 1,
    'Heightened Spell': 3,
    'Quickened Spell': 2,
    'Subtle Spell': 1,
    'Twinned Spell': 'variable'
  };

  const cost = metamagicCosts[metamagicName];
  if (cost === 'variable') {
    // Twinned Spell costs spell level (minimum 1 for cantrips)
    return Math.max(1, spellLevel);
  }
  return cost || 0;
}

function showConvertSlotToPointsModal() {
  const sorceryPoints = getSorceryPointsResource();

  if (!sorceryPoints) {
    showNotification('❌ No Sorcery Points resource found', 'error');
    return;
  }

  // Get available spell slots
  const availableSlots = [];
  for (let level = 1; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const maxSlotVar = `level${level}SpellSlotsMax`;
    const current = characterData.spellSlots?.[slotVar] || 0;
    const max = characterData.spellSlots?.[maxSlotVar] || 0;

    if (current > 0) {
      availableSlots.push({ level, current, max, slotVar, maxSlotVar });
    }
  }

  if (availableSlots.length === 0) {
    showNotification('❌ No spell slots available to convert!', 'error');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let optionsHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">Convert Spell Slot to Sorcery Points</h3>
    <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Expend Spell Slot:</label>
      <select id="slot-to-points-level" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  availableSlots.forEach(slot => {
    optionsHTML += `<option value="${slot.level}">Level ${slot.level} - Gain ${slot.level} SP (${slot.current}/${slot.max} slots)</option>`;
  });

  optionsHTML += `
      </select>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="slot-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="slot-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Convert
      </button>
    </div>
  `;

  modalContent.innerHTML = optionsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('slot-to-points-level');
  const confirmBtn = document.getElementById('slot-confirm');
  const cancelBtn = document.getElementById('slot-cancel');

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  confirmBtn.addEventListener('click', () => {
    const selectedLevel = parseInt(selectElement.value);
    const slotVar = `level${selectedLevel}SpellSlots`;
    const currentSlots = characterData.spellSlots?.[slotVar] || 0;

    if (currentSlots <= 0) {
      showNotification(`❌ No Level ${selectedLevel} spell slots available!`, 'error');
      return;
    }

    // Remove spell slot
    characterData.spellSlots[slotVar] -= 1;

    // Gain sorcery points equal to slot level
    const pointsGained = selectedLevel;
    sorceryPoints.current = Math.min(sorceryPoints.current + pointsGained, sorceryPoints.max);

    saveCharacterData();

    const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
    const newSlotCount = characterData.spellSlots[slotVar];
    const maxSlots = characterData.spellSlots[maxSlotVar];
    showNotification(`✨ Gained ${pointsGained} Sorcery Points! (${sorceryPoints.current}/${sorceryPoints.max} SP, ${newSlotCount}/${maxSlots} slots)`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Spell Slot to Sorcery Points}} {{Result=Expended Level ${selectedLevel} spell slot for ${pointsGained} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'roll',
        characterName: characterData.name,
        message: message,
        color: characterData.notificationColor
      }, '*');
    }

    document.body.removeChild(modal);
    buildSheet(characterData); // Refresh display
  });
}

function showFontOfMagicModal() {
  const sorceryPoints = getSorceryPointsResource();

  if (!sorceryPoints) {
    showNotification('❌ No Sorcery Points resource found', 'error');
    return;
  }

  // Font of Magic spell slot creation costs (D&D 5e rules)
  const slotCosts = {
    1: 2,
    2: 3,
    3: 5,
    4: 6,
    5: 7
  };

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let optionsHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">Convert Sorcery Points to Spell Slot</h3>
    <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Create Spell Slot Level:</label>
      <select id="font-of-magic-slot" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  // Add options for each spell slot level
  for (let level = 1; level <= 5; level++) {
    const cost = slotCosts[level];
    const canAfford = sorceryPoints.current >= cost;
    const slotVar = `level${level}SpellSlots`;
    const maxSlotVar = `level${level}SpellSlotsMax`;
    const currentSlots = characterData.spellSlots?.[slotVar] || 0;
    const maxSlots = characterData.spellSlots?.[maxSlotVar] || 0;

    const disabledAttr = canAfford ? '' : 'disabled';
    const affordText = canAfford ? '' : ' (not enough SP)';

    optionsHTML += `<option value="${level}" ${disabledAttr}>Level ${level} - ${cost} SP${affordText} (${currentSlots}/${maxSlots} slots)</option>`;
  }

  optionsHTML += `
      </select>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="font-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="font-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #e74c3c; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Convert
      </button>
    </div>
  `;

  modalContent.innerHTML = optionsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('font-of-magic-slot');
  const confirmBtn = document.getElementById('font-confirm');
  const cancelBtn = document.getElementById('font-cancel');

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  confirmBtn.addEventListener('click', () => {
    const selectedLevel = parseInt(selectElement.value);
    const cost = slotCosts[selectedLevel];

    if (sorceryPoints.current < cost) {
      showNotification(`❌ Not enough Sorcery Points! Need ${cost}, have ${sorceryPoints.current}`, 'error');
      return;
    }

    // Deduct sorcery points
    sorceryPoints.current -= cost;

    // Add spell slot
    const slotVar = `level${selectedLevel}SpellSlots`;
    const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
    const maxSlots = characterData.spellSlots?.[maxSlotVar] || 0;

    characterData.spellSlots[slotVar] = Math.min((characterData.spellSlots[slotVar] || 0) + 1, maxSlots);

    saveCharacterData();

    const currentSlots = characterData.spellSlots[slotVar];
    showNotification(`✨ Created Level ${selectedLevel} spell slot! (${sorceryPoints.current}/${sorceryPoints.max} SP left, ${currentSlots}/${maxSlots} slots)`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Sorcery Points to Spell Slot}} {{Result=Created Level ${selectedLevel} spell slot for ${cost} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'roll',
        characterName: characterData.name,
        message: message,
        color: characterData.notificationColor
      }, '*');
    }

    document.body.removeChild(modal);
    buildSheet(characterData); // Refresh display
  });
}

function announceAction(action) {
  // Announce the use of an action (bonus action, reaction, etc.) to Roll20 chat
  const colorBanner = getColoredBanner();

  // Determine action type emoji
  const actionTypeEmoji = {
    'bonus': '⚡',
    'reaction': '🛡️',
    'action': '⚔️',
    'free': '💨',
    'legendary': '👑',
    'lair': '🏰',
    'other': '✨'
  };

  const emoji = actionTypeEmoji[action.actionType?.toLowerCase()] || '✨';
  const actionTypeText = action.actionType ? ` (${action.actionType})` : '';

  let message = `&{template:default} {{name=${colorBanner}${characterData.name} uses ${action.name}${emoji}}} {{Action Type=${action.actionType || 'Other'}}}`;

  // Add description (resolve variables first)
  if (action.description) {
    const resolvedDescription = resolveVariablesInFormula(action.description);
    message += ` {{Description=${resolvedDescription}}}`;
  }

  // Add uses if available
  if (action.uses) {
    const usesUsed = action.usesUsed || 0;
    const usesTotal = action.uses.total || action.uses.value || action.uses;
    // Prefer usesLeft from DiceCloud if available, otherwise calculate from usesUsed
    const usesRemaining = action.usesLeft !== undefined ? action.usesLeft : (usesTotal - usesUsed);
    const usesText = `${usesRemaining} / ${usesTotal}`;
    message += ` {{Uses=${usesText}}}`;
  }

  // Send to Roll20 chat
  const messageData = {
    action: 'announceSpell',
    message: message,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      showNotification(`✨ ${action.name} used!`);
      debug.log('✅ Action announcement sent via window.opener');
      return;
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
    }
  }

  // Fallback: Use background script to relay to Roll20 (Firefox)
  debug.log('📡 Using background script to relay action announcement to Roll20...');
  browserAPI.runtime.sendMessage({
    action: 'relayRollToRoll20',
    roll: messageData
  }, (response) => {
    if (browserAPI.runtime.lastError) {
      debug.error('❌ Error relaying action announcement:', browserAPI.runtime.lastError);
      showNotification('❌ Failed to announce action');
    } else if (response && response.success) {
      debug.log('✅ Action announcement relayed to Roll20');
      showNotification(`✨ ${action.name} used!`);
    }
  });
}

function createColorPalette(selectedColor) {
  const colors = [
    { name: 'Blue', value: '#3498db', emoji: '🔵' },
    { name: 'Red', value: '#e74c3c', emoji: '🔴' },
    { name: 'Green', value: '#27ae60', emoji: '🟢' },
    { name: 'Purple', value: '#9b59b6', emoji: '🟣' },
    { name: 'Orange', value: '#e67e22', emoji: '🟠' },
    { name: 'Teal', value: '#1abc9c', emoji: '💠' },
    { name: 'Pink', value: '#e91e63', emoji: '💖' },
    { name: 'Yellow', value: '#f1c40f', emoji: '🟡' },
    { name: 'Grey', value: '#95a5a6', emoji: '⚪' },
    { name: 'Black', value: '#34495e', emoji: '⚫' },
    { name: 'Brown', value: '#8b4513', emoji: '🟤' }
  ];

  return colors.map(color => {
    const isSelected = color.value === selectedColor;
    return `
      <div class="color-swatch"
           data-color="${color.value}"
           style="font-size: 1.5em; cursor: pointer; transition: all 0.2s; opacity: ${isSelected ? '1' : '0.85'}; transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; filter: ${isSelected ? 'drop-shadow(0 0 4px white)' : 'none'}; text-align: center;"
           title="${color.name}">${color.emoji}</div>
    `;
  }).join('');
}

// Global flag to track if document-level click listener has been added
let colorPaletteDocumentListenerAdded = false;

function initColorPalette() {
  // Set default color if not set
  if (!characterData.notificationColor) {
    characterData.notificationColor = '#3498db';
  }

  const toggleBtnOld = document.getElementById('color-toggle');
  const palette = document.getElementById('color-palette');

  if (!toggleBtnOld || !palette) return;

  // Clone and replace toggle button to remove old listeners
  const toggleBtn = toggleBtnOld.cloneNode(true);
  toggleBtnOld.parentNode.replaceChild(toggleBtn, toggleBtnOld);

  // Toggle palette visibility
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = palette.style.display === 'grid';
    palette.style.display = isVisible ? 'none' : 'grid';
  });

  // Add document-level click listener only once
  if (!colorPaletteDocumentListenerAdded) {
    // Close palette when clicking outside
    document.addEventListener('click', (e) => {
      const currentToggleBtn = document.getElementById('color-toggle');
      const currentPalette = document.getElementById('color-palette');
      if (currentPalette && currentToggleBtn) {
        if (!currentPalette.contains(e.target) && e.target !== currentToggleBtn && !currentToggleBtn.contains(e.target)) {
          currentPalette.style.display = 'none';
        }
      }
    });
    colorPaletteDocumentListenerAdded = true;
    debug.log('🎨 Added document-level color palette click listener');
  }

  // Add click handlers to color swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const newColor = e.target.dataset.color;
      const oldColor = characterData.notificationColor;
      characterData.notificationColor = newColor;

      // Update all swatches appearance
      document.querySelectorAll('.color-swatch').forEach(s => {
        const isSelected = s.dataset.color === newColor;
        s.style.opacity = isSelected ? '1' : '0.6';
        s.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
        s.style.filter = isSelected ? 'drop-shadow(0 0 4px white)' : 'none';
      });

      // Update the toggle button emoji (using current element in DOM)
      const newEmoji = getColorEmoji(newColor);
      const colorEmojiEl = document.getElementById('color-emoji');
      if (colorEmojiEl) {
        colorEmojiEl.textContent = newEmoji;
      }

      // Close the palette
      palette.style.display = 'none';

      // Save to storage
      saveCharacterData();
      showNotification(`🎨 Notification color changed to ${e.target.title}!`);
    });
  });
}

// Debounce timer for sync messages
let syncDebounceTimer = null;

function saveCharacterData() {
  // CRITICAL: Save to browser storage to persist through refresh/close
  browserAPI.runtime.sendMessage({
    action: 'storeCharacterData',
    data: characterData,
    slotId: currentSlotId  // CRITICAL: Pass slotId for proper persistence
  }).then(() => {
    debug.log(`💾 Saved character data to browser storage (slotId: ${currentSlotId})`);
  }).catch(err => {
    debug.error('❌ Failed to save character data:', err);
  });

  // Debounce sync messages to prevent flickering
  // Clear any pending sync
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  // Schedule sync after a short delay
  syncDebounceTimer = setTimeout(() => {
    sendSyncMessage();
    syncDebounceTimer = null;
  }, 300); // 300ms debounce delay
}

function sendSyncMessage() {
  // Send sync message to DiceCloud if experimental sync is available
  // Always send sync messages in experimental build - they'll be handled by Roll20 content script
  debug.log('🔄 Sending character data update to DiceCloud sync...');

  // Extract Channel Divinity from characterData.resources array (this has the current values after use)
  let channelDivinityForSync = null;
  const channelDivinityResource = characterData.resources?.find(r =>
    r.name === 'Channel Divinity' ||
    r.variableName === 'channelDivinityCleric' ||
    r.variableName === 'channelDivinityPaladin' ||
    r.variableName === 'channelDivinity' ||
    r.varName === 'channelDivinity'
  );
  if (channelDivinityResource) {
    channelDivinityForSync = {
      current: channelDivinityResource.current || 0,
      max: channelDivinityResource.max || 0
    };
  }

  // Use the existing resources array which contains current values
  const resourcesForSync = characterData.resources || [];

  // Debug logging to see what we're sending
  console.log('[SYNC DEBUG] ========== SYNC MESSAGE DATA ==========');
  console.log('[SYNC DEBUG] Character Name:', characterData.name);
  console.log('[SYNC DEBUG] HP:', characterData.hitPoints?.current, '/', characterData.hitPoints?.max);
  console.log('[SYNC DEBUG] Temp HP:', characterData.temporaryHP);
  console.log('[SYNC DEBUG] Spell Slots:', characterData.spellSlots);
  console.log('[SYNC DEBUG] Channel Divinity (extracted):', channelDivinityForSync);
  console.log('[SYNC DEBUG] Channel Divinity (raw resource):', channelDivinityResource);
  console.log('[SYNC DEBUG] Resources (count):', resourcesForSync?.length);
  console.log('[SYNC DEBUG] Resources (full):', resourcesForSync);
  console.log('[SYNC DEBUG] Actions (count):', characterData.actions?.length);
  console.log('[SYNC DEBUG] Actions (full):', characterData.actions);
  console.log('[SYNC DEBUG] Death Saves:', characterData.deathSaves);
  console.log('[SYNC DEBUG] Inspiration:', characterData.inspiration);
  console.log('[SYNC DEBUG] =========================================');

  const syncMessage = {
    type: 'characterDataUpdate',
    characterData: {
      name: characterData.name,
      hp: characterData.hitPoints.current,
      tempHp: characterData.temporaryHP || 0,
      maxHp: characterData.hitPoints.max,
      spellSlots: characterData.spellSlots || {},
      channelDivinity: channelDivinityForSync,
      resources: resourcesForSync,
      actions: characterData.actions || [],
      deathSaves: characterData.deathSaves,
      inspiration: characterData.inspiration,
      lastRoll: characterData.lastRoll
    }
  };
  
  // Try to send to Roll20 content script
  window.postMessage(syncMessage, '*');
  
  // Also try to send via opener if available
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(syncMessage, '*');
  }

  // Also send to window opener if available (for backwards compatibility)
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'updateCharacterData',
      data: characterData
    }, '*');
    debug.log('💾 Sent character data update to parent window');

    // Also send player data to GM Panel for overview tracking
    window.opener.postMessage({
      action: 'updatePlayerData',
      characterName: characterData.name,
      data: {
        hp: characterData.hp,
        maxHp: characterData.maxHp,
        ac: characterData.ac,
        passivePerception: characterData.passivePerception || (10 + (characterData.perception || 0)),
        initiative: characterData.initiative,
        conditions: characterData.conditions || [],
        concentration: characterData.concentration || null,
        deathSaves: characterData.deathSaves || null
      }
    }, '*');
    debug.log('👥 Sent player data update to GM Panel');
  }
}

function resolveVariablesInFormula(formula) {
  if (!formula || typeof formula !== 'string') {
    return formula;
  }

  debug.log(`🔧 resolveVariablesInFormula called with: "${formula}"`);

  // Check if characterData has otherVariables
  if (!characterData.otherVariables || typeof characterData.otherVariables !== 'object') {
    debug.log('⚠️ No otherVariables available for formula resolution');
    return formula;
  }

  let resolvedFormula = formula;
  let variablesResolved = [];

  // Pattern 0: Check if the entire formula is just a bare variable name (e.g., "breathWeaponDamage")
  // This must be checked BEFORE other patterns to handle cases like action.damage = "breathWeaponDamage"
  const bareVariablePattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
  if (bareVariablePattern.test(formula.trim())) {
    const varName = formula.trim();
    if (characterData.otherVariables.hasOwnProperty(varName)) {
      const variableValue = characterData.otherVariables[varName];

      // Extract the value
      let value = null;
      if (typeof variableValue === 'number') {
        value = variableValue;
      } else if (typeof variableValue === 'string') {
        value = variableValue;
      } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
        value = variableValue.value;
      }

      if (value !== null && value !== undefined) {
        debug.log(`✅ Resolved bare variable: ${varName} = ${value}`);
        return String(value);
      }
    }
    debug.log(`⚠️ Bare variable not found in otherVariables: ${varName}`);
  }

  // Helper function to get variable value (handles dot notation like "bard.level")
  const getVariableValue = (varPath) => {
    // Strip # prefix if present (DiceCloud reference notation)
    const cleanPath = varPath.startsWith('#') ? varPath.substring(1) : varPath;

    // Handle special DiceCloud spell references (e.g., "spellList.abilityMod")
    // These reference the spellcasting ability modifier for the character's class
    if (cleanPath === 'spellList.abilityMod' || cleanPath === 'spellList.ability') {
      // Determine spellcasting ability based on character class
      const charClass = (characterData.class || '').toLowerCase();
      let spellcastingAbility = null;

      // Map classes to their spellcasting abilities
      if (charClass.includes('cleric') || charClass.includes('druid') || charClass.includes('ranger')) {
        spellcastingAbility = 'wisdom';
      } else if (charClass.includes('wizard') || charClass.includes('artificer')) {
        spellcastingAbility = 'intelligence';
      } else if (charClass.includes('bard') || charClass.includes('paladin') || charClass.includes('sorcerer') || charClass.includes('warlock')) {
        spellcastingAbility = 'charisma';
      }

      // Return the modifier for the spellcasting ability
      if (spellcastingAbility && characterData.attributeMods && characterData.attributeMods[spellcastingAbility] !== undefined) {
        const modifier = characterData.attributeMods[spellcastingAbility];
        debug.log(`✅ Resolved ${cleanPath} to ${spellcastingAbility} modifier: ${modifier}`);
        return modifier;
      }
    }

    // Handle spellList.dc (spell save DC)
    if (cleanPath === 'spellList.dc') {
      // Spell Save DC = 8 + proficiency bonus + spellcasting ability modifier
      const profBonus = characterData.proficiencyBonus || 0;
      const spellMod = getVariableValue('#spellList.abilityMod');
      if (spellMod !== null) {
        const spellDC = 8 + profBonus + spellMod;
        debug.log(`✅ Calculated spell DC: 8 + ${profBonus} + ${spellMod} = ${spellDC}`);
        return spellDC;
      }
    }

    // Handle spellList.attackBonus (spell attack bonus)
    if (cleanPath === 'spellList.attackBonus') {
      // Spell Attack Bonus = proficiency bonus + spellcasting ability modifier
      const profBonus = characterData.proficiencyBonus || 0;
      const spellMod = getVariableValue('#spellList.abilityMod');
      if (spellMod !== null) {
        const attackBonus = profBonus + spellMod;
        debug.log(`✅ Calculated spell attack bonus: ${profBonus} + ${spellMod} = ${attackBonus}`);
        return attackBonus;
      }
    }

    // Try direct lookup first
    if (characterData.otherVariables.hasOwnProperty(cleanPath)) {
      const val = characterData.otherVariables[cleanPath];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val.value !== undefined) return val.value;
      if (typeof val === 'string') return val;
    }

    // Try converting dot notation (e.g., "bard.level" -> "bardLevel")
    const camelCase = cleanPath.replace(/\.([a-z])/g, (_, letter) => letter.toUpperCase());
    if (characterData.otherVariables.hasOwnProperty(camelCase)) {
      const val = characterData.otherVariables[camelCase];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val.value !== undefined) return val.value;
    }

    // Try other common patterns
    const alternatives = [
      cleanPath.replace(/\./g, ''), // Remove dots
      cleanPath.split('.').pop(), // Just the last part
      cleanPath.replace(/\./g, '_') // Underscores instead
    ];

    for (const alt of alternatives) {
      if (characterData.otherVariables.hasOwnProperty(alt)) {
        const val = characterData.otherVariables[alt];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object' && val.value !== undefined) return val.value;
      }
    }

    return null;
  };

  // Pattern 1a: Find DiceCloud references in parentheses like (#spellList.abilityMod)
  const diceCloudRefPattern = /\((#[a-zA-Z_][a-zA-Z0-9_.]*)\)/g;
  let match;

  while ((match = diceCloudRefPattern.exec(formula)) !== null) {
    const varRef = match[1]; // e.g., "#spellList.abilityMod"
    const fullMatch = match[0]; // e.g., "(#spellList.abilityMod)"

    // Use getVariableValue which handles # prefix and dot notation
    const value = getVariableValue(varRef);

    if (value !== null && typeof value === 'number') {
      resolvedFormula = resolvedFormula.replace(fullMatch, value);
      variablesResolved.push(`${varRef}=${value}`);
      debug.log(`✅ Resolved DiceCloud reference: ${varRef} = ${value}`);
    } else {
      debug.log(`⚠️ Could not resolve DiceCloud reference: ${varRef}, value: ${value}`);
    }
  }

  // Pattern 1b: Find simple variables in parentheses like (variableName)
  const parenthesesPattern = /\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g;

  while ((match = parenthesesPattern.exec(formula)) !== null) {
    const variableName = match[1];
    const fullMatch = match[0]; // e.g., "(sneakAttackDieAmount)"

    // Look up the variable value
    if (characterData.otherVariables.hasOwnProperty(variableName)) {
      const variableValue = characterData.otherVariables[variableName];

      // Extract numeric value
      let numericValue = null;
      if (typeof variableValue === 'number') {
        numericValue = variableValue;
      } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
        numericValue = variableValue.value;
      }

      if (numericValue !== null) {
        resolvedFormula = resolvedFormula.replace(fullMatch, numericValue);
        variablesResolved.push(`${variableName}=${numericValue}`);
        debug.log(`✅ Resolved variable: ${variableName} = ${numericValue}`);
      } else {
        debug.log(`⚠️ Could not extract numeric value from variable: ${variableName}`, variableValue);
      }
    } else {
      debug.log(`⚠️ Variable not found in otherVariables: ${variableName}`);
    }
  }

  // Pattern 2: Handle math functions like ceil{expression}, floor{expression}, etc.
  const mathFuncPattern = /(ceil|floor|round|abs)\{([^}]+)\}/gi;

  while ((match = mathFuncPattern.exec(resolvedFormula)) !== null) {
    const funcName = match[1].toLowerCase();
    const expression = match[2];
    const fullMatch = match[0]; // e.g., "ceil{proficiencyBonus/2}"

    // Replace variables in the expression
    let evalExpression = expression;
    for (const varName in characterData.otherVariables) {
      if (evalExpression.includes(varName)) {
        const variableValue = characterData.otherVariables[varName];
        let value = null;

        if (typeof variableValue === 'number') {
          value = variableValue;
        } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
          value = variableValue.value;
        }

        if (value !== null && typeof value === 'number') {
          evalExpression = evalExpression.replace(new RegExp(varName, 'g'), value);
        }
      }
    }

    // Evaluate the expression with the appropriate math function
    try {
      if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
        const evalResult = eval(evalExpression);
        let result;

        switch (funcName) {
          case 'ceil':
            result = Math.ceil(evalResult);
            break;
          case 'floor':
            result = Math.floor(evalResult);
            break;
          case 'round':
            result = Math.round(evalResult);
            break;
          case 'abs':
            result = Math.abs(evalResult);
            break;
          default:
            result = evalResult;
        }

        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${funcName}{${expression}}=${result}`);
        debug.log(`✅ Resolved math function: ${funcName}{${expression}} = ${result}`);
      }
    } catch (e) {
      debug.log(`⚠️ Failed to evaluate ${funcName}{${expression}}`, e);
    }
  }

  // Pattern 2.5: Handle max/min functions outside of curly braces (e.g., "1d6+max(strengthModifier, dexterityModifier)")
  // Helper function to find matching closing parenthesis
  function findMatchingParen(str, startIndex) {
    let depth = 1;
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  // Helper function to split arguments respecting nested parentheses
  function splitArgs(argsString) {
    const args = [];
    let currentArg = '';
    let depth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      if (char === '(') {
        depth++;
        currentArg += char;
      } else if (char === ')') {
        depth--;
        currentArg += char;
      } else if (char === ',' && depth === 0) {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      args.push(currentArg.trim());
    }

    return args;
  }

  debug.log(`🔍 Looking for max/min in formula: "${resolvedFormula}"`);

  const maxMinPattern = /(max|min)\(/gi;

  while ((match = maxMinPattern.exec(resolvedFormula)) !== null) {
    const func = match[1].toLowerCase();
    const funcStart = match.index;
    const argsStart = funcStart + match[0].length;

    // Find the matching closing parenthesis
    const closingParen = findMatchingParen(resolvedFormula, argsStart);
    if (closingParen === -1) {
      debug.log(`⚠️ No matching closing parenthesis for ${func} at position ${funcStart}`);
      continue;
    }

    const argsString = resolvedFormula.substring(argsStart, closingParen);
    const fullMatch = resolvedFormula.substring(funcStart, closingParen + 1);
    debug.log(`🔍 Found max/min match: ${func}(${argsString})`)

    try {
      const args = splitArgs(argsString).map(arg => {
        const trimmed = arg;
        debug.log(`🔍 Resolving arg: "${trimmed}"`);

        // Try to parse as number first
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          debug.log(`  ✅ Parsed as number: ${num}`);
          return num;
        }

        // Try to resolve as simple variable
        const varVal = getVariableValue(trimmed);
        debug.log(`  🔍 Variable lookup result: ${varVal}`);
        if (varVal !== null && typeof varVal === 'number') {
          debug.log(`  ✅ Resolved as variable: ${varVal}`);
          return varVal;
        }

        // Try to evaluate as expression (e.g., "strength.modifier")
        let evalExpression = trimmed;
        const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
        let varMatch;
        const replacements = [];

        while ((varMatch = varPattern.exec(trimmed)) !== null) {
          const varName = varMatch[0];
          const value = getVariableValue(varName);
          if (value !== null && typeof value === 'number') {
            replacements.push({ name: varName, value: value });
          }
        }

        // Sort by length (longest first) to avoid partial replacements
        replacements.sort((a, b) => b.name.length - a.name.length);

        for (const {name, value} of replacements) {
          evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
        }

        // Handle math functions (ceil, floor, round, abs) in the expression
        evalExpression = evalExpression.replace(/ceil\(/g, 'Math.ceil(');
        evalExpression = evalExpression.replace(/floor\(/g, 'Math.floor(');
        evalExpression = evalExpression.replace(/round\(/g, 'Math.round(');
        evalExpression = evalExpression.replace(/abs\(/g, 'Math.abs(');

        // Try to evaluate
        try {
          if (/^[\d\s+\-*/().Math]+$/.test(evalExpression)) {
            const result = eval(evalExpression);
            debug.log(`  ✅ Evaluated expression "${trimmed}" = ${result}`);
            return result;
          }
        } catch (e) {
          debug.log(`  ❌ Failed to evaluate: "${trimmed}"`, e);
        }

        debug.log(`  ❌ Could not resolve: "${trimmed}"`);
        return null;
      }).filter(v => v !== null);

      if (args.length > 0) {
        const result = func === 'max' ? Math.max(...args) : Math.min(...args);
        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${func}(...)=${result}`);
        debug.log(`✅ Resolved ${func} function: ${fullMatch} = ${result}`);
        // Reset regex lastIndex since we modified the string
        maxMinPattern.lastIndex = 0;
      }
    } catch (e) {
      debug.log(`⚠️ Failed to resolve ${func} function: ${fullMatch}`, e);
    }
  }

  // Pattern 2.5: Handle ternary conditionals in parentheses for dice formulas like (condition?value1:value2)d6
  const parenTernaryPattern = /\(([^)]+\?[^)]+:[^)]+)\)/g;

  while ((match = parenTernaryPattern.exec(resolvedFormula)) !== null) {
    const expression = match[1];
    const fullMatch = match[0];

    // Check if this is a ternary conditional
    if (expression.includes('?') && expression.includes(':')) {
      const ternaryParts = expression.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/);
      if (ternaryParts) {
        const condition = ternaryParts[1].trim();
        const trueValue = ternaryParts[2].trim();
        const falseValue = ternaryParts[3].trim();

        // Evaluate the condition
        let conditionResult = false;
        const varValue = getVariableValue(condition);
        if (varValue !== null) {
          conditionResult = Boolean(varValue);
          debug.log(`✅ Evaluated parentheses ternary condition: ${condition} = ${conditionResult}`);
        }

        // Choose the appropriate value
        const chosenValue = conditionResult ? trueValue : falseValue;

        // Replace the entire match with the chosen value
        resolvedFormula = resolvedFormula.replace(fullMatch, chosenValue);
        variablesResolved.push(`(${condition}?${trueValue}:${falseValue}) = ${chosenValue}`);
        debug.log(`✅ Resolved parentheses ternary: (${expression}) => ${chosenValue}`);

        // Reset regex lastIndex since we modified the string
        parenTernaryPattern.lastIndex = 0;
      }
    }
  }

  // Pattern 3: Find variables/expressions in curly braces like {variableName} or {3*cleric.level}
  const bracesPattern = /\{([^}]+)\}/g;

  while ((match = bracesPattern.exec(resolvedFormula)) !== null) {
    const expression = match[1];
    const fullMatch = match[0];

    // Strip markdown formatting
    let cleanExpr = expression.replace(/\*\*/g, '');

    // Handle ternary operators: {condition ? trueValue : falseValue}
    // First try complex ternary with concatenation and functions: level >= 5 ? "+ " + floor((level+1)/6) + "d8" : ""
    const complexTernaryPattern = /^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/;
    const complexTernaryMatch = cleanExpr.match(complexTernaryPattern);
    if (complexTernaryMatch && cleanExpr.includes('?') && cleanExpr.includes(':')) {
      const condition = complexTernaryMatch[1].trim();
      const trueBranch = complexTernaryMatch[2].trim();
      const falseBranch = complexTernaryMatch[3].trim();

      // Evaluate the condition
      let conditionResult = false;
      try {
        // Check if condition is just a simple variable name
        const simpleVarPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
        if (simpleVarPattern.test(condition.trim())) {
          const varValue = getVariableValue(condition.trim());
          if (varValue !== null) {
            // Convert to boolean: numbers, strings, booleans
            conditionResult = Boolean(varValue);
          } else {
            // Variable doesn't exist, treat as false
            conditionResult = false;
          }
          debug.log(`✅ Evaluated simple variable condition: ${condition} = ${conditionResult}`);
        } else {
          // Complex condition with operators
          // Replace variables in condition
          let evalCondition = condition;
          const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
          let varMatch;
          const replacements = [];

          while ((varMatch = varPattern.exec(condition)) !== null) {
            const varName = varMatch[0];
            // Skip reserved words
            if (['true', 'false', 'null', 'undefined'].includes(varName.toLowerCase())) {
              continue;
            }
            const value = getVariableValue(varName);
            if (value !== null) {
              // Handle numbers, strings, and booleans
              if (typeof value === 'number') {
                replacements.push({ name: varName, value: value });
              } else if (typeof value === 'boolean') {
                replacements.push({ name: varName, value: value });
              } else if (typeof value === 'string') {
                // Convert string to boolean for condition evaluation
                const boolValue = value !== '' && value !== '0' && value.toLowerCase() !== 'false';
                replacements.push({ name: varName, value: boolValue });
              }
            } else {
              // Variable doesn't exist, replace with false
              replacements.push({ name: varName, value: false });
            }
          }

          // Sort by length (longest first) to avoid partial replacements
          replacements.sort((a, b) => b.name.length - a.name.length);

          for (const {name, value} of replacements) {
            evalCondition = evalCondition.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
          }

          // Evaluate condition
          if (/^[\w\s+\-*/><=!&|()\.]+$/.test(evalCondition)) {
            conditionResult = eval(evalCondition);
          }
        }
      } catch (e) {
        debug.log(`⚠️ Failed to evaluate ternary condition: ${condition}`, e);
      }

      // Evaluate the chosen branch
      const chosenBranch = conditionResult ? trueBranch : falseBranch;
      let result = '';

      try {
        // Handle string concatenation with + operator
        // Pattern: "string" + expression + "string"
        if (chosenBranch.includes('+')) {
          const parts = [];
          let current = '';
          let inString = false;
          let i = 0;

          while (i < chosenBranch.length) {
            const char = chosenBranch[i];

            if (char === '"') {
              if (inString) {
                // End of string
                parts.push({ type: 'string', value: current });
                current = '';
                inString = false;
              } else {
                // Start of string
                inString = true;
              }
              i++;
            } else if (char === '+' && !inString) {
              // Operator outside string
              if (current.trim()) {
                parts.push({ type: 'expr', value: current.trim() });
                current = '';
              }
              i++;
            } else {
              current += char;
              i++;
            }
          }

          // Add remaining part
          if (current.trim()) {
            if (inString) {
              parts.push({ type: 'string', value: current });
            } else {
              parts.push({ type: 'expr', value: current.trim() });
            }
          }

          // Evaluate each part and concatenate
          for (const part of parts) {
            if (part.type === 'string') {
              result += part.value;
            } else {
              // Evaluate expression (may contain floor(), variables, etc.)
              let exprResult = part.value;

              // Handle floor() function
              const floorMatch = exprResult.match(/floor\(([^)]+)\)/);
              if (floorMatch) {
                const floorExpr = floorMatch[1];
                // Resolve variables in floor expression
                let evalExpr = floorExpr;
                const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
                let varMatch;
                const replacements = [];

                while ((varMatch = varPattern.exec(floorExpr)) !== null) {
                  const varName = varMatch[0];
                  const value = getVariableValue(varName);
                  if (value !== null && typeof value === 'number') {
                    replacements.push({ name: varName, value: value });
                  }
                }

                replacements.sort((a, b) => b.name.length - a.name.length);
                for (const {name, value} of replacements) {
                  evalExpr = evalExpr.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
                }

                if (/^[\d\s+\-*/().]+$/.test(evalExpr)) {
                  const floorResult = Math.floor(eval(evalExpr));
                  exprResult = exprResult.replace(floorMatch[0], floorResult);
                }
              }

              // Try to resolve as variable or evaluate
              const varValue = getVariableValue(exprResult);
              if (varValue !== null) {
                result += varValue;
              } else if (/^[\d\s+\-*/().]+$/.test(exprResult)) {
                result += eval(exprResult);
              } else {
                result += exprResult;
              }
            }
          }
        } else if (chosenBranch.startsWith('"') && chosenBranch.endsWith('"')) {
          // Simple quoted string
          result = chosenBranch.slice(1, -1);
        } else {
          // Try to evaluate as expression
          result = chosenBranch;
        }

        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${condition} ? ... : ... = "${result}"`);
        debug.log(`✅ Resolved complex ternary: ${condition} (${conditionResult}) => "${result}"`);
        continue;
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ternary expression: ${cleanExpr}`, e);
      }
    }

    // Try as simple variable first
    let simpleValue = getVariableValue(cleanExpr);
    if (simpleValue !== null) {
      resolvedFormula = resolvedFormula.replace(fullMatch, simpleValue);
      variablesResolved.push(`${cleanExpr}=${simpleValue}`);
      debug.log(`✅ Resolved variable: ${cleanExpr} = ${simpleValue}`);
      continue;
    }

    // Handle array indexing: [array][index]
    const arrayPattern = /^\[([^\]]+)\]\[([^\]]+)\]$/;
    const arrayMatch = cleanExpr.match(arrayPattern);
    if (arrayMatch) {
      try {
        const arrayPart = arrayMatch[1];
        const indexPart = arrayMatch[2];

        // Parse array (handle both numbers and string values like "N/A")
        const arrayValues = arrayPart.split(',').map(v => {
          const trimmed = v.trim();
          // Remove quotes if present
          const unquoted = trimmed.replace(/^["']|["']$/g, '');
          // Try to parse as number, otherwise keep as string
          const num = parseFloat(unquoted);
          return isNaN(num) ? unquoted : num;
        });

        // Resolve index variable
        let indexValue = getVariableValue(indexPart);

        if (indexValue !== null && !isNaN(indexValue)) {
          // Try direct index first
          let result = arrayValues[indexValue];

          // If out of bounds and index > 0, try index-1 (for 1-based level arrays)
          if (result === undefined && indexValue > 0) {
            result = arrayValues[indexValue - 1];
            if (result !== undefined) {
              debug.log(`📊 Array index ${indexValue} out of bounds, using ${indexValue - 1} instead`);
              indexValue = indexValue - 1;
            }
          }

          if (result !== undefined) {
            resolvedFormula = resolvedFormula.replace(fullMatch, result);
            variablesResolved.push(`array[${indexValue}]=${result}`);
            debug.log(`✅ Resolved array indexing: ${cleanExpr} = ${result}`);
            continue;
          } else {
            debug.log(`⚠️ Array index ${indexValue} out of bounds (array length: ${arrayValues.length})`);
          }
        } else {
          debug.log(`⚠️ Could not resolve index variable: ${indexPart}`);
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve array indexing: ${cleanExpr}`, e);
      }
    }

    // Handle max/min functions (can be standalone or part of larger expression)
    const maxMinPattern = /^(max|min)\(([^)]+)\)$/i;
    const maxMinMatch = cleanExpr.match(maxMinPattern);
    if (maxMinMatch) {
      try {
        const func = maxMinMatch[1].toLowerCase();
        const args = maxMinMatch[2].split(',').map(arg => {
          const trimmed = arg.trim();
          // Try to parse as number first
          const num = parseFloat(trimmed);
          if (!isNaN(num)) return num;

          // Try to resolve as variable
          const varVal = getVariableValue(trimmed);
          if (varVal !== null) return varVal;

          return null;
        }).filter(v => v !== null);

        if (args.length > 0) {
          const result = func === 'max' ? Math.max(...args) : Math.min(...args);
          resolvedFormula = resolvedFormula.replace(fullMatch, result);
          variablesResolved.push(`${func}(...)=${result}`);
          debug.log(`✅ Resolved ${func} function: ${cleanExpr} = ${result}`);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ${cleanExpr}`, e);
      }
    }

    // Handle ceil/floor/round/abs functions with parentheses: ceil(expr), floor(expr), etc.
    const mathFuncParenPattern = /^(ceil|floor|round|abs)\(([^)]+)\)$/i;
    const mathFuncParenMatch = cleanExpr.match(mathFuncParenPattern);
    if (mathFuncParenMatch) {
      try {
        const funcName = mathFuncParenMatch[1].toLowerCase();
        const expression = mathFuncParenMatch[2];

        // Replace variables in the expression
        let evalExpression = expression;
        const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
        let varMatch;
        const replacements = [];

        while ((varMatch = varPattern.exec(expression)) !== null) {
          const varName = varMatch[0];
          const value = getVariableValue(varName);
          if (value !== null && typeof value === 'number') {
            replacements.push({ name: varName, value: value });
          }
        }

        // Sort by length (longest first) to avoid partial replacements
        replacements.sort((a, b) => b.name.length - a.name.length);

        for (const {name, value} of replacements) {
          evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
        }

        // Evaluate the expression
        if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
          const evalResult = eval(evalExpression);
          let result;

          switch (funcName) {
            case 'ceil':
              result = Math.ceil(evalResult);
              break;
            case 'floor':
              result = Math.floor(evalResult);
              break;
            case 'round':
              result = Math.round(evalResult);
              break;
            case 'abs':
              result = Math.abs(evalResult);
              break;
            default:
              result = evalResult;
          }

          resolvedFormula = resolvedFormula.replace(fullMatch, result);
          variablesResolved.push(`${funcName}(${expression})=${result}`);
          debug.log(`✅ Resolved math function: ${funcName}(${expression}) = ${result}`);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ${cleanExpr}`, e);
      }
    }

    // Try to evaluate as math expression
    let evalExpression = cleanExpr;

    // Replace all variable names with their values (sorted by length to avoid partial matches)
    const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
    let varMatch;
    const replacements = [];

    while ((varMatch = varPattern.exec(cleanExpr)) !== null) {
      const varName = varMatch[0];
      const value = getVariableValue(varName);
      if (value !== null && typeof value === 'number') {
        replacements.push({ name: varName, value: value });
      }
    }

    // Sort by length (longest first) to avoid partial replacements
    replacements.sort((a, b) => b.name.length - a.name.length);

    for (const {name, value} of replacements) {
      evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
    }

    // Try to evaluate the expression
    try {
      if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
        const result = eval(evalExpression);
        resolvedFormula = resolvedFormula.replace(fullMatch, Math.floor(result));
        variablesResolved.push(`${cleanExpr}=${Math.floor(result)}`);
        debug.log(`✅ Resolved expression: ${cleanExpr} = ${Math.floor(result)}`);
      } else {
        debug.log(`⚠️ Could not resolve expression: ${cleanExpr} (eval: ${evalExpression})`);
      }
    } catch (e) {
      debug.log(`⚠️ Failed to evaluate expression: ${cleanExpr}`, e);
    }
  }

  if (variablesResolved.length > 0) {
    debug.log(`🔧 Formula resolution: "${formula}" -> "${resolvedFormula}" (${variablesResolved.join(', ')})`);
  }

  // Strip remaining markdown formatting
  resolvedFormula = resolvedFormula.replace(/\*\*/g, ''); // Remove bold markers

  // Parse inline calculations in curly braces {expression}
  // DiceCloud uses {varName} or {varName + 2} syntax in text
  const inlineCalcPattern = /\{([^}]+)\}/g;
  resolvedFormula = resolvedFormula.replace(inlineCalcPattern, (fullMatch, expression) => {
    try {
      // First try to resolve variables in the expression
      let resolvedExpr = expression;

      // Replace variable names with their values
      const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
      resolvedExpr = resolvedExpr.replace(varPattern, (varName) => {
        const value = getVariableValue(varName);
        return value !== null ? value : varName;
      });

      // Try to evaluate as math expression
      // Only if it contains operators or is a number
      if (/[\d+\-*\/()]/.test(resolvedExpr)) {
        try {
          // Use Function constructor for safe evaluation (no external scope access)
          const result = Function('"use strict"; return (' + resolvedExpr + ')')();
          debug.log(`✅ Evaluated inline calculation: {${expression}} = ${result}`);
          return result;
        } catch (e) {
          debug.log(`⚠️ Failed to evaluate inline calculation: {${expression}}`, e);
        }
      }

      // If it's just a variable lookup that was resolved, return it
      if (resolvedExpr !== expression && !/[a-zA-Z_]/.test(resolvedExpr)) {
        return resolvedExpr;
      }
    } catch (e) {
      debug.log(`⚠️ Error processing inline calculation: {${expression}}`, e);
    }

    // Return original if we couldn't resolve
    return fullMatch;
  });

  return resolvedFormula;
}

/**
 * Safe math expression evaluator that doesn't use eval() or Function()
 * CSP-compliant parser for basic arithmetic and Math functions
 */
function safeMathEval(expr) {
  // Tokenize the expression
  const tokens = [];
  let i = 0;
  expr = expr.replace(/\s+/g, ''); // Remove whitespace

  while (i < expr.length) {
    // Check for Math functions
    if (expr.substr(i, 10) === 'Math.floor') {
      tokens.push({ type: 'function', value: 'floor' });
      i += 10;
    } else if (expr.substr(i, 9) === 'Math.ceil') {
      tokens.push({ type: 'function', value: 'ceil' });
      i += 9;
    } else if (expr.substr(i, 10) === 'Math.round') {
      tokens.push({ type: 'function', value: 'round' });
      i += 10;
    } else if (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.') {
      // Parse number
      let num = '';
      while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if ('+-*/()'.includes(expr[i])) {
      tokens.push({ type: 'operator', value: expr[i] });
      i++;
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }

  // Parse and evaluate using recursive descent
  let pos = 0;

  function parseExpression() {
    let left = parseTerm();

    while (pos < tokens.length && tokens[pos].type === 'operator' && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
      const op = tokens[pos].value;
      pos++;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  function parseTerm() {
    let left = parseFactor();

    while (pos < tokens.length && tokens[pos].type === 'operator' && (tokens[pos].value === '*' || tokens[pos].value === '/')) {
      const op = tokens[pos].value;
      pos++;
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }

    return left;
  }

  function parseFactor() {
    const token = tokens[pos];

    // Handle numbers
    if (token.type === 'number') {
      pos++;
      return token.value;
    }

    // Handle Math functions
    if (token.type === 'function') {
      const funcName = token.value;
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== '(') {
        throw new Error('Expected ( after function name');
      }
      pos++; // Skip (
      const arg = parseExpression();
      if (pos >= tokens.length || tokens[pos].value !== ')') {
        throw new Error('Expected ) after function argument');
      }
      pos++; // Skip )

      if (funcName === 'floor') return Math.floor(arg);
      if (funcName === 'ceil') return Math.ceil(arg);
      if (funcName === 'round') return Math.round(arg);
      throw new Error(`Unknown function: ${funcName}`);
    }

    // Handle parentheses
    if (token.type === 'operator' && token.value === '(') {
      pos++;
      const result = parseExpression();
      if (pos >= tokens.length || tokens[pos].value !== ')') {
        throw new Error('Mismatched parentheses');
      }
      pos++;
      return result;
    }

    // Handle unary minus
    if (token.type === 'operator' && token.value === '-') {
      pos++;
      return -parseFactor();
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  return parseExpression();
}

/**
 * Evaluate simple mathematical expressions in formulas
 * Converts things like "5*5" to "25" before sending to Roll20
 * CSP-compliant - does not use eval() or Function() constructor
 */
function evaluateMathInFormula(formula) {
  if (!formula || typeof formula !== 'string') {
    return formula;
  }

  let currentFormula = formula;
  let previousFormula = null;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep simplifying until formula doesn't change or max iterations reached
  while (currentFormula !== previousFormula && iterations < maxIterations) {
    previousFormula = currentFormula;
    iterations++;

    // Replace floor() with Math.floor() for parsing
    let processedFormula = currentFormula.replace(/floor\(/g, 'Math.floor(');
    processedFormula = processedFormula.replace(/ceil\(/g, 'Math.ceil(');
    processedFormula = processedFormula.replace(/round\(/g, 'Math.round(');

    // Check if the formula is just a simple math expression (no dice)
    // Pattern: numbers and operators only (e.g., "5*5", "10+5", "20/4")
    const simpleMathPattern = /^[\d\s+\-*/().]+$/;

    if (simpleMathPattern.test(processedFormula)) {
      try {
        const result = safeMathEval(processedFormula);
        if (typeof result === 'number' && !isNaN(result)) {
          debug.log(`✅ Evaluated simple math: ${currentFormula} = ${result} (iteration ${iterations})`);
          currentFormula = String(result);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Could not evaluate math expression: ${currentFormula}`, e);
      }
    }

    // Handle formulas with dice notation like "(floor((9 + 1) / 6) + 1)d8" or "(3 * 1)d6"
    // Extract math before the dice, evaluate it, then reconstruct
    const dicePattern = /^(.+?)(d\d+.*)$/i;
    const match = processedFormula.match(dicePattern);

    if (match) {
      const mathPart = match[1]; // e.g., "(Math.floor((9 + 1) / 6) + 1)" or "(3 * 1)"
      const dicePart = match[2]; // e.g., "d8" or "d6"

      // Check if the math part is evaluable (allows numbers, operators, parens, and Math functions)
      const mathOnlyPattern = /^[\d\s+\-*/().\w]+$/;
      if (mathOnlyPattern.test(mathPart)) {
        try {
          const result = safeMathEval(mathPart);
          if (typeof result === 'number' && !isNaN(result)) {
            debug.log(`✅ Evaluated dice formula math: ${mathPart} = ${result} (iteration ${iterations})`);
            currentFormula = String(result) + dicePart;
            continue;
          }
        } catch (e) {
          debug.log(`⚠️ Could not evaluate dice formula math: ${mathPart}`, e);
        }
      }
    }
  }

  if (iterations > 1) {
    debug.log(`🔄 Formula simplified in ${iterations} iterations: "${formula}" -> "${currentFormula}"`);
  }

  return currentFormula;
}

/**
 * Apply active effect modifiers to a roll
 * @param {string} rollName - Name of the roll (e.g., "Attack", "Perception", "Strength Save")
 * @param {string} formula - Original formula
 * @returns {object} - { modifiedFormula, effectNotes }
 */
function applyEffectModifiers(rollName, formula) {
  const rollLower = rollName.toLowerCase();
  let modifiedFormula = formula;
  const effectNotes = [];

  // Combine all active effects
  const allEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && e.autoApply);

  debug.log(`🎲 Checking effects for roll: ${rollName}`, allEffects);

  for (const effect of allEffects) {
    if (!effect.modifier) continue;

    let applied = false;

    // Check for attack roll modifiers
    if (rollLower.includes('attack') && effect.modifier.attack) {
      const mod = effect.modifier.attack;
      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for saving throw modifiers
    if (rollLower.includes('save') && (effect.modifier.save || effect.modifier.strSave || effect.modifier.dexSave)) {
      const mod = effect.modifier.save ||
                 (rollLower.includes('strength') && effect.modifier.strSave) ||
                 (rollLower.includes('dexterity') && effect.modifier.dexSave);

      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else if (mod === 'fail') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Auto-fail]`);
        applied = true;
      } else if (mod) {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for skill check modifiers
    if ((rollLower.includes('check') || rollLower.includes('perception') ||
         rollLower.includes('stealth') || rollLower.includes('investigation') ||
         rollLower.includes('insight') || rollLower.includes('persuasion') ||
         rollLower.includes('deception') || rollLower.includes('intimidation') ||
         rollLower.includes('athletics') || rollLower.includes('acrobatics')) &&
        effect.modifier.skill) {
      const mod = effect.modifier.skill;
      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for damage modifiers
    if (rollLower.includes('damage') && effect.modifier.damage) {
      modifiedFormula += ` + ${effect.modifier.damage}`;
      effectNotes.push(`[${effect.icon} ${effect.name}: +${effect.modifier.damage}]`);
      applied = true;
    }

    if (applied) {
      debug.log(`✅ Applied ${effect.name} (${effect.type}) to ${rollName}`);
    }
  }

  return { modifiedFormula, effectNotes };
}

/**
 * Check for optional effects that could apply to a roll and show popup if found
 * @param {string} rollName - Name of the roll
 * @param {string} formula - Original formula
 * @param {function} onApply - Callback function to apply the effect
 */
function checkOptionalEffects(rollName, formula, onApply) {
  const rollLower = rollName.toLowerCase();

  // Combine all active effects that are NOT autoApply
  const optionalEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && !e.autoApply && e.modifier);

  if (optionalEffects.length === 0) return;

  debug.log(`🎲 Checking optional effects for roll: ${rollName}`, optionalEffects);

  const applicableEffects = [];

  for (const effect of optionalEffects) {
    let applicable = false;

    // Check for skill check modifiers (for Guidance) - ALL skills
    const isSkillCheck = rollLower.includes('check') || 
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival');
    
    if (isSkillCheck && effect.modifier.skill) {
      applicable = true;
    }

    // Check for attack roll modifiers
    if (rollLower.includes('attack') && effect.modifier.attack) {
      applicable = true;
    }

    // Check for saving throw modifiers
    if (rollLower.includes('save') && effect.modifier.save) {
      applicable = true;
    }

    // Special handling for Bardic Inspiration - applies to checks, attacks, and saves
    if (effect.name.startsWith('Bardic Inspiration')) {
      if (rollLower.includes('check') || rollLower.includes('perception') ||
          rollLower.includes('stealth') || rollLower.includes('investigation') ||
          rollLower.includes('insight') || rollLower.includes('persuasion') ||
          rollLower.includes('deception') || rollLower.includes('intimidation') ||
          rollLower.includes('athletics') || rollLower.includes('acrobatics') ||
          rollLower.includes('attack') || rollLower.includes('save')) {
        applicable = true;
      }
    }

    if (applicable) {
      applicableEffects.push(effect);
    }
  }

  if (applicableEffects.length > 0) {
    showOptionalEffectPopup(applicableEffects, rollName, formula, onApply);
  }
}

/**
 * Show popup for optional effects
 */
function showOptionalEffectPopup(effects, rollName, formula, onApply) {
  debug.log('🎯 Showing optional effect popup for:', effects);

  if (!document.body) {
    debug.error('❌ document.body not available for optional effect popup');
    return;
  }

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create modal overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
    border: 2px solid var(--accent-primary);
  `;

  // Build effects list
  const effectsList = effects.map(effect => `
    <div style="margin: 12px 0; padding: 12px; background: ${effect.color}20; border: 2px solid ${effect.color}; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
         data-effect="${effect.name}" data-type="${effect.type}">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.2em;">${effect.icon}</span>
        <div style="flex: 1; text-align: left;">
          <div style="font-weight: bold; color: var(--text-primary);">${effect.name}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 2px;">${effect.description}</div>
        </div>
      </div>
    </div>
  `).join('');

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🎯</div>
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Optional Effect Available!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You can apply an optional effect to your <strong>${rollName}</strong> roll:
    </p>
    ${effectsList}
    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
      <button id="skip-effect" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        Skip
      </button>
    </div>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  // Add click handlers for effect options
  popupContent.querySelectorAll('[data-effect]').forEach(effectDiv => {
    effectDiv.addEventListener('click', () => {
      const effectName = effectDiv.dataset.effect;
      const effectType = effectDiv.dataset.type;
      const effect = effects.find(e => e.name === effectName);
      
      if (effect && onApply) {
        onApply(effect);
      }
      
      document.body.removeChild(popupOverlay);
    });
  });

  // Skip button
  document.getElementById('skip-effect').addEventListener('click', () => {
    document.body.removeChild(popupOverlay);
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      document.body.removeChild(popupOverlay);
    }
  });

  debug.log('🎯 Optional effect popup displayed');
}

function roll(name, formula, prerolledResult = null) {
  debug.log('🎲 Rolling:', name, formula, prerolledResult ? `(prerolled: ${prerolledResult})` : '');

  // Resolve any variables in the formula
  let resolvedFormula = resolveVariablesInFormula(formula);

  // Check if there are any optional effects that could apply to this roll
  const rollLower = name.toLowerCase();
  const optionalEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && !e.autoApply && e.modifier);

  const hasApplicableOptionalEffects = optionalEffects.some(effect => {
    // Check if this is a skill check (any skill name or the word "check")
    const isSkillCheck = rollLower.includes('check') || 
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival');
    
    return (isSkillCheck && effect.modifier.skill) ||
           (rollLower.includes('attack') && effect.modifier.attack);
  });

  // If there are applicable optional effects, show popup and wait for user choice
  if (hasApplicableOptionalEffects) {
    debug.log('🎯 Found applicable optional effects, showing popup...');
    checkOptionalEffects(name, resolvedFormula, (chosenEffect) => {
      // Apply the chosen effect and then roll
      const { modifiedFormula, effectNotes } = applyEffectModifiers(name, resolvedFormula);
      let finalFormula = modifiedFormula;

      // Check if this is a skill/ability check (same logic as popup detection)
      const isSkillOrAbilityCheck = rollLower.includes('check') ||
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival') ||
                        rollLower.includes('strength') || rollLower.includes('dexterity') ||
                        rollLower.includes('constitution') || rollLower.includes('intelligence') ||
                        rollLower.includes('wisdom') || rollLower.includes('charisma');

      debug.log(`🎯 Applying chosen effect: ${chosenEffect.name}`, {
        modifier: chosenEffect.modifier,
        rollLower: rollLower,
        hasSkillMod: !!chosenEffect.modifier?.skill,
        isSkillOrAbilityCheck: isSkillOrAbilityCheck,
        formulaBefore: finalFormula
      });

      // Add the chosen effect's modifier
      if (chosenEffect.modifier?.skill && isSkillOrAbilityCheck) {
        finalFormula += ` + ${chosenEffect.modifier.skill}`;
        effectNotes.push(`[${chosenEffect.icon} ${chosenEffect.name}: ${chosenEffect.modifier.skill}]`);
        debug.log(`✅ Added skill modifier: ${chosenEffect.modifier.skill}, formula now: ${finalFormula}`);
      } else if (chosenEffect.modifier?.attack && rollLower.includes('attack')) {
        finalFormula += ` + ${chosenEffect.modifier.attack}`;
        effectNotes.push(`[${chosenEffect.icon} ${chosenEffect.name}: ${chosenEffect.modifier.attack}]`);
        debug.log(`✅ Added attack modifier: ${chosenEffect.modifier.attack}, formula now: ${finalFormula}`);
      } else {
        debug.log(`⚠️ No modifier applied - skill: ${chosenEffect.modifier?.skill}, check: ${rollLower.includes('check')}, attack: ${chosenEffect.modifier?.attack}`);
      }
      
      // Remove the chosen effect from active effects since it's been used
      if (chosenEffect.type === 'buff') {
        activeBuffs = activeBuffs.filter(e => e !== chosenEffect.name);
        debug.log(`🗑️ Removed buff: ${chosenEffect.name}`);
      } else if (chosenEffect.type === 'debuff') {
        activeConditions = activeConditions.filter(e => e !== chosenEffect.name);
        debug.log(`🗑️ Removed debuff: ${chosenEffect.name}`);
      }
      updateEffectsDisplay();

      // Apply advantage/disadvantage state
      const formulaWithAdvantage = applyAdvantageToFormula(finalFormula, effectNotes);

      // Proceed with the roll
      executeRoll(name, formulaWithAdvantage, effectNotes, prerolledResult);
    });
    // Return early - don't execute the roll yet, wait for popup response
    return;
  }

  // No optional effects, proceed with normal roll
  const { modifiedFormula, effectNotes } = applyEffectModifiers(name, resolvedFormula);

  // Apply advantage/disadvantage state
  const formulaWithAdvantage = applyAdvantageToFormula(modifiedFormula, effectNotes);

  executeRoll(name, formulaWithAdvantage, effectNotes, prerolledResult);
}

/**
 * Apply advantage/disadvantage state to dice formula
 */
function applyAdvantageToFormula(formula, effectNotes) {
  if (advantageState === 'normal') {
    return formula;
  }

  // Check if this is a d20 roll
  if (!formula.includes('1d20') && !formula.includes('d20')) {
    return formula; // Not a d20 roll, don't modify
  }

  let modifiedFormula = formula;

  if (advantageState === 'advantage') {
    // Replace 1d20 with 2d20kh1 (keep highest)
    modifiedFormula = modifiedFormula.replace(/1d20/g, '2d20kh1');
    modifiedFormula = modifiedFormula.replace(/(?<!\d)d20/g, '2d20kh1');
    effectNotes.push('[⚡ Advantage]');
    debug.log('⚡ Applied advantage to roll');
  } else if (advantageState === 'disadvantage') {
    // Replace 1d20 with 2d20kl1 (keep lowest)
    modifiedFormula = modifiedFormula.replace(/1d20/g, '2d20kl1');
    modifiedFormula = modifiedFormula.replace(/(?<!\d)d20/g, '2d20kl1');
    effectNotes.push('[⚠️ Disadvantage]');
    debug.log('⚠️ Applied disadvantage to roll');
  }

  // Reset advantage state after use
  setTimeout(() => setAdvantageState('normal'), 100);

  return modifiedFormula;
}

/**
 * Execute the roll after optional effects have been handled
 */
function executeRoll(name, formula, effectNotes, prerolledResult = null) {
  const colorBanner = getColoredBanner();
  // Format: "🔵 CharacterName rolls Initiative"
  let rollName = `${colorBanner}${characterData.name} rolls ${name}`;

  // Add effect notes to roll name if any
  if (effectNotes.length > 0) {
    rollName += ` ${effectNotes.join(' ')}`;
  }

  // Save this as the character's last roll (for heroic inspiration reroll)
  if (characterData) {
    characterData.lastRoll = {
      name: name,
      formula: formula,
      effectNotes: effectNotes
    };
    saveCharacterData();
  }

  // If we have a prerolled result (e.g., from death saves), include it
  const messageData = {
    action: 'rollFromPopout',
    name: rollName,
    formula: formula,
    color: characterData.notificationColor,
    characterName: characterData.name
  };

  if (prerolledResult !== null) {
    messageData.prerolledResult = prerolledResult;
  }

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      showNotification(`🎲 Rolling ${name}...`);
      debug.log('✅ Roll sent via window.opener');
      return;
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
    }
  }

  // Fallback: Use background script to relay to Roll20 (Firefox)
  debug.log('📡 Using background script to relay roll to Roll20...');
  browserAPI.runtime.sendMessage({
    action: 'relayRollToRoll20',
    roll: messageData
  }, (response) => {
    if (browserAPI.runtime.lastError) {
      debug.error('❌ Error relaying roll:', browserAPI.runtime.lastError);
      showNotification('Failed to send roll. Please try from Roll20 page.', 'error');
    } else if (response && response.success) {
      debug.log('✅ Roll relayed to Roll20 via background script');
      showNotification(`🎲 Rolling ${name}...`);
    } else {
      debug.error('❌ Failed to relay roll:', response?.error);
      showNotification('Failed to send roll. Make sure Roll20 tab is open.', 'error');
    }
  });
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27AE60; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2000);
}

function takeShortRest() {
  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  const confirmed = confirm('Take a Short Rest?\n\nThis will:\n- Allow you to spend Hit Dice to restore HP\n- Restore Warlock spell slots\n- Restore some class features');

  if (!confirmed) return;

  debug.log('☕ Taking short rest...');

  // Clear temporary HP (RAW: temp HP doesn't persist through rest)
  if (characterData.temporaryHP > 0) {
    characterData.temporaryHP = 0;
    debug.log('✅ Cleared temporary HP');
  }

  // Note: Inspiration is NOT restored on short rest (DM grants it)
  debug.log(`ℹ️ Inspiration status unchanged (${characterData.inspiration ? 'active' : 'none'})`);

  // Restore Warlock Pact Magic slots (they recharge on short rest)
  // Check both spellSlots and otherVariables for Pact Magic
  if (characterData.spellSlots && characterData.spellSlots.pactMagicSlotsMax !== undefined) {
    characterData.spellSlots.pactMagicSlots = characterData.spellSlots.pactMagicSlotsMax;
    debug.log(`✅ Restored Pact Magic slots (spellSlots): ${characterData.spellSlots.pactMagicSlots}/${characterData.spellSlots.pactMagicSlotsMax}`);
  }
  if (characterData.otherVariables) {
    if (characterData.otherVariables.pactMagicSlotsMax !== undefined) {
      characterData.otherVariables.pactMagicSlots = characterData.otherVariables.pactMagicSlotsMax;
      debug.log('✅ Restored Pact Magic slots (otherVariables)');
    }

    // Restore Ki points for Monk (short rest feature)
    if (characterData.otherVariables.kiMax !== undefined) {
      characterData.otherVariables.ki = characterData.otherVariables.kiMax;
      debug.log('✅ Restored Ki points');
    } else if (characterData.otherVariables.kiPointsMax !== undefined) {
      characterData.otherVariables.kiPoints = characterData.otherVariables.kiPointsMax;
      debug.log('✅ Restored Ki points');
    }

    // Restore Action Surge, Second Wind (short rest features)
    if (characterData.otherVariables.actionSurgeMax !== undefined) {
      characterData.otherVariables.actionSurge = characterData.otherVariables.actionSurgeMax;
    }
    if (characterData.otherVariables.secondWindMax !== undefined) {
      characterData.otherVariables.secondWind = characterData.otherVariables.secondWindMax;
    }
  }

  // Handle Hit Dice spending for HP restoration
  spendHitDice();

  // Restore class resources that recharge on short rest
  // Most resources restore on short rest (Ki, Channel Divinity, Action Surge, etc.)
  // Notable exceptions: Sorcery Points and Rage restore on long rest only
  if (characterData.resources && characterData.resources.length > 0) {
    characterData.resources.forEach(resource => {
      const lowerName = resource.name.toLowerCase();

      // Long rest only resources
      if (lowerName.includes('sorcery') || lowerName.includes('rage')) {
        debug.log(`⏭️ Skipping ${resource.name} (long rest only)`);
        return;
      }

      // Restore all other resources
      resource.current = resource.max;

      // Also update otherVariables to keep data in sync
      if (characterData.otherVariables && resource.varName) {
        characterData.otherVariables[resource.varName] = resource.current;
      }

      debug.log(`✅ Restored ${resource.name} (${resource.current}/${resource.max})`);
    });
  }

  // Reset limited uses for short rest abilities
  if (characterData.actions) {
    characterData.actions.forEach(action => {
      // Reset usesUsed for actions that recharge on short rest
      // Most limited use abilities in D&D 5e recharge on short rest
      if (action.uses && action.usesUsed > 0) {
        action.usesUsed = 0;
        debug.log(`✅ Reset uses for ${action.name}`);
      }
    });
  }

  saveCharacterData();
  buildSheet(characterData);

  showNotification('☕ Short Rest complete! Resources recharged.');
  debug.log('✅ Short rest complete');

  // Announce to Roll20 with fancy formatting
  const colorBanner = getColoredBanner();
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} takes a short rest}} {{=☕ Short rest complete. Resources recharged!}}`,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fallback to background script relay
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }
}

function getHitDieType() {
  // Determine hit die based on class (D&D 5e)
  const className = (characterData.class || '').toLowerCase();

  const hitDiceMap = {
    'barbarian': 'd12',
    'fighter': 'd10',
    'paladin': 'd10',
    'ranger': 'd10',
    'bard': 'd8',
    'cleric': 'd8',
    'druid': 'd8',
    'monk': 'd8',
    'rogue': 'd8',
    'warlock': 'd8',
    'sorcerer': 'd6',
    'wizard': 'd6'
  };

  for (const [classKey, die] of Object.entries(hitDiceMap)) {
    if (className.includes(classKey)) {
      return die;
    }
  }

  // Default to d8 if class not found
  return 'd8';
}

function initializeHitDice() {
  // Initialize hit dice if not already set
  if (characterData.hitDice === undefined) {
    const level = characterData.level || 1;
    characterData.hitDice = {
      current: level,
      max: level,
      type: getHitDieType()
    };
  }
}

function spendHitDice() {
  initializeHitDice();

  const conMod = characterData.attributeMods?.constitution || 0;
  const hitDie = characterData.hitDice.type;
  const maxDice = parseInt(hitDie.substring(1)); // Extract number from "d8" -> 8

  if (characterData.hitDice.current <= 0) {
    alert('You have no Hit Dice remaining to spend!');
    return;
  }

  let totalHealed = 0;
  let diceSpent = 0;

  while (characterData.hitDice.current > 0 && characterData.hitPoints.current < characterData.hitPoints.max) {
    const spend = confirm(
      `Spend a Hit Die? (${characterData.hitDice.current}/${characterData.hitDice.max} remaining)\n\n` +
      `Hit Die: ${hitDie}\n` +
      `CON Modifier: ${conMod >= 0 ? '+' : ''}${conMod}\n` +
      `Current HP: ${characterData.hitPoints.current}/${characterData.hitPoints.max}\n` +
      `HP Healed so far: ${totalHealed}`
    );

    if (!spend) break;

    // Roll the hit die
    const roll = Math.floor(Math.random() * maxDice) + 1;
    const healing = Math.max(1, roll + conMod); // Minimum 1 HP restored

    characterData.hitDice.current--;
    diceSpent++;

    const oldHP = characterData.hitPoints.current;
    characterData.hitPoints.current = Math.min(
      characterData.hitPoints.current + healing,
      characterData.hitPoints.max
    );
    const actualHealing = characterData.hitPoints.current - oldHP;
    totalHealed += actualHealing;

    debug.log(`🎲 Rolled ${hitDie}: ${roll} + ${conMod} = ${healing} HP (restored ${actualHealing})`);

    // Announce the roll with fancy formatting
    if (window.opener && !window.opener.closed) {
      const colorBanner = getColoredBanner();
      window.opener.postMessage({
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} spends hit dice}} {{Roll=🎲 ${hitDie}: ${roll} + ${conMod} CON}} {{HP Restored=${healing}}} {{Current HP=${characterData.hitPoints.current}/${characterData.hitPoints.max}}}`,
        color: characterData.notificationColor
      }, '*');
    }
  }

  if (diceSpent > 0) {
    showNotification(`🎲 Spent ${diceSpent} Hit Dice and restored ${totalHealed} HP!`);
  } else {
    showNotification('No Hit Dice spent.');
  }
}

function takeLongRest() {
  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  const confirmed = confirm('Take a Long Rest?\n\nThis will:\n- Fully restore HP\n- Restore all spell slots\n- Restore all class features\n- Restore half your hit dice (minimum 1)');

  if (!confirmed) return;

  debug.log('🌙 Taking long rest...');

  // Initialize hit dice if needed
  initializeHitDice();

  // Restore all HP
  characterData.hitPoints.current = characterData.hitPoints.max;
  debug.log('✅ Restored HP to max');

  // Clear temporary HP (RAW: temp HP doesn't persist through rest)
  if (characterData.temporaryHP > 0) {
    characterData.temporaryHP = 0;
    debug.log('✅ Cleared temporary HP');
  }

  // Note: Inspiration is NOT automatically restored on long rest
  // It must be granted by the DM, so we don't touch it here
  debug.log(`ℹ️ Inspiration status unchanged (${characterData.inspiration ? 'active' : 'none'})`);

  // Restore hit dice (half of max, minimum 1)
  const hitDiceRestored = Math.max(1, Math.floor(characterData.hitDice.max / 2));
  const oldHitDice = characterData.hitDice.current;
  characterData.hitDice.current = Math.min(
    characterData.hitDice.current + hitDiceRestored,
    characterData.hitDice.max
  );
  debug.log(`✅ Restored ${characterData.hitDice.current - oldHitDice} hit dice (${characterData.hitDice.current}/${characterData.hitDice.max})`);

  // Restore all spell slots
  if (characterData.spellSlots) {
    // Restore regular spell slots (levels 1-9)
    for (let level = 1; level <= 9; level++) {
      const slotVar = `level${level}SpellSlots`;
      const slotMaxVar = `level${level}SpellSlotsMax`;

      if (characterData.spellSlots[slotMaxVar] !== undefined) {
        characterData.spellSlots[slotVar] = characterData.spellSlots[slotMaxVar];
        debug.log(`✅ Restored level ${level} spell slots`);
      }
    }

    // Also restore Pact Magic slots (Warlock)
    if (characterData.spellSlots.pactMagicSlotsMax !== undefined) {
      characterData.spellSlots.pactMagicSlots = characterData.spellSlots.pactMagicSlotsMax;
      debug.log(`✅ Restored Pact Magic slots: ${characterData.spellSlots.pactMagicSlots}/${characterData.spellSlots.pactMagicSlotsMax}`);
    }
  }

  // Restore all class resources (Ki, Sorcery Points, Rage, etc.)
  if (characterData.resources && characterData.resources.length > 0) {
    characterData.resources.forEach(resource => {
      resource.current = resource.max;

      // Also update otherVariables to keep data in sync
      if (characterData.otherVariables && resource.varName) {
        characterData.otherVariables[resource.varName] = resource.current;
      }

      debug.log(`✅ Restored ${resource.name} (${resource.current}/${resource.max})`);
    });
  }

  // Restore all class resources
  if (characterData.otherVariables) {
    Object.keys(characterData.otherVariables).forEach(key => {
      // If there's a Max variant, restore to max
      if (key.endsWith('Max')) {
        const baseKey = key.replace('Max', '');
        if (characterData.otherVariables[baseKey] !== undefined) {
          characterData.otherVariables[baseKey] = characterData.otherVariables[key];
          debug.log(`✅ Restored ${baseKey}`);
        }
      }
    });

    // Also restore specific resources that might not follow the Max pattern
    if (characterData.otherVariables.kiMax !== undefined) {
      characterData.otherVariables.ki = characterData.otherVariables.kiMax;
    } else if (characterData.otherVariables.kiPointsMax !== undefined) {
      characterData.otherVariables.kiPoints = characterData.otherVariables.kiPointsMax;
    }

    if (characterData.otherVariables.sorceryPointsMax !== undefined) {
      characterData.otherVariables.sorceryPoints = characterData.otherVariables.sorceryPointsMax;
    }

    if (characterData.otherVariables.pactMagicSlotsMax !== undefined) {
      characterData.otherVariables.pactMagicSlots = characterData.otherVariables.pactMagicSlotsMax;
    }

    // Restore Channel Divinity (try all possible variable names)
    if (characterData.otherVariables.channelDivinityClericMax !== undefined) {
      characterData.otherVariables.channelDivinityCleric = characterData.otherVariables.channelDivinityClericMax;
    } else if (characterData.otherVariables.channelDivinityPaladinMax !== undefined) {
      characterData.otherVariables.channelDivinityPaladin = characterData.otherVariables.channelDivinityPaladinMax;
    } else if (characterData.otherVariables.channelDivinityMax !== undefined) {
      characterData.otherVariables.channelDivinity = characterData.otherVariables.channelDivinityMax;
    }
  }

  // Reset limited uses for all abilities
  if (characterData.actions) {
    characterData.actions.forEach(action => {
      if (action.uses && action.usesUsed > 0) {
        action.usesUsed = 0;
        debug.log(`✅ Reset uses for ${action.name}`);
      }
    });
  }

  saveCharacterData();
  buildSheet(characterData);

  showNotification('🌙 Long Rest complete! All resources restored.');
  debug.log('✅ Long rest complete');

  // Announce to Roll20 with fancy formatting
  const colorBanner = getColoredBanner();
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} takes a long rest}} {{=🌙 Long rest complete!}} {{HP=${characterData.hitPoints.current}/${characterData.hitPoints.max} (Fully Restored)}} {{=All spell slots and resources restored!}}`,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fallback to background script relay
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }
}

// Initialize collapsible sections
function initCollapsibleSections() {
  const sections = document.querySelectorAll('.section h3');

  sections.forEach(header => {
    header.addEventListener('click', function() {
      const section = this.parentElement;
      const content = section.querySelector('.section-content');

      // Toggle collapsed class
      this.classList.toggle('collapsed');
      content.classList.toggle('collapsed');
    });
  });
}

// Helper function to collapse a section by its container ID
function collapseSectionByContainerId(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const section = container.closest('.section');
  if (!section) return;

  const header = section.querySelector('h3');
  const content = section.querySelector('.section-content');

  if (header && content) {
    header.classList.add('collapsed');
    content.classList.add('collapsed');
  }
}

// Helper function to expand a section by its container ID
function expandSectionByContainerId(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const section = container.closest('.section');
  if (!section) return;

  const header = section.querySelector('h3');
  const content = section.querySelector('.section-content');

  if (header && content) {
    header.classList.remove('collapsed');
    content.classList.remove('collapsed');
  }
}

// Call collapsible initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCollapsibleSections);
} else {
  initCollapsibleSections();
}

// Add close button event listener (CSP-compliant, no inline onclick)
function initCloseButton() {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

// Initialize close button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCloseButton);
} else {
  initCloseButton();
}

// Save character data when window is about to close/refresh
// This ensures local modifications persist through browser refresh
window.addEventListener('beforeunload', () => {
  if (characterData && currentSlotId) {
    debug.log('💾 Saving character data before window closes');
    // Use sendMessage synchronously during unload
    browserAPI.runtime.sendMessage({
      action: 'storeCharacterData',
      data: characterData,
      slotId: currentSlotId  // CRITICAL: Pass slotId for proper persistence
    });
    debug.log(`✅ Saved character data: ${characterData.name} (slotId: ${currentSlotId})`);
  }
});

// ============================================================================
// COMBAT MECHANICS
// ============================================================================

/**
 * Initialize combat mechanics (action economy, conditions, concentration)
 */
function initCombatMechanics() {
  debug.log('🎮 Initializing combat mechanics...');

  // Initialize action economy trackers
  initActionEconomy();

  // Initialize conditions manager
  initConditionsManager();

  // Initialize concentration tracker
  initConcentrationTracker();

  // Initialize GM mode toggle
  initGMMode();

  debug.log('✅ Combat mechanics initialized');
}

/**
 * Action Economy Tracker
 */
let isMyTurn = false; // Track if it's currently this character's turn

function initActionEconomy() {
  const actionIndicator = document.getElementById('action-indicator');
  const bonusActionIndicator = document.getElementById('bonus-action-indicator');
  const movementIndicator = document.getElementById('movement-indicator');
  const reactionIndicator = document.getElementById('reaction-indicator');
  const turnResetBtn = document.getElementById('turn-reset-btn');
  const roundResetBtn = document.getElementById('round-reset-btn');

  if (!actionIndicator) {
    debug.warn('⚠️ Action economy elements not found');
    return;
  }

  // Set initial state - only reaction available when not your turn
  updateActionEconomyAvailability();

  // Click to toggle used state (can only mark as used, not restore manually)
  [actionIndicator, bonusActionIndicator, movementIndicator, reactionIndicator].forEach(indicator => {
    if (indicator) {
      indicator.addEventListener('click', () => {
        // Check if action is disabled (not your turn)
        if (indicator.dataset.disabled === 'true') {
          showNotification('⚠️ Only reactions available when it\'s not your turn!');
          return;
        }

        const isUsed = indicator.dataset.used === 'true';
        const actionLabel = indicator.querySelector('.action-label').textContent;

        // Can only mark as used, not restore manually (use reset buttons for that)
        if (!isUsed) {
          indicator.dataset.used = 'true';
          debug.log(`🎯 ${actionLabel} used`);
          postActionToChat(actionLabel, 'used');
        } else {
          showNotification(`⚠️ Use Turn/Round Reset to restore ${actionLabel}`);
        }
      });
    }
  });

  // Turn reset (Action, Bonus Action, Movement)
  if (turnResetBtn) {
    turnResetBtn.addEventListener('click', () => {
      [actionIndicator, bonusActionIndicator, movementIndicator].forEach(indicator => {
        if (indicator) indicator.dataset.used = 'false';
      });
      debug.log('🔄 Turn reset: Action, Bonus Action, Movement restored');
      showNotification('🔄 Turn reset!');

      // Announce to Roll20 chat
      postToChatIfOpener(`🔄 ${characterData.name} resets turn actions!`);
    });
  }

  // Round reset (includes Reaction)
  if (roundResetBtn) {
    roundResetBtn.addEventListener('click', () => {
      [actionIndicator, bonusActionIndicator, movementIndicator, reactionIndicator].forEach(indicator => {
        if (indicator) indicator.dataset.used = 'false';
      });
      debug.log('🔄 Round reset: All actions restored');
      showNotification('🔄 Round reset!');

      // Announce to Roll20 chat
      postToChatIfOpener(`🔄 ${characterData.name} resets all actions!`);
    });
  }

  debug.log('✅ Action economy initialized');
}

/**
 * Update action economy availability based on turn state
 */
function updateActionEconomyAvailability() {
  const actionIndicator = document.getElementById('action-indicator');
  const bonusActionIndicator = document.getElementById('bonus-action-indicator');
  const movementIndicator = document.getElementById('movement-indicator');
  const reactionIndicator = document.getElementById('reaction-indicator');

  const turnBasedActions = [actionIndicator, bonusActionIndicator, movementIndicator];

  if (isMyTurn) {
    // Enable all actions on your turn - remove ALL inline styles to let CSS control everything
    [...turnBasedActions, reactionIndicator].forEach(indicator => {
      if (indicator) {
        indicator.dataset.disabled = 'false';
        // Remove all inline styles - let CSS [data-used] attribute fully control appearance
        indicator.style.removeProperty('opacity');
        indicator.style.removeProperty('cursor');
        indicator.style.removeProperty('pointer-events');
      }
    });
  } else {
    // Disable turn-based actions, keep reaction available
    turnBasedActions.forEach(indicator => {
      if (indicator) {
        indicator.dataset.disabled = 'true';
        // Force disabled appearance with inline styles (overrides CSS)
        indicator.style.opacity = '0.3';
        indicator.style.cursor = 'not-allowed';
        indicator.style.pointerEvents = 'auto'; // Still clickable for warning
      }
    });

    // Keep reaction enabled
    if (reactionIndicator) {
      reactionIndicator.dataset.disabled = 'false';
      // Remove all inline styles for reaction
      reactionIndicator.style.removeProperty('opacity');
      reactionIndicator.style.removeProperty('cursor');
      reactionIndicator.style.removeProperty('pointer-events');
    }
  }

  debug.log(`🔄 Action economy updated: isMyTurn=${isMyTurn}, actions=${turnBasedActions.length > 0 ? 'enabled' : 'disabled'}, reaction=${reactionIndicator ? 'enabled' : 'N/A'}`);
}

/**
 * Activate turn for this character
 */
function activateTurn() {
  debug.log('⚔️ Activating turn - setting isMyTurn = true');
  isMyTurn = true;
  
  // Reset reaction at the start of your turn (one reaction per round)
  const reactionIndicator = document.getElementById('reaction-indicator');
  if (reactionIndicator) {
    reactionIndicator.dataset.used = 'false';
    debug.log('🔄 Reaction restored (one per round limit)');
  }
  
  updateActionEconomyAvailability();

  // Add visual highlight effect
  const actionEconomy = document.querySelector('.action-economy');
  if (actionEconomy) {
    actionEconomy.style.boxShadow = '0 0 20px rgba(78, 205, 196, 0.6)';
    actionEconomy.style.border = '2px solid #4ECDC4';
    debug.log('⚔️ Added visual highlight to action economy');
  }

  debug.log('⚔️ Turn activated! All actions available.');
}

/**
 * Deactivate turn for this character
 */
function deactivateTurn() {
  isMyTurn = false;
  updateActionEconomyAvailability();

  // Remove visual highlight
  const actionEconomy = document.querySelector('.action-economy');
  if (actionEconomy) {
    actionEconomy.style.boxShadow = '';
    actionEconomy.style.border = '';
  }

  debug.log('⏸️ Turn ended. Only reaction available.');
}

/**
 * Mark action as used based on casting time
 * This handles the action economy tracking for spells and abilities
 */
function markActionAsUsed(castingTime) {
  if (!castingTime) {
    debug.warn('⚠️ No casting time provided to markActionAsUsed');
    return;
  }
  
  const actionIndicator = document.getElementById('action-indicator');
  const bonusActionIndicator = document.getElementById('bonus-action-indicator');
  const movementIndicator = document.getElementById('movement-indicator');
  const reactionIndicator = document.getElementById('reaction-indicator');
  
  // Normalize casting time for comparison (case insensitive)
  const normalizedTime = castingTime.toLowerCase().trim();
  
  debug.log(`🎯 Marking action as used for casting time: "${castingTime}" (normalized: "${normalizedTime}")`);
  debug.log(`🎯 Available indicators: Action=${!!actionIndicator}, Bonus=${!!bonusActionIndicator}, Movement=${!!movementIndicator}, Reaction=${!!reactionIndicator}`);
  
  // Mark appropriate action as used based on casting time
  if (normalizedTime.includes('bonus')) {
    if (bonusActionIndicator && bonusActionIndicator.dataset.used !== 'true') {
      bonusActionIndicator.dataset.used = 'true';
      debug.log(`🎯 Bonus Action used for casting`);
      // Action usage is tracked visually, no need to announce to chat
    } else {
      debug.log(`⚠️ Bonus Action indicator not found or already used`);
    }
  } else if (normalizedTime.includes('movement') || normalizedTime.includes('move')) {
    if (movementIndicator && movementIndicator.dataset.used !== 'true') {
      movementIndicator.dataset.used = 'true';
      debug.log(`🎯 Movement used for casting`);
      // Action usage is tracked visually, no need to announce to chat
    } else {
      debug.log(`⚠️ Movement indicator not found or already used`);
    }
  } else if (normalizedTime.includes('reaction')) {
    // Reactions are limited to one per round
    if (reactionIndicator && reactionIndicator.dataset.used !== 'true') {
      reactionIndicator.dataset.used = 'true';
      debug.log(`🎯 Reaction used for casting (one per round limit)`);
      // Action usage is tracked visually, no need to announce to chat
    } else {
      debug.log(`⚠️ Reaction indicator not found or already used this round`);
    }
  } else {
    // Default to action for anything else
    if (actionIndicator && actionIndicator.dataset.used !== 'true') {
      actionIndicator.dataset.used = 'true';
      debug.log(`🎯 Action used for casting`);
      // Action usage is tracked visually, no need to announce to chat
    } else {
      debug.log(`⚠️ Action indicator not found or already used`);
    }
  }
  
  // Update visual state
  updateActionEconomyAvailability();
}
/**
 * Post action usage to chat
 */
function postActionToChat(actionLabel, state) {
  const emoji = state === 'used' ? '❌' : '✅';
  const message = `${emoji} ${characterData.name} ${state === 'used' ? 'uses' : 'restores'} ${actionLabel}`;
  postToChatIfOpener(message);
}

/**
 * Post a message to Roll20 chat if opener exists
 */
function postToChatIfOpener(message) {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'postChatMessageFromPopup',
        message: message
      }, '*');
      debug.log(`📤 Posted to chat: ${message}`);
    }
  } catch (error) {
    debug.warn('⚠️ Could not post to chat:', error);
  }
}

/**
 * Effects System - Buffs and Debuffs
 */

// POSITIVE EFFECTS (Buffs/Spells)
const POSITIVE_EFFECTS = [
  {
    name: 'Bless',
    icon: '✨',
    color: '#f39c12',
    description: '+1d4 to attack rolls and saving throws',
    modifier: { attack: '1d4', save: '1d4' },
    autoApply: true
  },
  {
    name: 'Guidance',
    icon: '🙏',
    color: '#3498db',
    description: '+1d4 to one ability check',
    modifier: { skill: '1d4' },
    autoApply: false // User choice required
  },
  {
    name: 'Bardic Inspiration (d6)',
    icon: '🎵',
    color: '#9b59b6',
    description: 'Bard levels 1-4: +d6 to ability check, attack, or save',
    modifier: { attack: 'd6', skill: 'd6', save: 'd6' },
    autoApply: false
  },
  {
    name: 'Bardic Inspiration (d8)',
    icon: '🎵',
    color: '#9b59b6',
    description: 'Bard levels 5-9: +d8 to ability check, attack, or save',
    modifier: { attack: 'd8', skill: 'd8', save: 'd8' },
    autoApply: false
  },
  {
    name: 'Bardic Inspiration (d10)',
    icon: '🎵',
    color: '#9b59b6',
    description: 'Bard levels 10-14: +d10 to ability check, attack, or save',
    modifier: { attack: 'd10', skill: 'd10', save: 'd10' },
    autoApply: false
  },
  {
    name: 'Bardic Inspiration (d12)',
    icon: '🎵',
    color: '#9b59b6',
    description: 'Bard levels 15-20: +d12 to ability check, attack, or save',
    modifier: { attack: 'd12', skill: 'd12', save: 'd12' },
    autoApply: false
  },
  {
    name: 'Haste',
    icon: '⚡',
    color: '#3498db',
    description: '+2 AC, advantage on DEX saves, extra action',
    modifier: { ac: 2, dexSave: 'advantage' },
    autoApply: true
  },
  {
    name: 'Enlarge',
    icon: '⬆️',
    color: '#27ae60',
    description: '+1d4 weapon damage, advantage on STR checks/saves',
    modifier: { damage: '1d4', strCheck: 'advantage', strSave: 'advantage' },
    autoApply: true
  },
  {
    name: 'Invisibility',
    icon: '👻',
    color: '#ecf0f1',
    description: 'Advantage on attack rolls, enemies have disadvantage',
    modifier: { attack: 'advantage' },
    autoApply: true
  },
  {
    name: 'Shield of Faith',
    icon: '🛡️',
    color: '#f39c12',
    description: '+2 AC',
    modifier: { ac: 2 },
    autoApply: true
  },
  {
    name: 'Heroism',
    icon: '🦸',
    color: '#e67e22',
    description: 'Immune to frightened, temp HP each turn',
    modifier: { frightened: 'immune' },
    autoApply: true
  },
  {
    name: 'Enhance Ability',
    icon: '💪',
    color: '#27ae60',
    description: 'Advantage on ability checks with chosen ability',
    modifier: { skill: 'advantage' },
    autoApply: false
  },
  {
    name: 'Aid',
    icon: '❤️',
    color: '#e74c3c',
    description: 'Max HP increased by 5',
    modifier: { maxHp: 5 },
    autoApply: true
  },
  {
    name: 'True Strike',
    icon: '🎯',
    color: '#3498db',
    description: 'Advantage on next attack roll',
    modifier: { attack: 'advantage' },
    autoApply: true
  },
  {
    name: 'Faerie Fire',
    icon: '✨',
    color: '#9b59b6',
    description: 'Attackers have advantage against target',
    modifier: {},
    autoApply: false
  }
];

// NEGATIVE EFFECTS (Debuffs/Conditions)
const NEGATIVE_EFFECTS = [
  {
    name: 'Bane',
    icon: '💀',
    color: '#e74c3c',
    description: '-1d4 to attack rolls and saving throws',
    modifier: { attack: '-1d4', save: '-1d4' },
    autoApply: true
  },
  {
    name: 'Poisoned',
    icon: '☠️',
    color: '#27ae60',
    description: 'Disadvantage on attack rolls and ability checks',
    modifier: { attack: 'disadvantage', skill: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Frightened',
    icon: '😱',
    color: '#e67e22',
    description: 'Disadvantage on ability checks and attack rolls',
    modifier: { attack: 'disadvantage', skill: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Stunned',
    icon: '💫',
    color: '#9b59b6',
    description: 'Incapacitated, auto-fail STR/DEX saves, attackers have advantage',
    modifier: { strSave: 'fail', dexSave: 'fail' },
    autoApply: true
  },
  {
    name: 'Paralyzed',
    icon: '🧊',
    color: '#34495e',
    description: 'Incapacitated, auto-fail STR/DEX saves, attacks within 5ft are crits',
    modifier: { strSave: 'fail', dexSave: 'fail' },
    autoApply: true
  },
  {
    name: 'Restrained',
    icon: '⛓️',
    color: '#7f8c8d',
    description: 'Disadvantage on DEX saves and attack rolls',
    modifier: { attack: 'disadvantage', dexSave: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Blinded',
    icon: '🙈',
    color: '#34495e',
    description: 'Auto-fail sight checks, disadvantage on attacks',
    modifier: { attack: 'disadvantage', perception: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Deafened',
    icon: '🙉',
    color: '#7f8c8d',
    description: 'Auto-fail hearing checks',
    modifier: { perception: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Charmed',
    icon: '💖',
    color: '#e91e63',
    description: 'Cannot attack charmer, charmer has advantage on social checks',
    modifier: {},
    autoApply: false
  },
  {
    name: 'Grappled',
    icon: '🤼',
    color: '#f39c12',
    description: 'Speed becomes 0',
    modifier: { speed: 0 },
    autoApply: true
  },
  {
    name: 'Prone',
    icon: '⬇️',
    color: '#95a5a6',
    description: 'Disadvantage on attack rolls, melee attacks against you have advantage',
    modifier: { attack: 'disadvantage' },
    autoApply: true
  },
  {
    name: 'Incapacitated',
    icon: '😵',
    color: '#c0392b',
    description: 'Cannot take actions or reactions',
    modifier: {},
    autoApply: false
  },
  {
    name: 'Unconscious',
    icon: '😴',
    color: '#34495e',
    description: 'Incapacitated, drop everything, auto-fail STR/DEX saves',
    modifier: { strSave: 'fail', dexSave: 'fail' },
    autoApply: true
  },
  {
    name: 'Petrified',
    icon: '🗿',
    color: '#95a5a6',
    description: 'Incapacitated, auto-fail STR/DEX saves, resistance to all damage',
    modifier: { strSave: 'fail', dexSave: 'fail' },
    autoApply: true
  },
  {
    name: 'Slowed',
    icon: '🐌',
    color: '#95a5a6',
    description: 'Speed halved, -2 AC and DEX saves, no reactions',
    modifier: { ac: -2, dexSave: '-2' },
    autoApply: true
  },
  {
    name: 'Hexed',
    icon: '🔮',
    color: '#9b59b6',
    description: 'Disadvantage on ability checks with chosen ability, extra damage to caster',
    modifier: { skill: 'disadvantage' },
    autoApply: false
  },
  {
    name: 'Cursed',
    icon: '😈',
    color: '#c0392b',
    description: 'Disadvantage on attacks and saves against caster',
    modifier: { attack: 'disadvantage', save: 'disadvantage' },
    autoApply: true
  }
];

let activeConditions = [];
let activeBuffs = [];

function initConditionsManager() {
  const addConditionBtn = document.getElementById('add-condition-btn');

  if (addConditionBtn) {
    // Open modal when clicking conditions button
    addConditionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEffectsModal();
    });
  }

  debug.log('✅ Effects manager initialized (buffs + debuffs)');
}

function showEffectsModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden;';

  // Modal header
  const header = document.createElement('div');
  header.style.cssText = 'padding: 20px; border-bottom: 2px solid #ecf0f1; background: #f8f9fa;';
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; color: #2c3e50;">🎭 Effects & Conditions</h3>
      <button id="effects-modal-close" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">✕</button>
    </div>
  `;

  // Tab navigation
  const tabNav = document.createElement('div');
  tabNav.style.cssText = 'display: flex; background: #ecf0f1; border-bottom: 2px solid #bdc3c7;';
  tabNav.innerHTML = `
    <button class="effects-tab-btn" data-tab="buffs" style="flex: 1; padding: 15px; background: white; border: none; border-bottom: 3px solid #27ae60; cursor: pointer; font-weight: bold; font-size: 1em; color: #27ae60; transition: all 0.2s;">✨ Buffs</button>
    <button class="effects-tab-btn" data-tab="debuffs" style="flex: 1; padding: 15px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: bold; font-size: 1em; color: #7f8c8d; transition: all 0.2s;">💀 Debuffs</button>
  `;

  // Tab content container
  const tabContent = document.createElement('div');
  tabContent.style.cssText = 'padding: 20px; overflow-y: auto; flex: 1;';

  // Buffs tab
  const buffsTab = document.createElement('div');
  buffsTab.className = 'effects-tab-content';
  buffsTab.dataset.tab = 'buffs';
  buffsTab.style.display = 'block';
  buffsTab.innerHTML = POSITIVE_EFFECTS.map(effect => `
    <div class="effect-option" data-effect="${effect.name}" data-type="positive" style="padding: 12px; margin-bottom: 10px; border: 2px solid ${effect.color}40; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="effect-icon" style="font-size: 1.5em;">${effect.icon}</span>
        <div style="flex: 1;">
          <div class="effect-name" style="font-weight: bold; color: #2c3e50; margin-bottom: 4px;">${effect.name}</div>
          <div class="effect-description" style="font-size: 0.85em; color: #7f8c8d;">${effect.description}</div>
        </div>
      </div>
    </div>
  `).join('');

  // Debuffs tab
  const debuffsTab = document.createElement('div');
  debuffsTab.className = 'effects-tab-content';
  debuffsTab.dataset.tab = 'debuffs';
  debuffsTab.style.display = 'none';
  debuffsTab.innerHTML = NEGATIVE_EFFECTS.map(effect => `
    <div class="effect-option" data-effect="${effect.name}" data-type="negative" style="padding: 12px; margin-bottom: 10px; border: 2px solid ${effect.color}40; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="effect-icon" style="font-size: 1.5em;">${effect.icon}</span>
        <div style="flex: 1;">
          <div class="effect-name" style="font-weight: bold; color: #2c3e50; margin-bottom: 4px;">${effect.name}</div>
          <div class="effect-description" style="font-size: 0.85em; color: #7f8c8d;">${effect.description}</div>
        </div>
      </div>
    </div>
  `).join('');

  tabContent.appendChild(buffsTab);
  tabContent.appendChild(debuffsTab);

  // Assemble modal
  modalContent.appendChild(header);
  modalContent.appendChild(tabNav);
  modalContent.appendChild(tabContent);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Tab switching
  const tabButtons = tabNav.querySelectorAll('.effects-tab-btn');
  const tabContents = modalContent.querySelectorAll('.effects-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Update button styles
      tabButtons.forEach(b => {
        if (b.dataset.tab === targetTab) {
          b.style.background = 'white';
          b.style.color = targetTab === 'buffs' ? '#27ae60' : '#e74c3c';
          b.style.borderBottom = `3px solid ${targetTab === 'buffs' ? '#27ae60' : '#e74c3c'}`;
        } else {
          b.style.background = 'transparent';
          b.style.color = '#7f8c8d';
          b.style.borderBottom = '3px solid transparent';
        }
      });

      // Show target tab content
      tabContents.forEach(content => {
        content.style.display = content.dataset.tab === targetTab ? 'block' : 'none';
      });
    });
  });

  // Add hover effects
  modalContent.querySelectorAll('.effect-option').forEach(option => {
    option.addEventListener('mouseenter', () => {
      option.style.transform = 'translateX(5px)';
      option.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    option.addEventListener('mouseleave', () => {
      option.style.transform = 'translateX(0)';
      option.style.boxShadow = 'none';
    });
  });

  // Add effect when clicking option
  modalContent.querySelectorAll('.effect-option').forEach(option => {
    option.addEventListener('click', () => {
      const effectName = option.dataset.effect;
      const type = option.dataset.type === 'positive' ? 'positive' : 'negative';
      addEffect(effectName, type);
      modal.remove();
    });
  });

  // Close button
  const closeBtn = modalContent.querySelector('#effects-modal-close');
  closeBtn.addEventListener('click', () => modal.remove());

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function addEffect(effectName, type) {
  const effectsList = type === 'positive' ? POSITIVE_EFFECTS : NEGATIVE_EFFECTS;
  const activeList = type === 'positive' ? activeBuffs : activeConditions;

  // Don't add if already active
  if (activeList.includes(effectName)) {
    showNotification(`⚠️ ${effectName} already active`);
    return;
  }

  const effect = effectsList.find(e => e.name === effectName);
  activeList.push(effectName);

  // Update the correct array reference
  if (type === 'positive') {
    activeBuffs = activeList;
  } else {
    activeConditions = activeList;
  }

  updateEffectsDisplay();
  showNotification(`${effect.icon} ${effectName} applied!`);
  debug.log(`✅ Effect added: ${effectName} (${type})`);

  // Announce to Roll20 chat
  const message = type === 'positive'
    ? `${effect.icon} ${characterData.name} gains ${effectName}!`
    : `${effect.icon} ${characterData.name} is now ${effectName}!`;
  postToChatIfOpener(message);

  // Save to character data
  if (!characterData.activeEffects) {
    characterData.activeEffects = { buffs: [], debuffs: [] };
  }
  if (type === 'positive') {
    characterData.activeEffects.buffs = activeBuffs;
  } else {
    characterData.activeEffects.debuffs = activeConditions;
  }
  saveCharacterData();
}

function removeEffect(effectName, type) {
  const effectsList = type === 'positive' ? POSITIVE_EFFECTS : NEGATIVE_EFFECTS;
  const effect = effectsList.find(e => e.name === effectName);

  if (type === 'positive') {
    activeBuffs = activeBuffs.filter(e => e !== effectName);
  } else {
    activeConditions = activeConditions.filter(e => e !== effectName);
  }

  updateEffectsDisplay();
  showNotification(`✅ ${effectName} removed`);
  debug.log(`🗑️ Effect removed: ${effectName} (${type})`);

  // Announce to Roll20 chat
  const message = type === 'positive'
    ? `✅ ${characterData.name} loses ${effectName}`
    : `✅ ${characterData.name} is no longer ${effectName}`;
  postToChatIfOpener(message);

  // Save to character data
  if (!characterData.activeEffects) {
    characterData.activeEffects = { buffs: [], debuffs: [] };
  }
  if (type === 'positive') {
    characterData.activeEffects.buffs = activeBuffs;
  } else {
    characterData.activeEffects.debuffs = activeConditions;
  }
  saveCharacterData();
}

// Legacy function for backwards compatibility
function addCondition(conditionName) {
  addEffect(conditionName, 'negative');
}

function removeCondition(conditionName) {
  removeEffect(conditionName, 'negative');
}

function updateEffectsDisplay() {
  const container = document.getElementById('active-conditions');
  if (!container) return;

  let html = '';

  // Show buffs section
  if (activeBuffs.length > 0) {
    html += '<div style="margin-bottom: 15px;">';
    html += '<div style="font-size: 0.85em; font-weight: bold; color: #27ae60; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><span>✨</span> BUFFS</div>';
    html += activeBuffs.map(effectName => {
      const effect = POSITIVE_EFFECTS.find(e => e.name === effectName);
      return `
        <div class="effect-badge" data-effect="${effectName}" data-type="positive" title="${effect.description} - Click to remove" style="background: ${effect.color}20; border: 2px solid ${effect.color}; cursor: pointer; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="effect-badge-icon" style="font-size: 1.2em;">${effect.icon}</span>
            <div style="flex: 1;">
              <div style="font-weight: bold; color: var(--text-primary);">${effect.name}</div>
              <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 2px;">${effect.description}</div>
            </div>
            <span class="effect-badge-remove" style="font-weight: bold; opacity: 0.7; color: #e74c3c;">✕</span>
          </div>
        </div>
      `;
    }).join('');
    html += '</div>';
  }

  // Show debuffs section
  if (activeConditions.length > 0) {
    html += '<div style="margin-bottom: 15px;">';
    html += '<div style="font-size: 0.85em; font-weight: bold; color: #e74c3c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><span>💀</span> DEBUFFS</div>';
    html += activeConditions.map(effectName => {
      const effect = NEGATIVE_EFFECTS.find(e => e.name === effectName);
      return `
        <div class="effect-badge" data-effect="${effectName}" data-type="negative" title="${effect.description} - Click to remove" style="background: ${effect.color}20; border: 2px solid ${effect.color}; cursor: pointer; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="effect-badge-icon" style="font-size: 1.2em;">${effect.icon}</span>
            <div style="flex: 1;">
              <div style="font-weight: bold; color: var(--text-primary);">${effect.name}</div>
              <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 2px;">${effect.description}</div>
            </div>
            <span class="effect-badge-remove" style="font-weight: bold; opacity: 0.7; color: #e74c3c;">✕</span>
          </div>
        </div>
      `;
    }).join('');
    html += '</div>';
  }

  // Show empty state if no effects
  if (activeBuffs.length === 0 && activeConditions.length === 0) {
    html = '<div style="text-align: center; color: #888; padding: 15px; font-size: 0.9em;">No active effects</div>';
  }

  container.innerHTML = html;

  // Update AC display to reflect any changes
  const acElement = document.getElementById('char-ac');
  if (acElement) {
    acElement.textContent = calculateTotalAC();
  }

  // Add click handlers to remove effects
  container.querySelectorAll('.effect-badge').forEach(badge => {
    const effectName = badge.dataset.effect;
    const type = badge.dataset.type;

    // Add hover effect
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'translateX(3px)';
      badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'translateX(0)';
      badge.style.boxShadow = 'none';
    });

    // Remove on click
    badge.addEventListener('click', () => {
      removeEffect(effectName, type);
    });
  });
}

// Legacy function for backwards compatibility
function updateConditionsDisplay() {
  updateEffectsDisplay();
}

/**
 * Concentration Tracker
 */
let concentratingSpell = null;

function initConcentrationTracker() {
  const dropConcentrationBtn = document.getElementById('drop-concentration-btn');

  if (dropConcentrationBtn) {
    dropConcentrationBtn.addEventListener('click', () => {
      dropConcentration();
    });
  }

  debug.log('✅ Concentration tracker initialized');
}

function setConcentration(spellName) {
  concentratingSpell = spellName;
  if (characterData) {
    characterData.concentration = spellName;
    saveCharacterData();
  }
  updateConcentrationDisplay();
  showNotification(`🧠 Concentrating on: ${spellName}`);
  debug.log(`🧠 Concentration set: ${spellName}`);
}

function dropConcentration() {
  if (!concentratingSpell) return;

  const spellName = concentratingSpell;
  concentratingSpell = null;
  if (characterData) {
    characterData.concentration = null;
    saveCharacterData();
  }
  updateConcentrationDisplay();
  showNotification(`✅ Dropped concentration on ${spellName}`);
  debug.log(`🗑️ Concentration dropped: ${spellName}`);
}

function updateConcentrationDisplay() {
  const concentrationIndicator = document.getElementById('concentration-indicator');
  const concentrationSpell = document.getElementById('concentration-spell');

  if (!concentrationIndicator) return;

  if (concentratingSpell) {
    concentrationIndicator.style.display = 'flex';
    if (concentrationSpell) {
      concentrationSpell.textContent = concentratingSpell;
    }
  } else {
    concentrationIndicator.style.display = 'none';
  }
}

/**
 * GM Mode Toggle
 */
function initGMMode() {
  const gmModeToggle = document.getElementById('gm-mode-toggle');

  if (gmModeToggle) {
    gmModeToggle.addEventListener('click', () => {
      const isActive = gmModeToggle.classList.contains('active');

      // Send message to Roll20 content script to toggle GM panel
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          action: 'toggleGMMode',
          enabled: !isActive
        }, '*');
        debug.log(`👑 GM Mode ${!isActive ? 'enabled' : 'disabled'}`);
      } else {
        // Try via background script
        browserAPI.runtime.sendMessage({
          action: 'toggleGMMode',
          enabled: !isActive
        });
      }

      // Toggle active state
      gmModeToggle.classList.toggle('active');
      showNotification(isActive ? '👑 GM Mode disabled' : '👑 GM Mode enabled!');
    });

    debug.log('✅ GM Mode toggle initialized');
  }
}

/**
 * Show to GM Button - Broadcasts character data to GM
 */
function initShowToGM() {
  const showToGMBtn = document.getElementById('show-to-gm-btn');

  if (showToGMBtn) {
    showToGMBtn.addEventListener('click', () => {
      if (!characterData) {
        showNotification('⚠️ No character data to share', 'warning');
        return;
      }

      try {
        // Create character broadcast message with ENTIRE sheet data
        const broadcastData = {
          type: 'ROLLCLOUD_CHARACTER_BROADCAST',
          character: characterData,
          // Include ALL character data for complete sheet
          fullSheet: {
            ...characterData,
            // Ensure all sections are included
            attributes: characterData.attributes || {},
            skills: characterData.skills || [],
            savingThrows: characterData.savingThrows || {},
            actions: characterData.actions || [],
            spells: characterData.spells || [],
            features: characterData.features || [],
            equipment: characterData.equipment || [],
            inventory: characterData.inventory || {},
            resources: characterData.resources || {},
            spellSlots: characterData.spellSlots || {},
            companions: characterData.companions || [],
            conditions: characterData.conditions || [],
            notes: characterData.notes || '',
            background: characterData.background || '',
            personality: characterData.personality || {},
            proficiencies: characterData.proficiencies || [],
            languages: characterData.languages || [],
            // Add simplified properties for popout compatibility
            hp: characterData.hitPoints?.current || characterData.hp || 0,
            maxHp: characterData.hitPoints?.max || characterData.maxHp || 0,
            ac: characterData.armorClass || characterData.ac || 10,
            initiative: characterData.initiative || 0,
            passivePerception: characterData.passivePerception || 10,
            proficiency: characterData.proficiencyBonus || characterData.proficiency || 0,
            speed: characterData.speed || '30 ft'
          },
          timestamp: new Date().toISOString()
        };

        // Encode the data for safe transmission (handle UTF-8 properly)
        const jsonString = JSON.stringify(broadcastData);
        const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
        const broadcastMessage = `👑[ROLLCLOUD:CHARACTER:${encodedData}]👑`;

        // Send to Roll20 chat via parent window
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            action: 'postChatMessageFromPopup',
            message: broadcastMessage
          }, '*');
          
          showNotification(`👑 ${characterData.name} shared with GM!`, 'success');
          debug.log('👑 Character broadcast sent to GM:', characterData.name);
        } else {
          // Try via background script
          browserAPI.runtime.sendMessage({
            action: 'postChatMessageFromPopup',
            message: broadcastMessage
          }).then(() => {
            showNotification(`👑 ${characterData.name} shared with GM!`, 'success');
            debug.log('👑 Character broadcast sent via background script:', characterData.name);
          }).catch(err => {
            debug.error('❌ Failed to send character broadcast:', err);
            showNotification('❌ Failed to share with GM', 'error');
          });
        }
      } catch (error) {
        debug.error('❌ Error creating character broadcast:', error);
        showNotification('❌ Failed to prepare character data', 'error');
      }
    });

    debug.log('✅ Show to GM button initialized in settings');
  } else {
    debug.warn('⚠️ Show to GM button not found in settings');
  }
}

/**
 * Initialize manual DiceCloud sync button in settings
 */
function initManualSyncButton() {
  const syncSection = document.getElementById('dicecloud-sync-section');
  const syncButton = document.getElementById('manual-sync-btn');
  const syncStatus = document.getElementById('sync-status');

  // Only show in experimental builds
  browserAPI.runtime.sendMessage({ action: 'getManifest' }).then(response => {
    if (response && response.success && response.manifest &&
        response.manifest.name && response.manifest.name.includes('EXPERIMENTAL')) {
      if (syncSection) {
        syncSection.style.display = 'block';
        debug.log('🧪 DiceCloud sync section shown (experimental build)');
      }
    }
  }).catch(err => {
    debug.log('📦 Not experimental build, hiding sync section');
  });

  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      try {
        debug.log('🔄 Manual sync button clicked');

        // Disable button during sync
        syncButton.disabled = true;
        syncButton.textContent = '🔄 Syncing...';

        // Show status
        if (syncStatus) {
          syncStatus.style.display = 'block';
          syncStatus.style.background = 'var(--accent-info)';
          syncStatus.style.color = 'white';
          syncStatus.textContent = '⏳ Syncing to DiceCloud...';
        }

        // Collect all character data
        if (!characterData) {
          throw new Error('No character data available');
        }

        // Extract Channel Divinity from resources if it exists
        const channelDivinityResource = characterData.resources?.find(r =>
          r.name === 'Channel Divinity' ||
          r.variableName === 'channelDivinityCleric' ||
          r.variableName === 'channelDivinityPaladin' ||
          r.variableName === 'channelDivinity'
        );

        // Build comprehensive sync message
        const syncMessage = {
          type: 'characterDataUpdate',
          characterData: {
            name: characterData.name,
            hp: characterData.hitPoints.current,
            tempHp: characterData.temporaryHP || 0,
            maxHp: characterData.hitPoints.max,
            spellSlots: characterData.spellSlots || {},
            channelDivinity: channelDivinityResource ? {
              current: channelDivinityResource.current,
              max: channelDivinityResource.max
            } : undefined,
            resources: characterData.resources || [],
            actions: characterData.actions || [],
            deathSaves: characterData.deathSaves,
            inspiration: characterData.inspiration,
            lastRoll: characterData.lastRoll
          }
        };

        debug.log('🔄 Sending manual sync message:', syncMessage);

        // Send to Roll20 content script (which will forward to DiceCloud sync)
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(syncMessage, '*');
          debug.log('✅ Sync message sent via opener');
        } else {
          // Also try posting to self (in case we're in a popup)
          window.postMessage(syncMessage, '*');
          debug.log('✅ Sync message sent to self');
        }

        // Wait a bit for sync to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Show success
        if (syncStatus) {
          syncStatus.style.background = 'var(--accent-success)';
          syncStatus.textContent = '✅ Synced successfully!';
        }
        showNotification('✅ Character data synced to DiceCloud!', 'success');
        debug.log('✅ Manual sync completed');

        // Reset button
        setTimeout(() => {
          syncButton.disabled = false;
          syncButton.textContent = '🔄 Sync to DiceCloud Now';
          if (syncStatus) {
            syncStatus.style.display = 'none';
          }
        }, 2000);

      } catch (error) {
        debug.error('❌ Manual sync failed:', error);

        if (syncStatus) {
          syncStatus.style.display = 'block';
          syncStatus.style.background = 'var(--accent-danger)';
          syncStatus.style.color = 'white';
          syncStatus.textContent = '❌ Sync failed: ' + error.message;
        }
        showNotification('❌ Sync failed: ' + error.message, 'error');

        // Reset button
        syncButton.disabled = false;
        syncButton.textContent = '🔄 Sync to DiceCloud Now';
      }
    });

    debug.log('✅ Manual sync button initialized');
  } else {
    debug.warn('⚠️ Manual sync button not found in settings');
  }
}

// Listen for messages from GM panel (when it's your turn)
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'activateTurn') {
    debug.log('🎯 Your turn! Activating action economy...');
    debug.log('🎯 Received activateTurn event:', event.data);

    // Activate turn state
    activateTurn();

    // Reset action economy for new turn (only reset actions, don't announce)
    const actionIndicator = document.getElementById('action-indicator');
    const bonusActionIndicator = document.getElementById('bonus-action-indicator');
    const movementIndicator = document.getElementById('movement-indicator');
    
    [actionIndicator, bonusActionIndicator, movementIndicator].forEach(indicator => {
      if (indicator) {
        indicator.dataset.used = 'false';
        debug.log(`🔄 Reset ${indicator.id} to unused`);
      }
    });
    
    debug.log('🔄 Turn reset: Action, Bonus Action, Movement restored (automatic)');

    showNotification('⚔️ Your turn!', 'success');
  } else if (event.data && event.data.action === 'deactivateTurn') {
    debug.log('⏸️ Turn ended. Deactivating action economy...');
    debug.log('⏸️ Received deactivateTurn event:', event.data);

    // Deactivate turn state
    deactivateTurn();
  } else if (event.data && event.data.action === 'rollResult') {
    // Handle roll results from content script for racial traits checking
    debug.log('🧬 Received rollResult message:', event.data);
    
    if (event.data.checkRacialTraits && (activeRacialTraits.length > 0 || activeFeatTraits.length > 0)) {
      const { rollResult, baseRoll, rollType, rollName } = event.data;
      debug.log(`🧬 Checking racial traits for roll: ${baseRoll} (${rollType}) - ${rollName}`);
      debug.log(`🧬 Active racial traits count: ${activeRacialTraits.length}`);
      debug.log(`🎖️ Active feat traits count: ${activeFeatTraits.length}`);
      debug.log(`🧬 Roll details - Total: ${rollResult}, Base: ${baseRoll}`);
      
      // Check if any racial traits trigger (use baseRoll for the actual d20 roll)
      const racialTraitTriggered = checkRacialTraits(baseRoll, rollType, rollName);
      const triggeredRacialTraits = [];
      
      // Check if any feat traits trigger (use baseRoll for the actual d20 roll)
      const featTraitTriggered = checkFeatTraits(baseRoll, rollType, rollName);
      const triggeredFeatTraits = [];
      
      // Collect triggered traits
      if (racialTraitTriggered) {
        triggeredRacialTraits.push(...activeRacialTraits.filter(trait => {
          // Check if this trait would trigger for this roll
          const testResult = trait.onRoll(baseRoll, rollType, rollName);
          return testResult === true;
        }));
        debug.log(`🧬 Racial trait triggered for roll: ${baseRoll}`);
      }
      
      if (featTraitTriggered) {
        triggeredFeatTraits.push(...activeFeatTraits.filter(trait => {
          // Check if this trait would trigger for this roll
          const testResult = trait.onRoll(baseRoll, rollType, rollName);
          return testResult === true;
        }));
        debug.log(`🎖️ Feat trait triggered for roll: ${baseRoll}`);
      }
      
      // Show appropriate popup
      if (triggeredRacialTraits.length > 0 || triggeredFeatTraits.length > 0) {
        const allTriggeredTraits = [...triggeredRacialTraits, ...triggeredFeatTraits];
        
        if (allTriggeredTraits.length === 1) {
          // Single trait triggered - show its specific popup
          const trait = allTriggeredTraits[0];
          if (trait.name === 'Halfling Luck') {
            showHalflingLuckPopup({
              rollResult: baseRoll,
              baseRoll: baseRoll,
              rollType: rollType,
              rollName: rollName
            });
          } else if (trait.name === 'Lucky') {
            const luckyResource = getLuckyResource();
            showLuckyPopup({
              rollResult: baseRoll,
              baseRoll: baseRoll,
              rollType: rollType,
              rollName: rollName,
              luckPointsRemaining: luckyResource?.current || 0
            });
          }
        } else {
          // Multiple traits triggered - show choice popup
          showTraitChoicePopup({
            rollResult: baseRoll,
            baseRoll: baseRoll,
            rollType: rollType,
            rollName: rollName,
            racialTraits: triggeredRacialTraits,
            featTraits: triggeredFeatTraits
          });
        }
      }
      
      if (!racialTraitTriggered && !featTraitTriggered) {
        debug.log(`🧬🎖️ No traits triggered for roll: ${baseRoll}`);
      }
    } else {
      debug.log(`🧬 Skipping traits check - checkRacialTraits: ${event.data.checkRacialTraits}, racialTraits: ${activeRacialTraits.length}, featTraits: ${activeFeatTraits.length}`);
    }
  } else if (event.data && event.data.action === 'showHalflingLuckPopup') {
    // Show Halfling Luck reroll popup
    showHalflingLuckPopup(event.data.rollData);
  }
});

// Initialize combat mechanics when sheet loads
setTimeout(() => {
  initCombatMechanics();
}, 100);

// Local character cache to preserve state changes
const characterCache = new Map();

// Initialize racial traits and feats
let activeRacialTraits = [];
let activeFeatTraits = [];

function initRacialTraits() {
  debug.log('🧬 Initializing racial traits...');
  debug.log('🧬 Character data:', characterData);
  debug.log('🧬 Character race:', characterData?.race);

  // Reset racial traits
  activeRacialTraits = [];

  if (!characterData || !characterData.race) {
    debug.log('🧬 No race data available');
    return;
  }

  const race = characterData.race.toLowerCase();

  // Halfling Luck
  if (race.includes('halfling')) {
    debug.log('🧬 Halfling detected, adding Halfling Luck trait');
    activeRacialTraits.push(HalflingLuck);
  }

  // Elven Accuracy (check for feat in features)
  if (characterData.features && characterData.features.some(f =>
    f.name && f.name.toLowerCase().includes('elven accuracy')
  )) {
    debug.log('🧝 Elven Accuracy feat detected');
    activeRacialTraits.push(ElvenAccuracy);
  }

  // Dwarven Resilience
  if (race.includes('dwarf')) {
    debug.log('⛏️ Dwarf detected, adding Dwarven Resilience trait');
    activeRacialTraits.push(DwarvenResilience);
  }

  // Gnome Cunning
  if (race.includes('gnome')) {
    debug.log('🎩 Gnome detected, adding Gnome Cunning trait');
    activeRacialTraits.push(GnomeCunning);
  }

  debug.log(`🧬 Initialized ${activeRacialTraits.length} racial traits`);
}

function initFeatTraits() {
  debug.log('🎖️ Initializing feat traits...');
  debug.log('🎖️ Character features:', characterData?.features);

  // Reset feat traits
  activeFeatTraits = [];

  if (!characterData || !characterData.features) {
    debug.log('🎖️ No features data available');
    return;
  }

  // Lucky feat is now handled as an action, not a trait
  debug.log('🎖️ Lucky feat will be available as an action button');

  debug.log(`🎖️ Initialized ${activeFeatTraits.length} feat traits`);
}

function initClassFeatures() {
  debug.log('⚔️ Initializing class features...');
  debug.log('⚔️ Character class:', characterData?.class);
  debug.log('⚔️ Character level:', characterData?.level);

  if (!characterData) {
    debug.log('⚔️ No character data available');
    return;
  }

  const characterClass = (characterData.class || '').toLowerCase();
  const level = characterData.level || 1;

  // Reliable Talent (Rogue 11+)
  if (characterClass.includes('rogue') && level >= 11) {
    debug.log('🎯 Rogue 11+ detected, adding Reliable Talent');
    activeFeatTraits.push(ReliableTalent);
  }

  // Bardic Inspiration (Bard)
  if (characterClass.includes('bard') && level >= 1) {
    debug.log('🎵 Bard detected, adding Bardic Inspiration');
    activeFeatTraits.push(BardicInspiration);
  }

  // Jack of All Trades (Bard)
  if (characterClass.includes('bard') && level >= 2) {
    debug.log('🎵 Bard detected, adding Jack of All Trades');
    activeFeatTraits.push(JackOfAllTrades);
  }

  // Rage Damage Bonus (Barbarian)
  if (characterClass.includes('barbarian')) {
    debug.log('😡 Barbarian detected, adding Rage Damage Bonus');
    activeFeatTraits.push(RageDamageBonus);
  }

  // Brutal Critical (Barbarian 9+)
  if (characterClass.includes('barbarian') && level >= 9) {
    debug.log('💥 Barbarian 9+ detected, adding Brutal Critical');
    activeFeatTraits.push(BrutalCritical);
  }

  // Portent (Divination Wizard 2+)
  if (characterClass.includes('wizard') && level >= 2) {
    // Check for Divination subclass in features
    const isDivination = characterData.features && characterData.features.some(f =>
      f.name && (f.name.toLowerCase().includes('divination') || f.name.toLowerCase().includes('portent'))
    );
    if (isDivination) {
      debug.log('🔮 Divination Wizard detected, adding Portent');
      activeFeatTraits.push(PortentDice);
      // Auto-roll portent dice
      PortentDice.rollPortentDice();
    }
  }

  // Wild Magic Surge (Wild Magic Sorcerer)
  if (characterClass.includes('sorcerer')) {
    // Check for Wild Magic subclass in features
    const isWildMagic = characterData.features && characterData.features.some(f =>
      f.name && f.name.toLowerCase().includes('wild magic')
    );
    if (isWildMagic) {
      debug.log('🌀 Wild Magic Sorcerer detected, adding Wild Magic Surge');
      activeFeatTraits.push(WildMagicSurge);
    }
  }

  debug.log(`⚔️ Initialized ${activeFeatTraits.length} class feature traits`);
}

function checkRacialTraits(rollResult, rollType, rollName) {
  debug.log(`🧬 Checking racial traits for roll: ${rollResult} (${rollType}) - ${rollName}`);
  debug.log(`🧬 Active racial traits count: ${activeRacialTraits.length}`);
  
  let traitTriggered = false;
  
  for (const trait of activeRacialTraits) {
    if (trait.onRoll && typeof trait.onRoll === 'function') {
      const result = trait.onRoll(rollResult, rollType, rollName);
      if (result) {
        traitTriggered = true;
        debug.log(`🧬 ${trait.name} triggered!`);
      }
    }
  }
  
  return traitTriggered;
}

function checkFeatTraits(rollResult, rollType, rollName) {
  debug.log(`🎖️ Checking feat traits for roll: ${rollResult} (${rollType}) - ${rollName}`);
  debug.log(`🎖️ Active feat traits count: ${activeFeatTraits.length}`);
  
  let traitTriggered = false;
  
  for (const trait of activeFeatTraits) {
    if (trait.onRoll && typeof trait.onRoll === 'function') {
      const result = trait.onRoll(rollResult, rollType, rollName);
      if (result) {
        traitTriggered = true;
        debug.log(`🎖️ ${trait.name} triggered!`);
      }
    }
  }
  
  return traitTriggered;
}

debug.log('✅ Popup script fully loaded');

// Helper function to get theme-aware popup colors
function getPopupThemeColors() {
  const isDarkMode = document.documentElement.classList.contains('theme-dark') ||
                     document.documentElement.getAttribute('data-theme') === 'dark';

  return {
    background: isDarkMode ? '#2d2d2d' : '#ffffff',
    text: isDarkMode ? '#e0e0e0' : '#333333',
    heading: isDarkMode ? '#ffffff' : '#2D8B83',
    border: isDarkMode ? '#444444' : '#f0f8ff',
    borderAccent: isDarkMode ? '#2D8B83' : '#2D8B83',
    infoBox: isDarkMode ? '#1a1a1a' : '#f0f8ff',
    infoText: isDarkMode ? '#b0b0b0' : '#666666'
  };
}

// Halfling Luck Popup Functions
function showHalflingLuckPopup(rollData) {
  debug.log('🍀 Halfling Luck popup called with:', rollData);

  // Check if document.body exists
  if (!document.body) {
    debug.error('❌ document.body not available for Halfling Luck popup');
    showNotification('🍀 Halfling Luck triggered! (Popup failed to display)', 'info');
    return;
  }

  debug.log('🍀 Creating popup overlay...');

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  debug.log('🍀 Setting popup content HTML...');

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🍀</div>
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Halfling Luck!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You rolled a natural 1! As a Halfling, you can reroll this d20.
    </p>
    <div style="margin: 0 0 16px 0; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid ${colors.borderAccent}; color: ${colors.text};">
      <strong>Original Roll:</strong> ${rollData.rollName}<br>
      <strong>Result:</strong> ${rollData.baseRoll} (natural 1)<br>
      <strong>Total:</strong> ${rollData.rollResult}
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="halflingRerollBtn" style="
        background: #2D8B83;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
      ">🎲 Reroll</button>
      <button id="halflingKeepBtn" style="
        background: #e74c3c;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
      ">Keep Roll</button>
    </div>
  `;

  debug.log('🍀 Appending popup to document.body...');

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);
  
  // Add event listeners
  document.getElementById('halflingRerollBtn').addEventListener('click', () => {
    debug.log('🍀 User chose to reroll');
    performHalflingReroll(rollData);
    document.body.removeChild(popupOverlay);
  });
  
  document.getElementById('halflingKeepBtn').addEventListener('click', () => {
    debug.log('🍀 User chose to keep roll');
    document.body.removeChild(popupOverlay);
  });
  
  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      debug.log('🍀 User closed popup');
      document.body.removeChild(popupOverlay);
    }
  });
  
  debug.log('🍀 Halfling Luck popup displayed');
}

// Lucky Feat Popup Functions
function showLuckyPopup(rollData) {
  debug.log('🎖️ Lucky popup called with:', rollData);

  // Check if document.body exists
  if (!document.body) {
    debug.error('❌ document.body not available for Lucky popup');
    showNotification('🎖️ Lucky triggered! (Popup failed to display)', 'info');
    return;
  }

  debug.log('🎖️ Creating Lucky popup overlay...');

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  debug.log('🎖️ Setting Lucky popup content HTML...');

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🎖️</div>
    <h2 style="margin: 0 0 8px 0; color: #f39c12;">Lucky Feat!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You rolled a ${rollData.baseRoll}! You have ${rollData.luckPointsRemaining} luck points remaining.
    </p>
    <div style="margin: 0 0 16px 0; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid #f39c12; color: ${colors.text};">
      <strong>Original Roll:</strong> ${rollData.rollName}<br>
      <strong>Result:</strong> ${rollData.baseRoll}<br>
      <strong>Luck Points:</strong> ${rollData.luckPointsRemaining}/3
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="luckyRerollBtn" style="
        background: #f39c12;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        transition: background 0.2s;
      ">
        🎲 Reroll (Use Luck Point)
      </button>
      <button id="luckyKeepBtn" style="
        background: #95a5a6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        transition: background 0.2s;
      ">
        Keep Roll
      </button>
    </div>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  debug.log('🎖️ Appending Lucky popup to document.body...');

  // Add event listeners
  const rerollBtn = document.getElementById('luckyRerollBtn');
  const keepBtn = document.getElementById('luckyKeepBtn');

  // Add hover effects via event listeners (CSP-compliant)
  rerollBtn.addEventListener('mouseenter', () => rerollBtn.style.background = '#e67e22');
  rerollBtn.addEventListener('mouseleave', () => rerollBtn.style.background = '#f39c12');
  keepBtn.addEventListener('mouseenter', () => keepBtn.style.background = '#7f8c8d');
  keepBtn.addEventListener('mouseleave', () => keepBtn.style.background = '#95a5a6');

  rerollBtn.addEventListener('click', () => {
    if (useLuckyPoint()) {
      performLuckyReroll(rollData);
      popupOverlay.remove();
    } else {
      alert('No luck points available!');
    }
  });

  keepBtn.addEventListener('click', () => {
    popupOverlay.remove();
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      popupOverlay.remove();
    }
  });

  debug.log('🎖️ Lucky popup displayed');
}

function performLuckyReroll(originalRollData) {
  debug.log('🎖️ Performing Lucky reroll for:', originalRollData);
  
  // Extract base formula (remove modifiers for the reroll)
  const baseFormula = originalRollData.rollType.replace(/[+-]\d+$/i, '');
  
  // Create a new roll with just the d20
  const rerollData = {
    name: `🎖️ ${originalRollData.rollName} (Lucky Reroll)`,
    formula: baseFormula,
    color: '#f39c12',
    characterName: characterData.name
  };

  // Send the reroll request
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'rollFromPopout',
      ...rerollData
    }, '*');
    debug.log('🎖️ Lucky reroll sent via window.opener');
  } else {
    // Fallback: send directly to Roll20 via background script
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: rerollData
    });
  }
  
  showNotification('🎖️ Lucky reroll initiated!', 'success');
}

// Unified Trait Choice Popup
function showTraitChoicePopup(rollData) {
  debug.log('🎯 Trait choice popup called with:', rollData);

  // Check if document.body exists
  if (!document.body) {
    debug.error('❌ document.body not available for trait choice popup');
    showNotification('🎯 Trait choice triggered! (Popup failed to display)', 'info');
    return;
  }

  debug.log('🎯 Creating trait choice overlay...');

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  // Build trait options HTML
  let traitOptionsHTML = '';
  const allTraits = [...rollData.racialTraits, ...rollData.featTraits];
  
  allTraits.forEach((trait, index) => {
    let icon = '';
    let color = '';
    let description = '';
    
    if (trait.name === 'Halfling Luck') {
      icon = '🍀';
      color = '#2D8B83';
      description = 'Reroll natural 1s (must use new roll)';
    } else if (trait.name === 'Lucky') {
      icon = '🎖️';
      color = '#f39c12';
      const luckyResource = getLuckyResource();
      description = `Reroll any roll (${luckyResource?.current || 0}/3 points left)`;
    }
    
    traitOptionsHTML += `
      <button class="trait-option-btn" data-trait-index="${index}" data-trait-color="${color}" style="
        background: ${color};
        color: white;
        border: none;
        padding: 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        margin: 8px 0;
        transition: transform 0.2s, background 0.2s;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      ">
        <span style="font-size: 20px;">${icon}</span>
        <div style="text-align: left;">
          <div style="font-weight: bold;">${trait.name}</div>
          <div style="font-size: 12px; opacity: 0.9;">${description}</div>
        </div>
      </button>
    `;
  });

  debug.log('🎯 Setting trait choice popup content HTML...');

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🎯</div>
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Multiple Traits Available!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You rolled a ${rollData.baseRoll}! Choose which trait to use:
    </p>
    <div style="margin: 0 0 16px 0; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid #3498db; color: ${colors.text};">
      <strong>Original Roll:</strong> ${rollData.rollName}<br>
      <strong>Result:</strong> ${rollData.baseRoll}<br>
      <strong>Total:</strong> ${rollData.rollResult}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${traitOptionsHTML}
    </div>
    <button id="cancelTraitBtn" style="
      background: #95a5a6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      margin-top: 8px;
      transition: background 0.2s;
    ">
      Keep Original Roll
    </button>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  debug.log('🎯 Appending trait choice popup to document.body...');

  // Add event listeners
  const traitButtons = document.querySelectorAll('.trait-option-btn');
  const cancelBtn = document.getElementById('cancelTraitBtn');

  // Add hover effects for trait buttons (CSP-compliant)
  traitButtons.forEach((btn, index) => {
    const originalColor = btn.dataset.traitColor;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.background = originalColor + 'dd';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.background = originalColor;
    });

    btn.addEventListener('click', () => {
      const trait = allTraits[index];
      debug.log(`🎯 User chose trait: ${trait.name}`);

      popupOverlay.remove();

      // Execute the chosen trait's action
      if (trait.name === 'Halfling Luck') {
        showHalflingLuckPopup({
          rollResult: rollData.baseRoll,
          baseRoll: rollData.baseRoll,
          rollType: rollData.rollType,
          rollName: rollData.rollName
        });
      } else if (trait.name === 'Lucky') {
        const luckyResource = getLuckyResource();
        showLuckyPopup({
          rollResult: rollData.baseRoll,
          baseRoll: rollData.baseRoll,
          rollType: rollData.rollType,
          rollName: rollData.rollName,
          luckPointsRemaining: luckyResource?.current || 0
        });
      }
    });
  });

  // Add hover effects for cancel button (CSP-compliant)
  cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#7f8c8d');
  cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#95a5a6');

  cancelBtn.addEventListener('click', () => {
    popupOverlay.remove();
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      popupOverlay.remove();
    }
  });

  debug.log('🎯 Trait choice popup displayed');
}

// Wild Magic Surge Popup
function showWildMagicSurgePopup(d100Roll, effect) {
  debug.log('🌀 Wild Magic Surge popup called with:', d100Roll, effect);

  if (!document.body) {
    debug.error('❌ document.body not available for Wild Magic Surge popup');
    showNotification(`🌀 Wild Magic Surge! d100: ${d100Roll}`, 'warning');
    return;
  }

  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  popupContent.innerHTML = `
    <div style="font-size: 32px; margin-bottom: 16px;">🌀</div>
    <h2 style="margin: 0 0 8px 0; color: #9b59b6;">Wild Magic Surge!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      Your spell triggers a wild magic surge!
    </p>
    <div style="margin: 0 0 16px 0; padding: 16px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid #9b59b6; color: ${colors.text}; text-align: left;">
      <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 12px; color: #9b59b6;">
        d100 Roll: ${d100Roll}
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
        ${effect}
      </div>
    </div>
    <button id="closeWildMagicBtn" style="
      background: #9b59b6;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
      transition: background 0.2s;
    ">Got it!</button>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  // Add event listeners
  const closeBtn = document.getElementById('closeWildMagicBtn');

  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#8e44ad');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = '#9b59b6');

  closeBtn.addEventListener('click', () => {
    document.body.removeChild(popupOverlay);
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      document.body.removeChild(popupOverlay);
    }
  });

  // Also announce to Roll20 chat
  const colorBanner = getColoredBanner();
  const message = `&{template:default} {{name=${colorBanner}${characterData.name} - Wild Magic Surge! 🌀}} {{d100 Roll=${d100Roll}}} {{Effect=${effect}}}`;

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'announceSpell',
      message: message
    }, '*');
  }

  debug.log('🌀 Wild Magic Surge popup displayed');
}

// Bardic Inspiration Popup Functions
function showBardicInspirationPopup(rollData) {
  debug.log('🎵 Bardic Inspiration popup called with:', rollData);

  // Check if document.body exists
  if (!document.body) {
    debug.error('❌ document.body not available for Bardic Inspiration popup');
    showNotification('🎵 Bardic Inspiration available! (Popup failed to display)', 'info');
    return;
  }

  debug.log('🎵 Creating Bardic Inspiration popup overlay...');

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  debug.log('🎵 Setting Bardic Inspiration popup content HTML...');

  popupContent.innerHTML = `
    <div style="font-size: 32px; margin-bottom: 16px;">🎵</div>
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Bardic Inspiration!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      Add a <strong>${rollData.inspirationDie}</strong> to this roll?
    </p>
    <div style="margin: 0 0 16px 0; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid #9b59b6; color: ${colors.text};">
      <strong>Current Roll:</strong> ${rollData.rollName}<br>
      <strong>Base Result:</strong> ${rollData.baseRoll}<br>
      <strong>Inspiration Die:</strong> ${rollData.inspirationDie}<br>
      <strong>Uses Left:</strong> ${rollData.usesRemaining}
    </div>
    <div style="margin-bottom: 16px; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; color: ${colors.text}; font-size: 13px; text-align: left;">
      <strong>💡 How it works:</strong><br>
      • Roll the inspiration die and add it to your total<br>
      • Can be used on ability checks, attack rolls, or saves<br>
      • Only one inspiration die can be used per roll
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="bardicUseBtn" style="
        background: #9b59b6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        transition: background 0.2s;
      ">🎲 Use Inspiration</button>
      <button id="bardicDeclineBtn" style="
        background: #7f8c8d;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        transition: background 0.2s;
      ">Decline</button>
    </div>
  `;

  debug.log('🎵 Appending Bardic Inspiration popup to document.body...');

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  // Add hover effects
  const useBtn = document.getElementById('bardicUseBtn');
  const declineBtn = document.getElementById('bardicDeclineBtn');

  useBtn.addEventListener('mouseenter', () => {
    useBtn.style.background = '#8e44ad';
  });
  useBtn.addEventListener('mouseleave', () => {
    useBtn.style.background = '#9b59b6';
  });

  declineBtn.addEventListener('mouseenter', () => {
    declineBtn.style.background = '#95a5a6';
  });
  declineBtn.addEventListener('mouseleave', () => {
    declineBtn.style.background = '#7f8c8d';
  });

  // Add event listeners
  useBtn.addEventListener('click', () => {
    debug.log('🎵 User chose to use Bardic Inspiration');
    performBardicInspirationRoll(rollData);
    document.body.removeChild(popupOverlay);
  });

  declineBtn.addEventListener('click', () => {
    debug.log('🎵 User declined Bardic Inspiration');
    showNotification('Bardic Inspiration declined', 'info');
    document.body.removeChild(popupOverlay);
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      debug.log('🎵 User closed Bardic Inspiration popup');
      document.body.removeChild(popupOverlay);
    }
  });

  debug.log('🎵 Bardic Inspiration popup displayed');
}

function performBardicInspirationRoll(rollData) {
  debug.log('🎵 Performing Bardic Inspiration roll with data:', rollData);

  // Use one Bardic Inspiration use
  const success = useBardicInspiration();
  if (!success) {
    debug.error('❌ Failed to use Bardic Inspiration (no uses left?)');
    showNotification('❌ Failed to use Bardic Inspiration', 'error');
    return;
  }

  // Roll the inspiration die
  const dieSize = parseInt(rollData.inspirationDie.substring(1)); // "d6" -> 6
  const inspirationRoll = Math.floor(Math.random() * dieSize) + 1;

  debug.log(`🎵 Rolled ${rollData.inspirationDie}: ${inspirationRoll}`);

  // Create the roll message
  const inspirationMessage = `/roll ${rollData.inspirationDie}`;
  const chatMessage = `🎵 Bardic Inspiration for ${rollData.rollName}: [[${inspirationRoll}]] (${rollData.inspirationDie})`;

  // Show notification
  showNotification(`🎵 Bardic Inspiration: +${inspirationRoll}!`, 'success');

  // Post to Roll20 chat
  browserAPI.runtime.sendMessage({
    action: 'rollDice',
    rollData: {
      message: chatMessage,
      characterName: characterData.name || 'Character'
    }
  });

  debug.log('🎵 Bardic Inspiration roll complete');
}

// Elven Accuracy Popup
function showElvenAccuracyPopup(rollData) {
  debug.log('🧝 Elven Accuracy popup called with:', rollData);

  if (!document.body) {
    debug.error('❌ document.body not available for Elven Accuracy popup');
    showNotification('🧝 Elven Accuracy triggered!', 'info');
    return;
  }

  const colors = getPopupThemeColors();

  // Create popup overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🧝</div>
    <h2 style="margin: 0 0 8px 0; color: #27ae60;">Elven Accuracy!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You have advantage! Would you like to reroll the lower die?
    </p>
    <div style="margin: 0 0 16px 0; padding: 12px; background: ${colors.infoBox}; border-radius: 8px; border-left: 4px solid #27ae60; color: ${colors.text};">
      <strong>Roll:</strong> ${rollData.rollName}<br>
      <strong>Type:</strong> Advantage attack roll
    </div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="elvenRerollBtn" style="
        background: #27ae60;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
      ">🎲 Reroll Lower Die</button>
      <button id="elvenKeepBtn" style="
        background: #95a5a6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
      ">Keep Rolls</button>
    </div>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  // Add event listeners
  const rerollBtn = document.getElementById('elvenRerollBtn');
  const keepBtn = document.getElementById('elvenKeepBtn');

  rerollBtn.addEventListener('mouseenter', () => rerollBtn.style.background = '#229954');
  rerollBtn.addEventListener('mouseleave', () => rerollBtn.style.background = '#27ae60');
  keepBtn.addEventListener('mouseenter', () => keepBtn.style.background = '#7f8c8d');
  keepBtn.addEventListener('mouseleave', () => keepBtn.style.background = '#95a5a6');

  rerollBtn.addEventListener('click', () => {
    debug.log('🧝 User chose to reroll with Elven Accuracy');
    performElvenAccuracyReroll(rollData);
    document.body.removeChild(popupOverlay);
  });

  keepBtn.addEventListener('click', () => {
    debug.log('🧝 User chose to keep original advantage rolls');
    document.body.removeChild(popupOverlay);
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      document.body.removeChild(popupOverlay);
    }
  });

  debug.log('🧝 Elven Accuracy popup displayed');
}

function performElvenAccuracyReroll(originalRollData) {
  debug.log('🧝 Performing Elven Accuracy reroll for:', originalRollData);

  // Roll a third d20
  const thirdRoll = Math.floor(Math.random() * 20) + 1;

  // Create reroll announcement
  const rerollData = {
    name: `🧝 ${originalRollData.rollName} (Elven Accuracy - 3rd die)`,
    formula: '1d20',
    color: '#27ae60',
    characterName: characterData.name
  };

  debug.log('🧝 Third die roll:', thirdRoll);

  // Announce the third die roll to Roll20
  const colorBanner = getColoredBanner();
  const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Elven Accuracy! 🧝}} {{Action=Reroll lower die}} {{Third d20=${thirdRoll}}} {{=Choose the highest of all three rolls!}}`;

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'announceSpell',
      message: message
    }, '*');
  } else {
    // Fallback: send directly to Roll20 via background script
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: { ...rerollData, result: thirdRoll }
    });
  }

  showNotification(`🧝 Elven Accuracy! Third die: ${thirdRoll}`, 'success');
}

// Lucky Modal (simple like metamagic)
function showLuckyModal() {
  debug.log('🎖️ Lucky modal called');

  const luckyResource = getLuckyResource();
  if (!luckyResource || luckyResource.current <= 0) {
    showNotification('❌ No luck points available!', 'error');
    return;
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; border-radius: 8px; padding: 20px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #f39c12;">🎖️ Use Lucky Point</h3>
    <p style="margin: 0 0 15px 0; color: #666;">Choose what to use Lucky for:</p>
    <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
      <strong>Luck Points:</strong> ${luckyResource.current}/${luckyResource.max}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button id="luckyOffensive" style="padding: 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">⚔️ Attack/Check/Saving Throw</button>
      <button id="luckyDefensive" style="padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🛡️ Against Attack on You</button>
      <button id="luckyCancel" style="padding: 10px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add event listeners
  document.getElementById('luckyOffensive').addEventListener('click', () => {
    if (useLuckyPoint()) {
      modal.remove();
      // Roll a d20 for Lucky
      rollLuckyDie('offensive');
    }
  });

  document.getElementById('luckyDefensive').addEventListener('click', () => {
    if (useLuckyPoint()) {
      modal.remove();
      // Roll a d20 for Lucky defense
      rollLuckyDie('defensive');
    }
  });

  document.getElementById('luckyCancel').addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  debug.log('🎖️ Lucky modal displayed');
}

function rollLuckyDie(type) {
  debug.log(`🎖️ Rolling Lucky d20 for ${type}`);
  
  // Roll a d20
  const luckyRoll = Math.floor(Math.random() * 20) + 1;
  
  // Send the Lucky roll to Roll20 chat
  const rollData = {
    name: `🎖️ ${characterData.name} uses Lucky`,
    formula: '1d20',
    characterName: characterData.name
  };

  // Send the roll to Roll20
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'rollFromPopout',
      ...rollData
    }, '*');
    debug.log('🎖️ Lucky roll sent via window.opener');
  } else {
    // Fallback: send directly to Roll20 via background script
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: rollData
    });
  }
  
  if (type === 'offensive') {
    showNotification(`🎖️ Lucky roll: ${luckyRoll}! Use this instead of your next d20 roll.`, 'success');
  } else {
    showNotification(`🎖️ Lucky defense roll: ${luckyRoll}! Compare against attacker's roll.`, 'success');
  }
  
  debug.log(`🎖️ Lucky d20 result: ${luckyRoll} - sent to chat`);
}

function performHalflingReroll(originalRollData) {
  debug.log('🍀 Performing Halfling reroll for:', originalRollData);
  
  // Extract the base formula (remove any modifiers)
  const formula = originalRollData.rollType;
  const baseFormula = formula.split('+')[0]; // Get just the d20 part
  
  // Create a new roll with just the d20
  const rerollData = {
    name: `🍀 ${originalRollData.rollName} (Halfling Luck)`,
    formula: baseFormula,
    color: '#2D8B83',
    characterName: characterData.name
  };
  
  debug.log('🍀 Reroll data:', rerollData);
  
  // Send the reroll request
  if (window.opener && !window.opener.closed) {
    // Send via popup window opener (Roll20 content script)
    window.opener.postMessage({
      action: 'rollFromPopout',
      ...rerollData
    }, '*');
  } else {
    // Fallback: send directly to Roll20 via background script
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: rerollData
    });
  }
  
  showNotification('🍀 Halfling Luck reroll initiated!', 'success');
}

// Halfling Luck Racial Trait
const HalflingLuck = {
  name: 'Halfling Luck',
  description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
  
  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🧬 Halfling Luck onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);
    debug.log(`🧬 Halfling Luck DEBUG - rollType exists: ${!!rollType}, includes d20: ${rollType && rollType.includes('d20')}, rollResult === 1: ${parseInt(rollResult) === 1}`);

    // Convert rollResult to number for comparison
    const numericRollResult = parseInt(rollResult);
    
    // Check if it's a d20 roll and the result is 1
    if (rollType && rollType.includes('d20') && numericRollResult === 1) {
      debug.log(`🧬 Halfling Luck: TRIGGERED! Roll was ${numericRollResult}`);

      // Show the popup with error handling
      try {
        showHalflingLuckPopup({
          rollResult: numericRollResult,
          baseRoll: numericRollResult,
          rollType: rollType,
          rollName: rollName
        });
      } catch (error) {
        debug.error('❌ Error showing Halfling Luck popup:', error);
        // Fallback notification
        showNotification('🍀 Halfling Luck triggered! Check console for details.', 'info');
      }

      return true; // Trait triggered
    }

    debug.log(`🧬 Halfling Luck: No trigger - Roll: ${numericRollResult}, Type: ${rollType}`);
    return false; // No trigger
  }
};

// Lucky Feat Trait
const LuckyFeat = {
  name: 'Lucky',
  description: 'You have 3 luck points. When you make an attack roll, ability check, or saving throw, you can spend one luck point to roll an additional d20. You can then choose which of the d20 rolls to use.',
  
  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🎖️ Lucky feat onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);
    
    // Convert rollResult to number for comparison
    const numericRollResult = parseInt(rollResult);
    
    // Check if it's a d20 roll (attack, ability check, or saving throw)
    if (rollType && rollType.includes('d20')) {
      debug.log(`🎖️ Lucky: Checking if we should offer reroll for ${numericRollResult}`);
      
      // Check if character has luck points available
      const luckyResource = getLuckyResource();
      if (!luckyResource || luckyResource.current <= 0) {
        debug.log(`🎖️ Lucky: No luck points available (${luckyResource?.current || 0})`);
        return false;
      }
      
      debug.log(`🎖️ Lucky: Has ${luckyResource.current} luck points available`);
      
      // For Lucky feat, we offer reroll on any roll (not just 1s)
      // But we should prioritize low rolls
      if (numericRollResult <= 10) { // Offer reroll on rolls of 10 or less
        debug.log(`🎖️ Lucky: TRIGGERED! Offering reroll for roll ${numericRollResult}`);
        
        // Show the Lucky popup with error handling
        try {
          showLuckyPopup({
            rollResult: numericRollResult,
            baseRoll: numericRollResult,
            rollType: rollType,
            rollName: rollName,
            luckPointsRemaining: luckyResource.current
          });
        } catch (error) {
          debug.error('❌ Error showing Lucky popup:', error);
          // Fallback notification
          showNotification('🎖️ Lucky triggered! Check console for details.', 'info');
        }
        
        return true; // Trait triggered
      }
    }

    debug.log(`🎖️ Lucky: No trigger - Roll: ${numericRollResult}, Type: ${rollType}`);
    return false; // No trigger
  }
};

// ============================================================================
// RACIAL TRAITS - ADDITIONAL
// ============================================================================

// Elven Accuracy
const ElvenAccuracy = {
  name: 'Elven Accuracy',
  description: 'Whenever you have advantage on an attack roll using Dexterity, Intelligence, Wisdom, or Charisma, you can reroll one of the dice once.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🧝 Elven Accuracy onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // Check if it's an attack roll with advantage using DEX/INT/WIS/CHA
    // The rollType should contain "advantage" and the roll should be an attack
    if (rollType && rollType.includes('advantage') && rollType.includes('attack')) {
      debug.log(`🧝 Elven Accuracy: TRIGGERED! Offering to reroll lower die`);

      // Show popup asking if they want to reroll
      showElvenAccuracyPopup({
        rollName: rollName,
        rollType: rollType,
        rollResult: rollResult
      });

      return true;
    }

    return false;
  }
};

// Dwarven Resilience
const DwarvenResilience = {
  name: 'Dwarven Resilience',
  description: 'You have advantage on saving throws against poison.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`⛏️ Dwarven Resilience onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // Check if it's a poison save
    const lowerRollName = rollName.toLowerCase();
    if (rollType && rollType.includes('save') && lowerRollName.includes('poison')) {
      debug.log(`⛏️ Dwarven Resilience: TRIGGERED! Auto-applying advantage`);
      showNotification('⛏️ Dwarven Resilience: Advantage on poison saves!', 'success');
      return true;
    }

    return false;
  }
};

// Gnome Cunning
const GnomeCunning = {
  name: 'Gnome Cunning',
  description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🎩 Gnome Cunning onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // Check if it's an INT/WIS/CHA save against magic
    const lowerRollName = rollName.toLowerCase();
    const isMentalSave = lowerRollName.includes('intelligence') ||
                         lowerRollName.includes('wisdom') ||
                         lowerRollName.includes('charisma') ||
                         lowerRollName.includes('int save') ||
                         lowerRollName.includes('wis save') ||
                         lowerRollName.includes('cha save');

    const isMagic = lowerRollName.includes('spell') ||
                    lowerRollName.includes('magic') ||
                    lowerRollName.includes('charm') ||
                    lowerRollName.includes('illusion');

    if (rollType && rollType.includes('save') && isMentalSave && isMagic) {
      debug.log(`🎩 Gnome Cunning: TRIGGERED! Auto-applying advantage`);
      showNotification('🎩 Gnome Cunning: Advantage on mental saves vs magic!', 'success');
      return true;
    }

    return false;
  }
};

// ============================================================================
// CLASS FEATURES
// ============================================================================

// Reliable Talent (Rogue 11+)
const ReliableTalent = {
  name: 'Reliable Talent',
  description: 'Whenever you make an ability check that lets you add your proficiency bonus, you treat a d20 roll of 9 or lower as a 10.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🎯 Reliable Talent onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    const numericRollResult = parseInt(rollResult);

    // Check if it's a skill check (proficient skills would be marked somehow)
    if (rollType && rollType.includes('skill') && numericRollResult < 10) {
      debug.log(`🎯 Reliable Talent: TRIGGERED! Minimum roll is 10`);
      showNotification(`🎯 Reliable Talent: ${numericRollResult} becomes 10!`, 'success');
      return true;
    }

    return false;
  }
};

// Jack of All Trades (Bard)
const JackOfAllTrades = {
  name: 'Jack of All Trades',
  description: 'You can add half your proficiency bonus (rounded down) to any ability check you make that doesn\'t already include your proficiency bonus.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🎵 Jack of All Trades onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // This would need to check if the skill is non-proficient
    // For now, we'll show a reminder
    if (rollType && rollType.includes('skill')) {
      const profBonus = characterData.proficiencyBonus || 2;
      const halfProf = Math.floor(profBonus / 2);
      debug.log(`🎵 Jack of All Trades: Reminder to add +${halfProf} if non-proficient`);
      showNotification(`🎵 Jack: Add +${halfProf} if non-proficient`, 'info');
      return true;
    }

    return false;
  }
};

// Rage Damage Bonus (Barbarian)
const RageDamageBonus = {
  name: 'Rage',
  description: 'While raging, you gain bonus damage on melee weapon attacks using Strength.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`😡 Rage Damage onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // Check if character is raging (would need rage tracking)
    const isRaging = characterData.conditions && characterData.conditions.some(c =>
      c.toLowerCase().includes('rage') || c.toLowerCase().includes('raging')
    );

    if (isRaging && rollType && rollType.includes('attack')) {
      const level = characterData.level || 1;
      const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
      debug.log(`😡 Rage Damage: TRIGGERED! Adding +${rageDamage} damage`);
      showNotification(`😡 Rage: Add +${rageDamage} damage!`, 'success');
      return true;
    }

    return false;
  }
};

// Brutal Critical (Barbarian)
const BrutalCritical = {
  name: 'Brutal Critical',
  description: 'You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`💥 Brutal Critical onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    const numericRollResult = parseInt(rollResult);

    // Check for natural 20 on melee attack
    if (rollType && rollType.includes('attack') && numericRollResult === 20) {
      const level = characterData.level || 1;
      const extraDice = level < 13 ? 1 : level < 17 ? 2 : 3;
      debug.log(`💥 Brutal Critical: TRIGGERED! Roll ${extraDice} extra weapon die/dice`);
      showNotification(`💥 Brutal Critical: Roll ${extraDice} extra weapon die!`, 'success');
      return true;
    }

    return false;
  }
};

// Portent Dice (Divination Wizard)
const PortentDice = {
  name: 'Portent',
  description: 'Roll two d20s and record the numbers. You can replace any attack roll, saving throw, or ability check made by you or a creature you can see with one of these rolls.',

  portentRolls: [], // Store portent rolls for the day

  rollPortentDice: function() {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    this.portentRolls = [roll1, roll2];
    debug.log(`🔮 Portent: Rolled ${roll1} and ${roll2}`);
    showNotification(`🔮 Portent: You rolled ${roll1} and ${roll2}`, 'info');
    return this.portentRolls;
  },

  usePortentRoll: function(index) {
    if (index >= 0 && index < this.portentRolls.length) {
      const roll = this.portentRolls.splice(index, 1)[0];
      debug.log(`🔮 Portent: Used portent roll ${roll}`);
      showNotification(`🔮 Portent: Applied roll of ${roll}`, 'success');
      return roll;
    }
    return null;
  },

  onRoll: function(rollResult, rollType, rollName) {
    // Portent is applied manually, not automatically triggered
    if (this.portentRolls.length > 0) {
      showNotification(`🔮 ${this.portentRolls.length} Portent dice available`, 'info');
    }
    return false;
  }
};

// Wild Magic Surge Table (d100)
const WILD_MAGIC_EFFECTS = [
  "Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.",
  "Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.",
  "For the next minute, you can see any invisible creature if you have line of sight to it.",
  "For the next minute, you can see any invisible creature if you have line of sight to it.",
  "A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.",
  "A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.",
  "You cast Fireball as a 3rd-level spell centered on yourself.",
  "You cast Fireball as a 3rd-level spell centered on yourself.",
  "You cast Magic Missile as a 5th-level spell.",
  "You cast Magic Missile as a 5th-level spell.",
  "Roll a d10. Your height changes by a number of inches equal to the roll. If the roll is odd, you shrink. If the roll is even, you grow.",
  "Roll a d10. Your height changes by a number of inches equal to the roll. If the roll is odd, you shrink. If the roll is even, you grow.",
  "You cast Confusion centered on yourself.",
  "You cast Confusion centered on yourself.",
  "For the next minute, you regain 5 hit points at the start of each of your turns.",
  "For the next minute, you regain 5 hit points at the start of each of your turns.",
  "You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.",
  "You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.",
  "You cast Grease centered on yourself.",
  "You cast Grease centered on yourself.",
  "Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.",
  "Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.",
  "Your skin turns a vibrant shade of blue. A Remove Curse spell can end this effect.",
  "Your skin turns a vibrant shade of blue. A Remove Curse spell can end this effect.",
  "An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.",
  "An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.",
  "For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.",
  "For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.",
  "You teleport up to 60 feet to an unoccupied space of your choice that you can see.",
  "You teleport up to 60 feet to an unoccupied space of your choice that you can see.",
  "You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space if that space is occupied.",
  "You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space if that space is occupied.",
  "Maximize the damage of the next damaging spell you cast within the next minute.",
  "Maximize the damage of the next damaging spell you cast within the next minute.",
  "Roll a d10. Your age changes by a number of years equal to the roll. If the roll is odd, you get younger (minimum 1 year old). If the roll is even, you get older.",
  "Roll a d10. Your age changes by a number of years equal to the roll. If the roll is odd, you get younger (minimum 1 year old). If the roll is even, you get older.",
  "1d6 flumphs controlled by the DM appear in unoccupied spaces within 60 feet of you and are frightened of you. They vanish after 1 minute.",
  "1d6 flumphs controlled by the DM appear in unoccupied spaces within 60 feet of you and are frightened of you. They vanish after 1 minute.",
  "You regain 2d10 hit points.",
  "You regain 2d10 hit points.",
  "You turn into a potted plant until the start of your next turn. While a plant, you are incapacitated and have vulnerability to all damage. If you drop to 0 hit points, your pot breaks, and your form reverts.",
  "You turn into a potted plant until the start of your next turn. While a plant, you are incapacitated and have vulnerability to all damage. If you drop to 0 hit points, your pot breaks, and your form reverts.",
  "For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.",
  "For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.",
  "You cast Levitate on yourself.",
  "You cast Levitate on yourself.",
  "A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.",
  "A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.",
  "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth.",
  "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth.",
  "A spectral shield hovers near you for the next minute, granting you a +2 bonus to AC and immunity to Magic Missile.",
  "A spectral shield hovers near you for the next minute, granting you a +2 bonus to AC and immunity to Magic Missile.",
  "You are immune to being intoxicated by alcohol for the next 5d6 days.",
  "You are immune to being intoxicated by alcohol for the next 5d6 days.",
  "Your hair falls out but grows back within 24 hours.",
  "Your hair falls out but grows back within 24 hours.",
  "For the next minute, any flammable object you touch that isn't being worn or carried by another creature bursts into flame.",
  "For the next minute, any flammable object you touch that isn't being worn or carried by another creature bursts into flame.",
  "You regain your lowest-level expended spell slot.",
  "You regain your lowest-level expended spell slot.",
  "For the next minute, you must shout when you speak.",
  "For the next minute, you must shout when you speak.",
  "You cast Fog Cloud centered on yourself.",
  "You cast Fog Cloud centered on yourself.",
  "Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.",
  "Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.",
  "You are frightened by the nearest creature until the end of your next turn.",
  "You are frightened by the nearest creature until the end of your next turn.",
  "Each creature within 30 feet of you becomes invisible for the next minute. The invisibility ends on a creature when it attacks or casts a spell.",
  "Each creature within 30 feet of you becomes invisible for the next minute. The invisibility ends on a creature when it attacks or casts a spell.",
  "You gain resistance to all damage for the next minute.",
  "You gain resistance to all damage for the next minute.",
  "A random creature within 60 feet of you becomes poisoned for 1d4 hours.",
  "A random creature within 60 feet of you becomes poisoned for 1d4 hours.",
  "You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.",
  "You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.",
  "You cast Polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration.",
  "You cast Polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration.",
  "Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.",
  "Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.",
  "You can take one additional action immediately.",
  "You can take one additional action immediately.",
  "Each creature within 30 feet of you takes 1d10 necrotic damage. You regain hit points equal to the sum of the necrotic damage dealt.",
  "Each creature within 30 feet of you takes 1d10 necrotic damage. You regain hit points equal to the sum of the necrotic damage dealt.",
  "You cast Mirror Image.",
  "You cast Mirror Image.",
  "You cast Fly on a random creature within 60 feet of you.",
  "You cast Fly on a random creature within 60 feet of you.",
  "You become invisible for the next minute. During that time, other creatures can't hear you. The invisibility ends if you attack or cast a spell.",
  "You become invisible for the next minute. During that time, other creatures can't hear you. The invisibility ends if you attack or cast a spell.",
  "If you die within the next minute, you immediately come back to life as if by the Reincarnate spell.",
  "If you die within the next minute, you immediately come back to life as if by the Reincarnate spell.",
  "Your size increases by one size category for the next minute.",
  "Your size increases by one size category for the next minute.",
  "You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.",
  "You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.",
  "You are surrounded by faint, ethereal music for the next minute.",
  "You are surrounded by faint, ethereal music for the next minute.",
  "You regain all expended sorcery points.",
  "You regain all expended sorcery points."
];

// Wild Magic Surge (Wild Magic Sorcerer)
const WildMagicSurge = {
  name: 'Wild Magic Surge',
  description: 'Immediately after you cast a sorcerer spell of 1st level or higher, the DM can have you roll a d20. If you roll a 1, roll on the Wild Magic Surge table.',

  onSpellCast: function(spellLevel) {
    if (spellLevel >= 1) {
      const surgeRoll = Math.floor(Math.random() * 20) + 1;
      debug.log(`🌀 Wild Magic: Rolled ${surgeRoll} for surge check`);

      if (surgeRoll === 1) {
        const surgeTableRoll = Math.floor(Math.random() * 100) + 1;
        const effect = WILD_MAGIC_EFFECTS[surgeTableRoll - 1];
        debug.log(`🌀 Wild Magic: SURGE! d100 = ${surgeTableRoll}: ${effect}`);
        showWildMagicSurgePopup(surgeTableRoll, effect);
        return true;
      } else {
        showNotification(`🌀 Wild Magic check: ${surgeRoll} (no surge)`, 'info');
      }
    }
    return false;
  },

  onRoll: function(rollResult, rollType, rollName) {
    // Wild Magic is triggered on spell cast, not regular rolls
    return false;
  }
};

// Bardic Inspiration (Bard)
const BardicInspiration = {
  name: 'Bardic Inspiration',
  description: 'You can inspire others through stirring words or music. As a bonus action, grant an ally a Bardic Inspiration die they can add to an ability check, attack roll, or saving throw.',

  onRoll: function(rollResult, rollType, rollName) {
    debug.log(`🎵 Bardic Inspiration onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

    // Check if it's a d20 roll (ability check, attack, or save)
    if (rollType && rollType.includes('d20')) {
      debug.log(`🎵 Bardic Inspiration: Checking if we should offer inspiration for ${rollName}`);

      // Check if character has Bardic Inspiration uses available
      const inspirationResource = getBardicInspirationResource();
      if (!inspirationResource || inspirationResource.current <= 0) {
        debug.log(`🎵 Bardic Inspiration: No uses available (${inspirationResource?.current || 0})`);
        return false;
      }

      debug.log(`🎵 Bardic Inspiration: Has ${inspirationResource.current} uses available`);

      // Get the inspiration die size based on bard level
      const level = characterData.level || 1;
      const inspirationDie = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';

      // Offer Bardic Inspiration on any d20 roll
      debug.log(`🎵 Bardic Inspiration: TRIGGERED! Offering ${inspirationDie}`);

      // Show the Bardic Inspiration popup with error handling
      try {
        showBardicInspirationPopup({
          rollResult: parseInt(rollResult),
          baseRoll: parseInt(rollResult),
          rollType: rollType,
          rollName: rollName,
          inspirationDie: inspirationDie,
          usesRemaining: inspirationResource.current
        });
      } catch (error) {
        debug.error('❌ Error showing Bardic Inspiration popup:', error);
        // Fallback notification
        showNotification(`🎵 Bardic Inspiration available! (${inspirationDie})`, 'info');
      }

      return true; // Trait triggered
    }

    debug.log(`🎵 Bardic Inspiration: No trigger - Type: ${rollType}`);
    return false; // No trigger
  }
};

function getBardicInspirationResource() {
  if (!characterData || !characterData.resources) {
    debug.log('🎵 No characterData or resources for Bardic Inspiration detection');
    return null;
  }

  // Find Bardic Inspiration in resources (flexible matching)
  const inspirationResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase().trim();
    return (
      lowerName.includes('bardic inspiration') ||
      lowerName === 'bardic inspiration' ||
      lowerName === 'inspiration' ||
      lowerName.includes('inspiration die') ||
      lowerName.includes('inspiration dice')
    );
  });

  if (inspirationResource) {
    debug.log(`🎵 Found Bardic Inspiration resource: ${inspirationResource.name} (${inspirationResource.current}/${inspirationResource.max})`);
  } else {
    debug.log('🎵 No Bardic Inspiration resource found in character data');
  }

  return inspirationResource;
}

function useBardicInspiration() {
  debug.log('🎵 useBardicInspiration called');
  const inspirationResource = getBardicInspirationResource();
  debug.log('🎵 Bardic Inspiration resource found:', inspirationResource);

  if (!inspirationResource) {
    debug.error('❌ No Bardic Inspiration resource found');
    return false;
  }

  if (inspirationResource.current <= 0) {
    debug.error(`❌ No Bardic Inspiration uses available (current: ${inspirationResource.current})`);
    return false;
  }

  // Decrement Bardic Inspiration uses
  const oldCurrent = inspirationResource.current;
  inspirationResource.current--;

  debug.log(`✅ Used Bardic Inspiration (${oldCurrent} → ${inspirationResource.current})`);

  // Save to storage
  browserAPI.storage.local.set({ characterData: characterData });

  // Refresh resources display
  buildResourcesDisplay();

  return true;
}

function getLuckyResource() {
  if (!characterData || !characterData.resources) {
    debug.log('🎖️ No characterData or resources for Lucky detection');
    return null;
  }

  // Find Lucky points in resources (flexible matching)
  const luckyResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase().trim();
    return (
      lowerName.includes('lucky point') ||
      lowerName.includes('luck point') ||
      lowerName === 'lucky points' ||
      lowerName === 'lucky'
    );
  });

  if (luckyResource) {
    debug.log(`🎖️ Found Lucky resource: ${luckyResource.name} (${luckyResource.current}/${luckyResource.max})`);
  } else {
    debug.log('🎖️ No Lucky resource found in character data');
  }

  return luckyResource;
}

function useLuckyPoint() {
  debug.log('🎖️ useLuckyPoint called');
  const luckyResource = getLuckyResource();
  debug.log('🎖️ Lucky resource found:', luckyResource);
  
  if (!luckyResource) {
    debug.error('❌ No Lucky resource found');
    return false;
  }
  
  if (luckyResource.current <= 0) {
    debug.error(`❌ No Lucky points available (current: ${luckyResource.current})`);
    return false;
  }

  // Decrement Lucky points
  const oldCurrent = luckyResource.current;
  luckyResource.current--;
  debug.log(`🎖️ Used Lucky point. ${oldCurrent} → ${luckyResource.current}/${luckyResource.max}`);
  
  // Save character data to preserve state when switching characters
  saveCharacterData();
  
  // Update display (resources section won't show Lucky anymore)
  buildResourcesDisplay();
  
  // Update Lucky button text
  updateLuckyButtonText();
  
  debug.log('🎖️ Lucky button updated and character data saved');
  
  return true;
}

function updateLuckyButtonText() {
  const luckyButton = document.querySelector('#lucky-action-button');
  if (luckyButton) {
    const luckyResource = getLuckyResource();
    const luckPointsAvailable = luckyResource ? luckyResource.current : 0;
    luckyButton.innerHTML = `
      <span style="font-size: 16px;">🎖️</span>
      <span>Use Lucky Point (${luckPointsAvailable}/3)</span>
    `;
    debug.log(`🎖️ Lucky button updated to show ${luckPointsAvailable}/3`);
  }
}

// ============================================================================
// WINDOW SIZE PERSISTENCE
// ============================================================================

/**
 * Save current window dimensions to storage
 */
function saveWindowSize() {
  const width = window.outerWidth;
  const height = window.outerHeight;
  
  browserAPI.storage.local.set({
    popupWindowSize: { width, height }
  });
  
  debug.log(`💾 Saved window size: ${width}x${height}`);
}

/**
 * Load and apply saved window dimensions
 */
async function loadWindowSize() {
  try {
    const result = await browserAPI.storage.local.get(['popupWindowSize']);
    if (result.popupWindowSize) {
      const { width, height } = result.popupWindowSize;
      window.resizeTo(width, height);
      debug.log(`📐 Restored window size: ${width}x${height}`);
    }
  } catch (error) {
    debug.warn('⚠️ Could not restore window size:', error);
  }
}

/**
 * Initialize window size tracking
 */
function initWindowSizeTracking() {
  // Load saved size on startup
  loadWindowSize();
  
  // Save size when window is resized
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      saveWindowSize();
    }, 500); // Debounce to avoid excessive saves
  });
  
  debug.log('📐 Window size tracking initialized');
}

// Initialize window size tracking when DOM is ready
if (domReady) {
  initWindowSizeTracking();
} else {
  pendingOperations.push(initWindowSizeTracking);
}

// ============================================================================
// CUSTOM ROLL MACROS
// ============================================================================

let customMacros = [];

/**
 * Load custom macros from storage
 */
async function loadCustomMacros() {
  try {
    const result = await browserAPI.storage.local.get(['customMacros']);
    customMacros = result.customMacros || [];
    debug.log(`🎲 Loaded ${customMacros.length} custom macros`);
    updateMacrosDisplay();
  } catch (error) {
    debug.error('❌ Failed to load custom macros:', error);
  }
}

/**
 * Save all custom macros to storage
 */
function saveAllCustomMacros() {
  browserAPI.storage.local.set({ customMacros });
  debug.log(`💾 Saved ${customMacros.length} custom macros`);
}

/**
 * Add a new custom macro
 */
function addCustomMacro(name, formula, description = '') {
  const macro = {
    id: Date.now().toString(),
    name,
    formula,
    description,
    createdAt: Date.now()
  };
  
  customMacros.push(macro);
  saveAllCustomMacros();
  updateMacrosDisplay();
  
  debug.log(`✅ Added custom macro: ${name} (${formula})`);
  return macro;
}

/**
 * Delete a custom macro
 */
function deleteCustomMacro(macroId) {
  customMacros = customMacros.filter(m => m.id !== macroId);
  saveAllCustomMacros();
  updateMacrosDisplay();
  debug.log(`🗑️ Deleted macro: ${macroId}`);
}

/**
 * Execute a custom macro (roll the formula)
 */
function executeMacro(macro) {
  debug.log(`🎲 Executing macro: ${macro.name} (${macro.formula})`);
  
  // Use the existing roll announcement system
  announceAction(
    macro.name,
    macro.formula,
    '',
    macro.description || `Custom macro: ${macro.formula}`
  );
}

/**
 * Update the macros display in the UI
 */
function updateMacrosDisplay() {
  const container = document.getElementById('custom-macros-container');
  if (!container) return;
  
  if (customMacros.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No custom macros yet. Click "Add Macro" to create one.</p>';
    return;
  }
  
  container.innerHTML = customMacros.map(macro => `
    <div class="macro-item" style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    ">
      <div style="flex: 1;">
        <div style="font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
          ${macro.name}
        </div>
        <div style="font-family: monospace; color: var(--accent-info); font-size: 0.9em; margin-bottom: 4px;">
          ${macro.formula}
        </div>
        ${macro.description ? `<div style="font-size: 0.85em; color: var(--text-secondary);">${macro.description}</div>` : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="macro-roll-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        ">
          🎲 Roll
        </button>
        <button class="macro-delete-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        ">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  container.querySelectorAll('.macro-roll-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro) executeMacro(macro);
    });
  });
  
  container.querySelectorAll('.macro-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro && confirm(`Delete macro "${macro.name}"?`)) {
        deleteCustomMacro(macroId);
      }
    });
  });
}

/**
 * Show settings modal with tabs
 */
function showSettingsModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('settings-modal');
  if (existingModal) {
    document.body.removeChild(existingModal);
  }
  
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <!-- Header -->
      <div style="
        padding: 20px;
        border-bottom: 2px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: var(--text-primary);">⚙️ Settings</h3>
        <button id="settings-close-btn" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">✕</button>
      </div>
      
      <!-- Tabs -->
      <div style="
        display: flex;
        border-bottom: 2px solid var(--border-color);
        background: var(--bg-tertiary);
      ">
        <button class="settings-tab active" data-tab="theme" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">🎨 Theme</button>
        <button class="settings-tab" data-tab="macros" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">🎲 Custom Macros</button>
        <button class="settings-tab" data-tab="gm" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">👑 GM Integration</button>
      </div>
      
      <!-- Content -->
      <div style="
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      ">
        <!-- Theme Tab -->
        <div id="theme-tab-content" class="settings-tab-content">
          <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Choose Theme</h4>
          <div style="display: flex; gap: 15px; margin-bottom: 20px;">
            <button class="theme-option" data-theme="light" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--border-color);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">☀️</span>
              <span style="font-weight: bold; color: var(--text-primary);">Light</span>
            </button>
            <button class="theme-option" data-theme="dark" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--border-color);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">🌙</span>
              <span style="font-weight: bold; color: var(--text-primary);">Dark</span>
            </button>
            <button class="theme-option active" data-theme="system" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--accent-primary);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">💻</span>
              <span style="font-weight: bold; color: var(--text-primary);">System</span>
            </button>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.9em; margin: 0;">
            System theme automatically matches your operating system's appearance settings.
          </p>
        </div>
        
        <!-- Macros Tab -->
        <div id="macros-tab-content" class="settings-tab-content" style="display: none;">
          <!-- Setting: Show gear buttons on spells -->
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="show-macro-buttons-setting" style="width: 18px; height: 18px;" ${showCustomMacroButtons ? 'checked' : ''}>
              <span style="color: var(--text-primary); font-weight: bold;">Show ⚙️ macro buttons on spells</span>
            </label>
            <p style="margin: 8px 0 0 28px; color: var(--text-secondary); font-size: 0.85em;">
              When enabled, shows a gear button on each spell to configure custom Roll20 macros.
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0; color: var(--text-primary);">Your Custom Macros</h4>
            <button id="add-macro-btn-settings" style="
              padding: 8px 16px;
              background: var(--accent-primary);
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">➕ Add Macro</button>
          </div>
          <div id="custom-macros-container-settings"></div>
        </div>
        
        <!-- GM Integration Tab -->
        <div id="gm-tab-content" class="settings-tab-content" style="display: none;">
          <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">👑 GM Integration</h4>

          <!-- DiceCloud Sync Section -->
          <div id="dicecloud-sync-section" style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px; display: none;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">🔄 DiceCloud Sync</h5>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 0.9em;">
              Manually sync all character data to DiceCloud. This updates HP, spell slots, Channel Divinity, class resources, and all other tracked values.
            </p>
            <button id="manual-sync-btn" style="
              background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 1em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              width: 100%;
            ">
              🔄 Sync to DiceCloud Now
            </button>
            <div id="sync-status" style="margin-top: 10px; padding: 8px; border-radius: 6px; font-size: 0.9em; display: none;"></div>
          </div>

          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">Share Character with GM</h5>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 0.9em;">
              Share your complete character sheet with the Game Master. This sends all your character data including abilities, skills, actions, spells, and equipment.
            </p>
            <button id="show-to-gm-btn" class="show-to-gm-btn" style="
              background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 1em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              width: 100%;
            ">
              👑 Share Character with GM
            </button>
          </div>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">How It Works</h5>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 0.9em;">
              <li>Click the button above to share your character</li>
              <li>Your character data appears in the Roll20 chat</li>
              <li>The GM receives your complete character sheet</li>
              <li>GM can view your stats, actions, and spells</li>
              <li>Helps GM track party composition and abilities</li>
            </ul>
          </div>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">Privacy Note</h5>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9em;">
              Only share character data when requested by your GM. The shared data includes your complete character sheet for game management purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set up tab switching
  modal.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tab buttons
      modal.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = 'var(--text-secondary)';
        t.style.background = 'transparent';
      });
      tab.classList.add('active');
      tab.style.color = 'var(--text-primary)';
      tab.style.background = 'var(--bg-secondary)';
      
      // Update content
      modal.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      modal.querySelector(`#${tabName}-tab-content`).style.display = 'block';
    });
  });
  
  // Set up theme options
  const currentTheme = ThemeManager.getCurrentTheme();
  modal.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === currentTheme) {
      option.style.borderColor = 'var(--accent-primary)';
      option.classList.add('active');
    }
    
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      ThemeManager.setTheme(theme);
      
      // Update active state
      modal.querySelectorAll('.theme-option').forEach(opt => {
        opt.style.borderColor = 'var(--border-color)';
        opt.classList.remove('active');
      });
      option.style.borderColor = 'var(--accent-primary)';
      option.classList.add('active');
    });
  });
  
  // Load macros into settings
  updateMacrosDisplayInSettings();
  
  // Initialize Show to GM button in settings
  initShowToGM();

  // Initialize manual DiceCloud sync button (experimental builds only)
  initManualSyncButton();

  // Set up add macro button
  modal.querySelector('#add-macro-btn-settings').addEventListener('click', () => {
    showAddMacroModal();
  });

  // Set up show macro buttons checkbox
  const macroButtonsCheckbox = modal.querySelector('#show-macro-buttons-setting');
  if (macroButtonsCheckbox) {
    macroButtonsCheckbox.addEventListener('change', (e) => {
      showCustomMacroButtons = e.target.checked;
      localStorage.setItem('showCustomMacroButtons', showCustomMacroButtons ? 'true' : 'false');
      debug.log(`⚙️ Custom macro buttons ${showCustomMacroButtons ? 'enabled' : 'disabled'}`);
      // Rebuild spells to show/hide gear buttons
      rebuildSpells();
    });
  }

  // Close button
  modal.querySelector('#settings-close-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Show add macro modal (simplified version for settings)
 */
function showAddMacroModal() {
  const modal = document.createElement('div');
  modal.id = 'add-macro-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  modal.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary);">🎲 Add Custom Macro</h3>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Macro Name
        </label>
        <input type="text" id="macro-name-input" placeholder="e.g., Sneak Attack" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Roll Formula
        </label>
        <input type="text" id="macro-formula-input" placeholder="e.g., 3d6" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          font-family: monospace;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
        <small style="color: var(--text-secondary); font-size: 0.85em;">
          Examples: 1d20+5, 2d6+3, 8d6, 1d20+dexterity.modifier
        </small>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Description (optional)
        </label>
        <input type="text" id="macro-description-input" placeholder="e.g., Extra damage on hit" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="macro-cancel-btn" style="
          padding: 10px 20px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 2px solid var(--border-color);
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">
          Cancel
        </button>
        <button id="macro-save-btn" style="
          padding: 10px 20px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">
          Save Macro
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('macro-name-input').focus();
  
  document.getElementById('macro-cancel-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.getElementById('macro-save-btn').addEventListener('click', () => {
    const name = document.getElementById('macro-name-input').value.trim();
    const formula = document.getElementById('macro-formula-input').value.trim();
    const description = document.getElementById('macro-description-input').value.trim();
    
    if (!name || !formula) {
      alert('Please enter both a name and formula for the macro.');
      return;
    }
    
    addCustomMacro(name, formula, description);
    document.body.removeChild(modal);
    updateMacrosDisplayInSettings();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Update macros display in settings modal
 */
function updateMacrosDisplayInSettings() {
  const container = document.getElementById('custom-macros-container-settings');
  if (!container) return;
  
  if (customMacros.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No custom macros yet. Click "Add Macro" to create one.</p>';
    return;
  }
  
  container.innerHTML = customMacros.map(macro => `
    <div class="macro-item" style="
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    ">
      <div style="flex: 1;">
        <div style="font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
          ${macro.name}
        </div>
        <div style="font-family: monospace; color: var(--accent-info); font-size: 0.9em; margin-bottom: 4px;">
          ${macro.formula}
        </div>
        ${macro.description ? `<div style="font-size: 0.85em; color: var(--text-secondary);">${macro.description}</div>` : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="macro-roll-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        ">
          🎲 Roll
        </button>
        <button class="macro-delete-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        ">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.macro-roll-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro) {
        executeMacro(macro);
        // Close settings modal after rolling
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
          document.body.removeChild(settingsModal);
        }
      }
    });
  });
  
  container.querySelectorAll('.macro-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro && confirm(`Delete macro "${macro.name}"?`)) {
        deleteCustomMacro(macroId);
        updateMacrosDisplayInSettings();
      }
    });
  });
}

/**
 * Initialize custom macros system
 */
function initCustomMacros() {
  loadCustomMacros();

  // Load custom macro button setting (default: disabled)
  const savedSetting = localStorage.getItem('showCustomMacroButtons');
  showCustomMacroButtons = savedSetting === 'true';
  debug.log(`⚙️ Custom macro buttons setting: ${showCustomMacroButtons ? 'enabled' : 'disabled'}`);

  debug.log('🎲 Custom macros system initialized');
}

/**
 * Initialize settings button
 */
function initSettingsButton() {
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsModal);
    debug.log('⚙️ Settings button initialized');
  }
}

// Check if opened from GM panel and request character data
if (window.opener && !characterData) {
  // Request character data from parent window
  window.opener.postMessage({ action: 'requestCharacterData' }, '*');
  debug.log('📋 Requested character data from parent window');
}

// Initialize macros when DOM is ready
if (domReady) {
  initCustomMacros();
  initSettingsButton();
} else {
  pendingOperations.push(initCustomMacros);
  pendingOperations.push(initSettingsButton);
}
