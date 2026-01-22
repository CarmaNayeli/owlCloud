/**
 * DiceCloud Two-Way Sync Module
 *
 * Uses Meteor DDP to synchronize tracking values (uses, resources, HP, etc.)
 * back to DiceCloud character sheets.
 *
 * Based on DiceCloud's Meteor methods found in:
 * /app/imports/api/creature/creatureProperties/methods/
 */

class DiceCloudSync {
  constructor(ddpClient) {
    this.ddp = ddpClient;
    this.characterId = null;
    this.propertyCache = new Map(); // propertyName -> property _id
    this.enabled = false;
  }

  /**
   * Initialize sync for a character
   * @param {string} characterId - DiceCloud character ID
   */
  async initialize(characterId) {
    this.characterId = characterId;
    this.propertyCache.clear();

    // Subscribe to character data to get property IDs
    // This allows us to cache property _id values for faster updates
    console.log('[DiceCloud Sync] Initializing for character:', characterId);
    console.log('[DiceCloud Sync] DDP client status:', this.ddp.isConnected());

    try {
      // Connect to DDP if not already connected
      if (!this.ddp.isConnected()) {
        console.log('[DiceCloud Sync] Connecting to DDP...');
        await this.ddp.connect();
        console.log('[DiceCloud Sync] DDP connected successfully');
      }

      // Note: We'll need to fetch the full character data to build our cache
      // The DiceCloud API GET /creature/:id returns all properties
      await this.buildPropertyCache();
      this.enabled = true;
      console.log('[DiceCloud Sync] Initialized successfully');
      console.log('[DiceCloud Sync] Sync enabled:', this.enabled);
    } catch (error) {
      console.error('[DiceCloud Sync] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Build cache of property names to IDs
   */
  async buildPropertyCache() {
    console.log('[DiceCloud Sync] Building property cache...');
    
    // First, try to get the stored character data
    const result = await browserAPI.storage.local.get(['activeCharacterId', 'characterProfiles']);
    const { activeCharacterId, characterProfiles } = result;
    console.log('[DiceCloud Sync] Storage result:', { activeCharacterId, characterProfilesKeys: characterProfiles ? Object.keys(characterProfiles) : null });

    if (activeCharacterId && characterProfiles && characterProfiles[activeCharacterId]) {
      const characterData = characterProfiles[activeCharacterId];
      console.log('[DiceCloud Sync] Building cache from character data:', characterData.name);
      
      // Get the DiceCloud API token for fetching raw data
      const tokenResult = await browserAPI.storage.local.get(['diceCloudToken']);
      const { diceCloudToken } = tokenResult;
      
      if (diceCloudToken && characterData.id) {
        console.log('[DiceCloud Sync] Fetching raw DiceCloud API data for property cache...');
        try {
          // Route API request through background script to avoid CORS
          const response = await browserAPI.runtime.sendMessage({
            action: 'fetchDiceCloudAPI',
            url: `https://dicecloud.com/api/creature/${characterData.id}`,
            token: diceCloudToken
          });
          
          if (response.success && response.data) {
            const apiData = response.data;
            console.log('[DiceCloud Sync] Received API data for property cache');
            
            // Build cache from raw creatureProperties
            if (apiData.creatureProperties && Array.isArray(apiData.creatureProperties)) {
              console.log(`[DiceCloud Sync] Processing ${apiData.creatureProperties.length} raw properties`);
              for (const property of apiData.creatureProperties) {
                if (property._id && property.name) {
                  this.propertyCache.set(property.name, property._id);
                  console.log(`[DiceCloud Sync] Cached property: ${property.name} -> ${property._id}`);
                }
              }
            }
          } else {
            console.warn('[DiceCloud Sync] Failed to fetch API data for property cache:', response.error);
          }
        } catch (error) {
          console.error('[DiceCloud Sync] Error fetching API data for property cache:', error);
        }
      }
      
      // Also cache actions by name (fallback)
      if (characterData.actions && Array.isArray(characterData.actions)) {
        console.log(`[DiceCloud Sync] Processing ${characterData.actions.length} actions`);
        for (const action of characterData.actions) {
          if (action.name) {
            // Check if we already have this property in cache
            if (!this.propertyCache.has(action.name)) {
              // Try to find matching property in cached properties by name
              const propertyId = this.findPropertyId(action.name);
              if (propertyId) {
                this.propertyCache.set(action.name, propertyId);
                console.log(`[DiceCloud Sync] Cached action: ${action.name} -> ${propertyId}`);
              } else {
                console.warn(`[DiceCloud Sync] No property ID found for action: ${action.name}`);
              }
            }
          }
        }
      }

      console.log(`[DiceCloud Sync] Property cache built with ${this.propertyCache.size} entries`);
      console.log('[DiceCloud Sync] Available properties:', Array.from(this.propertyCache.keys()));
    } else {
      console.warn('[DiceCloud Sync] No character data available for cache building');
      console.warn('[DiceCloud Sync] activeCharacterId:', activeCharacterId);
      console.warn('[DiceCloud Sync] characterProfiles:', characterProfiles);
    }
  }

  /**
   * Increment action uses (e.g., used 1 of 3 uses)
   * @param {string} actionName - Name of the action
   * @param {number} amount - Amount to increment (usually 1)
   */
  async incrementActionUses(actionName, amount = 1) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(actionName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Property not found: ${actionName}`);
        return;
      }

      console.log(`[DiceCloud Sync] Incrementing uses for ${actionName} (${propertyId}) by ${amount}`);

      const result = await this.ddp.call('creatureProperties.update', {
        _id: propertyId,
        path: ['usesUsed'],
        value: amount // This should be the new total, not increment
      });

      console.log('[DiceCloud Sync] Uses incremented successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to increment uses:', error);
      throw error;
    }
  }

  /**
   * Set action uses to a specific value
   * @param {string} actionName - Name of the action
   * @param {number} value - New value for usesUsed
   */
  async setActionUses(actionName, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(actionName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Property not found: ${actionName}`);
        return;
      }

      console.log(`[DiceCloud Sync] Setting uses for ${actionName} (${propertyId}) to ${value}`);

      const result = await this.ddp.call('creatureProperties.update', {
        _id: propertyId,
        path: ['usesUsed'],
        value: value
      });

      console.log('[DiceCloud Sync] Uses set successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to set uses:', error);
      throw error;
    }
  }

