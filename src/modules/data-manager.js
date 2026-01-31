/**
 * Character Data Manager Module
 *
 * Handles loading, saving, and syncing character data.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - saveCharacterData()
 * - sendSyncMessage()
 * - loadCharacterWithTabs()
 * - loadAndBuildTabs()
 * - getActiveCharacterId()
 * - setActiveCharacter(characterId)
 * - buildCharacterTabs(profiles, activeCharacterId)
 * - validateCharacterData(data)
 *
 * State variables:
 * - currentSlotId
 * - syncDebounceTimer
 * - characterCache
 */

(function() {
  'use strict';

  // ===== STATE VARIABLES =====

  let currentSlotId = null;
  let syncDebounceTimer = null;
  const characterCache = new Map();

  // ===== CHARACTER DATA FUNCTIONS =====

  /**
   * Save character data to browser storage and trigger sync
   */
  function saveCharacterData() {
    // Requires characterData to be available from global scope
    if (typeof characterData === 'undefined' || !characterData) {
      debug.warn('⚠️ No character data to save');
      return;
    }

    // CRITICAL: Save to browser storage to persist through refresh/close
    if (typeof browserAPI !== 'undefined') {
      browserAPI.runtime.sendMessage({
        action: 'storeCharacterData',
        data: characterData,
        slotId: currentSlotId  // CRITICAL: Pass slotId for proper persistence
      }).then(() => {
        debug.log(`💾 Saved character data to browser storage (slotId: ${currentSlotId})`);
      }).catch(err => {
        debug.error('❌ Failed to save character data:', err);
      });
    }

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

  /**
   * Send sync message to DiceCloud
   */
  function sendSyncMessage() {
    // Requires characterData to be available from global scope
    if (typeof characterData === 'undefined' || !characterData) {
      debug.warn('⚠️ No character data to sync');
      return;
    }

    // Send sync message to DiceCloud if experimental sync is available
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

    // Try to send to DiceCloud sync
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

      // TODO: Add Owlbear Rodeo integration for GM Panel player data tracking
    }
  }

  /**
   * Validate character data has required fields
   */
  function validateCharacterData(data) {
    if (!data) return { valid: false, missing: ['all data'] };

    const hasSpells = Array.isArray(data.spells);
    const hasActions = Array.isArray(data.actions);

    if (!hasSpells || !hasActions) {
      const missing = [];
      if (!hasSpells) missing.push('spells');
      if (!hasActions) missing.push('actions');
      return { valid: false, missing };
    }

    return { valid: true, missing: [] };
  }

  /**
   * Get the active character ID from storage
   */
  async function getActiveCharacterId() {
    if (typeof browserAPI === 'undefined') {
      debug.warn('⚠️ browserAPI not available');
      return null;
    }

    // Use Promise-based API (works in both Chrome and Firefox with our polyfill)
    const result = await browserAPI.storage.local.get(['activeCharacterId']);
    return result.activeCharacterId || null;
  }

  /**
   * Set the active character ID in storage
   */
  async function setActiveCharacter(characterId) {
    if (typeof browserAPI === 'undefined') {
      debug.warn('⚠️ browserAPI not available');
      return;
    }

    try {
      await browserAPI.storage.local.set({
        activeCharacterId: characterId
      });
      console.log(`✅ Set active character: ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to set active character:', error);
    }
  }

  /**
   * Load profiles and build tabs (without building sheet)
   */
  async function loadAndBuildTabs() {
    if (typeof browserAPI === 'undefined') {
      debug.warn('⚠️ browserAPI not available');
      return;
    }

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

  /**
   * Load character data and build tabs
   */
  async function loadCharacterWithTabs() {
    if (typeof browserAPI === 'undefined') {
      debug.warn('⚠️ browserAPI not available');
      return;
    }

    // Check if DOM is ready (domReady should be available from global scope)
    if (typeof domReady !== 'undefined' && !domReady) {
      debug.log('⏳ DOM not ready, queuing loadCharacterWithTabs...');
      if (typeof pendingOperations !== 'undefined') {
        pendingOperations.push(loadCharacterWithTabs);
      }
      return;
    }

    try {
      // Build tabs first
      await loadAndBuildTabs();

      // Get and store current slot ID for persistence
      currentSlotId = await getActiveCharacterId();
      debug.log('📋 Current slot ID set to:', currentSlotId);

      // Get active character data
      let activeCharacter = null;

      // Check if this is a database character
      if (currentSlotId && currentSlotId.startsWith('db-')) {
        // Load from database
        const characterId = currentSlotId.replace('db-', '');
        try {
          const dbResponse = await browserAPI.runtime.sendMessage({
            action: 'getCharacterDataFromDatabase',
            characterId: characterId
          });
          if (dbResponse.success) {
            activeCharacter = dbResponse.data;
            debug.log('✅ Loaded character from database:', activeCharacter.name);
          }
        } catch (dbError) {
          debug.warn('⚠️ Failed to load database character:', dbError);
        }
      } else {
        // Load from local storage
        const activeResponse = await browserAPI.runtime.sendMessage({ action: 'getCharacterData' });
        activeCharacter = activeResponse.success ? activeResponse.data : null;
      }

      // Load active character
      if (activeCharacter) {
        // Validate character data
        const validation = validateCharacterData(activeCharacter);

        if (!validation.valid) {
          debug.warn('⚠️ Character data is incomplete or outdated');
          debug.warn(`Missing data: ${validation.missing.join(', ')}`);

          // Show error message to user
          const characterName = activeCharacter.name || activeCharacter.character_name || 'this character';

          const errorContainer = document.getElementById('main-content');
          if (errorContainer) {
            errorContainer.innerHTML = `
              <div style="padding: 40px; text-align: center; color: var(--text-primary);">
                <h2 style="color: #e74c3c; margin-bottom: 20px;">⚠️ Incomplete Character Data</h2>
                <p style="margin-bottom: 15px; font-size: 1.1em;">
                  The character data for <strong>${characterName}</strong> is missing ${validation.missing.join(' and ')}.
                </p>
                <p style="margin-bottom: 15px; color: var(--text-secondary);">
                  This usually happens when loading old cloud data that was saved before spells and actions were synced.
                </p>
                <div style="background: #2c3e50; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin-bottom: 10px; font-weight: bold;">To fix this:</p>
                  <ol style="text-align: left; max-width: 500px; margin: 0 auto; line-height: 1.8;">
                    <li>Go to your character on <a href="https://dicecloud.com" target="_blank" style="color: #3498db;">DiceCloud.com</a></li>
                    <li>Click the <strong>"Sync to Extension"</strong> button on the character page</li>
                    <li>Wait for the sync to complete</li>
                    <li>Reopen this character sheet</li>
                  </ol>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.9em;">
                  Character ID: ${activeCharacter.id || activeCharacter.dicecloud_character_id || 'unknown'}
                </p>
              </div>
            `;
          }

          // Don't continue loading the incomplete character
          return;
        }

        // Set global characterData
        if (typeof globalThis.characterData !== 'undefined') {
          globalThis.characterData = activeCharacter;
        }

        // Build sheet (buildSheet should be available from global scope)
        if (typeof buildSheet !== 'undefined') {
          buildSheet(activeCharacter);
        }

        // Initialize racial traits, feat traits, class features
        if (typeof initRacialTraits !== 'undefined') initRacialTraits();
        if (typeof initFeatTraits !== 'undefined') initFeatTraits();
        if (typeof initClassFeatures !== 'undefined') initClassFeatures();
      } else {
        debug.error('❌ No character data found');
      }
    } catch (error) {
      debug.error('❌ Failed to load characters:', error);
    }
  }

  /**
   * Build character tabs UI
   */
  function buildCharacterTabs(profiles, activeCharacterId) {
    const tabsContainer = document.getElementById('character-tabs');
    if (!tabsContainer) {
      debug.warn('⚠️ character-tabs container not found!');
      return;
    }

    debug.log(`🏷️ Building character tabs. Active: ${activeCharacterId}`);
    debug.log(`📋 Profiles:`, Object.keys(profiles));

    tabsContainer.innerHTML = '';
    const maxSlots = 10; // Support up to 10 character slots

    // First, add database characters. Include both:
    // 1. Keys starting with `db-` (direct database characters)
    // 2. Characters with source='database' or hasCloudVersion=true (local profiles with cloud sync)
    const databaseCharacters = Object.entries(profiles).filter(([slotId, profile]) =>
      slotId.startsWith('db-') ||
      profile.source === 'database' ||
      profile.hasCloudVersion === true
    );

    // Add database character tabs
    databaseCharacters.forEach(([slotId, charInSlot], index) => {
      const isActive = slotId === activeCharacterId;

      const displayName = charInSlot.name || charInSlot.character_name || (charInSlot._fullData && (charInSlot._fullData.character_name || charInSlot._fullData.name)) || 'Unknown';
      debug.log(`🌐 DB Character: ${displayName} (active: ${isActive})`);

      const tab = document.createElement('div');
      tab.className = 'character-tab database-tab';
      if (isActive) {
        tab.classList.add('active');
      }
      tab.dataset.slotId = slotId;

      // Create special styling for database characters
      tab.innerHTML = `
        <span class="slot-number">🌐</span>
        <span class="char-name">${displayName}</span>
        <span class="char-details">${charInSlot.level || 1} ${charInSlot.class || 'Unknown'}</span>
      `;

      // Add click handler
      tab.addEventListener('click', (e) => {
        debug.log(`🖱️ Database tab clicked for ${slotId}`, charInSlot.name);
        if (typeof switchToCharacter === 'function') {
          switchToCharacter(slotId);
        }
      });

      tabsContainer.appendChild(tab);
    });

    // Add separator if we have both database and local characters
    if (databaseCharacters.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'tab-separator';
      separator.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.8em;">Local Characters</span>';
      tabsContainer.appendChild(separator);
    }

    // Create tabs for local slots (skip characters already shown in database section)
    for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
      const slotId = `slot-${slotNum}`;
      // Find character in this slot using slotId as key
      const charInSlot = profiles[slotId];

      // Skip if this character was already shown in the database section
      if (charInSlot && (charInSlot.source === 'database' || charInSlot.hasCloudVersion === true)) {
        debug.log(`  ⏭️ Slot ${slotNum}: ${charInSlot.name} (skipped - shown in cloud section)`);
        continue;
      }

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
            if (typeof switchToCharacter === 'function') {
              switchToCharacter(slotId);
            }
          }
        });

        // Close button - show options modal
        const closeBtn = tab.querySelector('.close-tab');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof showClearCharacterOptions === 'function') {
            showClearCharacterOptions(slotId, slotNum, charInSlot.name);
          }
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

  // ===== EXPORTS =====

  globalThis.saveCharacterData = saveCharacterData;
  globalThis.sendSyncMessage = sendSyncMessage;
  globalThis.loadCharacterWithTabs = loadCharacterWithTabs;
  globalThis.loadAndBuildTabs = loadAndBuildTabs;
  globalThis.getActiveCharacterId = getActiveCharacterId;
  globalThis.setActiveCharacter = setActiveCharacter;
  globalThis.buildCharacterTabs = buildCharacterTabs;
  globalThis.validateCharacterData = validateCharacterData;

  // Export state variables with getters and setters
  Object.defineProperty(globalThis, 'currentSlotId', {
    get: () => currentSlotId,
    set: (value) => { currentSlotId = value; }
  });

  Object.defineProperty(globalThis, 'syncDebounceTimer', {
    get: () => syncDebounceTimer,
    set: (value) => { syncDebounceTimer = value; }
  });

  Object.defineProperty(globalThis, 'characterCache', {
    get: () => characterCache
  });

})();