  /**
   * Update attribute value (HP, Ki Points, Sorcery Points, etc.)
   * @param {string} attributeName - Name of the attribute
   * @param {number} value - New value
   */
  async updateAttributeValue(attributeName, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(attributeName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Property not found: ${attributeName}`);
        return;
      }

      console.log(`[DiceCloud Sync] Updating attribute ${attributeName} (${propertyId}) to ${value}`);

      const result = await this.ddp.call('creatureProperties.update', {
        _id: propertyId,
        path: ['value'],
        value: value
      });

      console.log('[DiceCloud Sync] Attribute updated successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to update attribute:', error);
      throw error;
    }
  }

  /**
   * Find property ID by name
   * @param {string} name - Property name
   * @returns {string|null} Property ID or null if not found
   */
  findPropertyId(name) {
    const propertyId = this.propertyCache.get(name);
    if (propertyId) {
      console.log(`[DiceCloud Sync] Found property ID for ${name}: ${propertyId}`);
      return propertyId;
    }
    
    console.warn(`[DiceCloud Sync] Property ID not found for: ${name}`);
    console.log('[DiceCloud Sync] Available properties:', Array.from(this.propertyCache.keys()));
    return null;
  }

  /**
   * Set up event listeners to sync Roll20 changes to DiceCloud
   */
  setupRoll20EventListeners() {
    console.log('[DiceCloud Sync] Setting up Roll20 event listeners...');
    
    // Listen for character data updates from popup
    window.addEventListener('message', (event) => {
      if (event.data.type === 'characterDataUpdate') {
        this.handleCharacterDataUpdate(event.data.characterData);
      }
    });

    // Listen for action usage updates
    window.addEventListener('message', (event) => {
      if (event.data.type === 'actionUsageUpdate') {
        this.handleActionUsageUpdate(event.data.actionName, event.data.usesUsed);
      }
    });

    // Listen for attribute updates
    window.addEventListener('message', (event) => {
      if (event.data.type === 'attributeUpdate') {
        this.handleAttributeUpdate(event.data.attributeName, event.data.value);
      }
    });

    console.log('[DiceCloud Sync] Roll20 event listeners set up');
  }

  /**
   * Handle character data updates from Roll20
   * @param {Object} characterData - Updated character data
   */
  async handleCharacterDataUpdate(characterData) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled, ignoring update');
      return;
    }

    console.log('[DiceCloud Sync] Handling character data update:', characterData.name);
    
    // Update HP if changed
    if (characterData.hp !== undefined) {
      await this.updateAttributeValue('Hit Points', characterData.hp);
    }

    // Update temporary HP if changed
    if (characterData.tempHp !== undefined) {
      await this.updateAttributeValue('Temporary Hit Points', characterData.tempHp);
    }

    // Update max HP if changed
    if (characterData.maxHp !== undefined) {
      await this.updateAttributeValue('Max Hit Points', characterData.maxHp);
    }
  }

  /**
   * Handle action usage updates from Roll20
   * @param {string} actionName - Name of the action
   * @param {number} usesUsed - New uses used value
   */
  async handleActionUsageUpdate(actionName, usesUsed) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled, ignoring action update');
      return;
    }

    console.log(`[DiceCloud Sync] Handling action usage update: ${actionName} -> ${usesUsed}`);
    await this.setActionUses(actionName, usesUsed);
  }

  /**
   * Handle attribute updates from Roll20
   * @param {string} attributeName - Name of the attribute
   * @param {number} value - New value
   */
  async handleAttributeUpdate(attributeName, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled, ignoring attribute update');
      return;
    }

    console.log(`[DiceCloud Sync] Handling attribute update: ${attributeName} -> ${value}`);
    await this.updateAttributeValue(attributeName, value);
  }

  /**
   * Check if sync is enabled
   * @returns {boolean} True if sync is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Disable sync
   */
  disable() {
    this.enabled = false;
    console.log('[DiceCloud Sync] Sync disabled');
  }

  /**
   * Enable sync
   */
  enable() {
    if (this.characterId && this.ddp.isConnected()) {
      this.enabled = true;
      console.log('[DiceCloud Sync] Sync enabled');
    } else {
      console.warn('[DiceCloud Sync] Cannot enable sync - not initialized');
    }
  }
}

// Global initialization function
window.initializeDiceCloudSync = async function() {
  console.log('[DiceCloud Sync] Global initialization called');
  console.log('[DiceCloud Sync] Current URL:', window.location.href);
  
  try {
    // Create DDP client
    console.log('[DiceCloud Sync] Creating DDP client...');
    const ddpClient = new DDPClient('wss://dicecloud.com/websocket');
    
    // Create sync instance
    const sync = new DiceCloudSync(ddpClient);
    window.diceCloudSync = sync;
    
    console.log('[DiceCloud Sync] Sync instance created, checking for active character...');
    
    // Try to initialize with active character
    const tryInitialize = async () => {
      try {
        console.log('[DiceCloud Sync] Trying to initialize...');
        
        // Check if browser API is available
        if (typeof browserAPI !== 'undefined') {
          console.log('[DiceCloud Sync] Browser API available, checking storage...');
          
          const result = await browserAPI.storage.local.get(['activeCharacterId', 'characterProfiles']);
          const { activeCharacterId, characterProfiles } = result;
          console.log('[DiceCloud Sync] Storage result:', { activeCharacterId, characterProfilesKeys: characterProfiles ? Object.keys(characterProfiles) : null });
          
          if (activeCharacterId && characterProfiles && characterProfiles[activeCharacterId]) {
            const characterData = characterProfiles[activeCharacterId];
            console.log('[DiceCloud Sync] Character data for key:', activeCharacterId, characterData);
            
            // Check if we have character profiles and find the DiceCloud character ID
            if (characterProfiles && typeof characterProfiles === 'object') {
              console.log('[DiceCloud Sync] Checking characterProfiles object:', Object.keys(characterProfiles));
              
              // Find the character data in characterProfiles
              const profileData = characterProfiles[activeCharacterId] || characterProfiles.default || characterProfiles['slot-1'];
              if (profileData && profileData.id) {
                console.log('[DiceCloud Sync] Found character data in characterProfiles:', profileData);
                console.log('[DiceCloud Sync] Found DiceCloud character ID:', profileData.id);
                
                // Initialize sync with the character ID
                await sync.initialize(profileData.id);
                
                // Set up event listeners
                sync.setupRoll20EventListeners();
                console.log('[DiceCloud Sync] Event listeners set up');
                
                console.log('[DiceCloud Sync] Global initialization complete');
                return;
              }
            }
          } else {
            console.warn('[DiceCloud Sync] No active character found in storage');
            console.log('[DiceCloud Sync] All storage keys:', Object.keys(result));
            console.log('[DiceCloud Sync] All storage data:', result);
          }
        } else {
          console.warn('[DiceCloud Sync] Browser API not available');
        }
        
        // Retry after delay if no character found
        console.log('[DiceCloud Sync] Retrying in 2 seconds...');
        setTimeout(tryInitialize, 2000);
      } catch (error) {
        console.error('[DiceCloud Sync] Error during initialization:', error);
        console.log('[DiceCloud Sync] Retrying in 5 seconds...');
        setTimeout(tryInitialize, 5000);
      }
    };
    
    // Start initialization
    tryInitialize();
    
  } catch (error) {
    console.error('[DiceCloud Sync] Failed to create sync instance:', error);
  }
};

// Auto-initialize if we're on Roll20
if (window.location.hostname === 'app.roll20.net') {
  console.log('[DiceCloud Sync] Detected Roll20, initializing sync...');
  // Wait a bit for page to load
  setTimeout(() => {
    window.initializeDiceCloudSync();
  }, 1000);
}
