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

    try {
      // Get character data from extension storage
      if (typeof browserAPI !== 'undefined' && browserAPI.storage) {
        const result = await browserAPI.storage.local.get(['activeCharacterId', 'characterProfiles']);
        const activeCharacterId = result.activeCharacterId;
        const characterProfiles = result.characterProfiles;

        console.log('[DiceCloud Sync] Storage result:', { activeCharacterId, characterProfilesKeys: characterProfiles ? Object.keys(characterProfiles) : null });

        if (activeCharacterId && characterProfiles && characterProfiles[activeCharacterId]) {
          const characterData = characterProfiles[activeCharacterId];
          console.log('[DiceCloud Sync] Building cache from character data:', characterData.name);

          // Build cache from character properties
          if (characterData.properties && Array.isArray(characterData.properties)) {
            console.log(`[DiceCloud Sync] Processing ${characterData.properties.length} properties`);
            for (const property of characterData.properties) {
              if (property._id && property.name) {
                this.propertyCache.set(property.name, property._id);
                console.log(`[DiceCloud Sync] Cached property: ${property.name} -> ${property._id}`);
              }
            }
          }

          // Also cache actions by name
          if (characterData.actions && Array.isArray(characterData.actions)) {
            console.log(`[DiceCloud Sync] Processing ${characterData.actions.length} actions`);
            console.log('[DiceCloud Sync] Sample action structure:', characterData.actions[0]);
            for (const action of characterData.actions) {
              // Actions might not have _id, so use name as key
              if (action.name) {
                // Try to find matching property in characterProperties by name
                const matchingProperty = characterData.properties && characterData.properties.find(prop => 
                  prop.name === action.name || 
                  prop.variableName === action.name
                );
                const propertyId = matchingProperty ? matchingProperty._id : action._id;
                
                if (propertyId) {
                  this.propertyCache.set(action.name, propertyId);
                  console.log(`[DiceCloud Sync] Cached action: ${action.name} -> ${propertyId}`);
                } else {
                  console.warn(`[DiceCloud Sync] No property ID found for action: ${action.name}`);
                }
              }
            }
          }

          // Cache common attributes
          const commonAttributes = [
            { name: 'Hit Points', key: 'hitPoints' },
            { name: 'Temporary Hit Points', key: 'tempHP' },
            { name: 'Focus Points', key: 'focusPoint' },
            { name: 'Heroic Inspiration', key: 'heroicInspiration' }
          ];

          for (const attr of commonAttributes) {
            if (characterData[attr.key]) {
              // Look for matching property in characterProperties
              if (characterData.properties) {
                const matchingProperty = characterData.properties.find(prop => 
                  prop.variableName === attr.key || 
                  prop.name === attr.name ||
                  prop.type === 'attribute'
                );
                if (matchingProperty && matchingProperty._id) {
                  this.propertyCache.set(attr.name, matchingProperty._id);
                  console.log(`[DiceCloud Sync] Cached attribute: ${attr.name} -> ${matchingProperty._id}`);
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
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to build property cache:', error);
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

    // Update other attributes as needed
    // This is a basic implementation - can be expanded
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
   * Update property field (generic update method)
   * @param {string} propertyId - DiceCloud property _id
   * @param {string[]} path - Field path (e.g., ['damage'], ['usesUsed'])
   * @param {any} value - New value
   */
  async updateProperty(propertyId, path, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Updating property ${propertyId} at path ${path.join('.')} to`, value);

      const result = await this.ddp.call('creatureProperties.update', {
        _id: propertyId,
        path: path,
        value: value
      });

      console.log('[DiceCloud Sync] Property updated successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to update property:', error);
      throw error;
    }
  }

  /**
   * Adjust item quantity (for consumables, ammo, etc.)
   * @param {string} itemName - Name of the item
   * @param {number} amount - Amount to increment/decrement
   */
  async adjustQuantity(itemName, amount) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(itemName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Property not found: ${itemName}`);
        return;
      }

      console.log(`[DiceCloud Sync] Adjusting quantity for ${itemName} (${propertyId}) by ${amount}`);

      const result = await this.ddp.call('creatureProperties.adjustQuantity', {
        _id: propertyId,
        operation: 'increment',
        value: amount
      });

      console.log('[DiceCloud Sync] Quantity adjusted successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to adjust quantity:', error);
      throw error;
    }
  }

  /**
   * Set item quantity to a specific value
   * @param {string} itemName - Name of the item
   * @param {number} value - New quantity value
   */
  async setQuantity(itemName, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(itemName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Property not found: ${itemName}`);
        return;
      }

      console.log(`[DiceCloud Sync] Setting quantity for ${itemName} (${propertyId}) to ${value}`);

      const result = await this.ddp.call('creatureProperties.adjustQuantity', {
        _id: propertyId,
        operation: 'set',
        value: value
      });

      console.log('[DiceCloud Sync] Quantity set successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to set quantity:', error);
      throw error;
    }
  }

  /**
   * Enable/disable sync
   * @param {boolean} enabled - Whether sync should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`[DiceCloud Sync] Sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if sync is enabled
   * @returns {boolean} Whether sync is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiceCloudSync;
}

// Global initialization function for browser extension
window.initializeDiceCloudSync = function() {
  console.log('[DiceCloud Sync] Global initialization called');
  console.log('[DiceCloud Sync] Current URL:', window.location.href);
  
  // Check if we have a DDP client available
  if (typeof window.DDPClient === 'undefined') {
    console.error('[DiceCloud Sync] DDP client not available');
    return;
  }
  
  console.log('[DiceCloud Sync] Creating DDP client...');
  
  // Create sync instance
  const ddpClient = new window.DDPClient('wss://dicecloud.com/websocket');
  window.diceCloudSync = new DiceCloudSync(ddpClient);
  
  console.log('[DiceCloud Sync] Sync instance created, checking for active character...');
  
  // Function to try initialization
  const tryInitialize = async () => {
    console.log('[DiceCloud Sync] Trying to initialize...');
    
    // Try to get current character ID from extension storage
    if (typeof browserAPI !== 'undefined' && browserAPI.storage) {
      console.log('[DiceCloud Sync] Browser API available, checking storage...');
      
      try {
        const result = await browserAPI.storage.local.get(['activeCharacterId']);
        console.log('[DiceCloud Sync] Storage result:', result);
        
        if (result.activeCharacterId) {
          console.log('[DiceCloud Sync] Found active character ID:', result.activeCharacterId);
          
          // Debug: List all keys in storage
          try {
            const allKeys = await browserAPI.storage.local.get(null);
            console.log('[DiceCloud Sync] All storage keys:', Object.keys(allKeys));
            console.log('[DiceCloud Sync] All storage data:', allKeys);
          } catch (allKeysError) {
            console.error('[DiceCloud Sync] Error getting all storage keys:', allKeysError);
          }
          
          // Also get the character data to get the DiceCloud ID
          try {
            const charResult = await browserAPI.storage.local.get([result.activeCharacterId, 'characterProfiles']);
            console.log('[DiceCloud Sync] Character data for key:', result.activeCharacterId, charResult);
            
            let characterData = charResult[result.activeCharacterId];
            
            // If not found in slot key, check characterProfiles
            if (!characterData && charResult.characterProfiles) {
              console.log('[DiceCloud Sync] Checking characterProfiles object:', charResult.characterProfiles);
              characterData = charResult.characterProfiles[result.activeCharacterId];
              console.log('[DiceCloud Sync] Found character data in characterProfiles:', characterData);
            }
            
            if (characterData && characterData.id) {
              console.log('[DiceCloud Sync] Found DiceCloud character ID:', characterData.id);
              await window.diceCloudSync.initialize(characterData.id);
              
              // Set up event listeners after successful initialization
              window.diceCloudSync.setupRoll20EventListeners();
              console.log('[DiceCloud Sync] Event listeners set up');
            } else {
              console.warn('[DiceCloud Sync] No character data found for slot:', result.activeCharacterId);
              
              // Try to find character data in other common keys
              const commonKeys = ['slot-1', 'slot-2', 'slot-3', 'default'];
              for (const key of commonKeys) {
                if (key !== result.activeCharacterId) {
                  const testResult = await browserAPI.storage.local.get([key]);
                  if (testResult[key] && testResult[key].id) {
                    console.log(`[DiceCloud Sync] Found character data in key: ${key}`, testResult[key]);
                    // Use this character data instead
                    window.diceCloudSync.initialize(testResult[key].id).catch(error => {
                      console.error('[DiceCloud Sync] Failed to initialize with fallback key:', error);
                    });
                    return;
                  }
                }
              }
              
              // Also check characterProfiles for any character data
              if (charResult.characterProfiles) {
                console.log('[DiceCloud Sync] Checking all characterProfiles for character data...');
                for (const [profileKey, profileData] of Object.entries(charResult.characterProfiles)) {
                  if (profileData && profileData.id) {
                    console.log(`[DiceCloud Sync] Found character data in characterProfiles.${profileKey}:`, profileData);
                    window.diceCloudSync.initialize(profileData.id).catch(error => {
                      console.error('[DiceCloud Sync] Failed to initialize with characterProfiles fallback:', error);
                    });
                    return;
                  }
                }
              }
            }
          } catch (charError) {
            console.error('[DiceCloud Sync] Error getting character data:', charError);
          }
        } else {
          console.log('[DiceCloud Sync] No active character ID found, will retry...');
        }
      } catch (error) {
        console.error('[DiceCloud Sync] Error accessing storage:', error);
      }
    } else {
      console.log('[DiceCloud Sync] Browser storage not available, waiting for manual initialization');
      console.log('[DiceCloud Sync] browserAPI type:', typeof browserAPI);
      console.log('[DiceCloud Sync] browserAPI.storage type:', typeof browserAPI?.storage);
    }
  };
  
  // Try immediately
  tryInitialize();
  
  // Also set up a retry mechanism in case character data loads later
  let retryCount = 0;
  const retryInterval = setInterval(async () => {
    retryCount++;
    console.log(`[DiceCloud Sync] Retry attempt ${retryCount} to find character data...`);
    
    if (typeof browserAPI !== 'undefined' && browserAPI.storage) {
      try {
        const result = await browserAPI.storage.local.get(['activeCharacterId']);
        console.log(`[DiceCloud Sync] Retry ${retryCount} storage result:`, result);
        
        if (result.activeCharacterId) {
          console.log('[DiceCloud Sync] Found active character ID on retry:', result.activeCharacterId);
          clearInterval(retryInterval);
          
          // Get character data and initialize
          try {
            const charResult = await browserAPI.storage.local.get([result.activeCharacterId]);
            console.log('[DiceCloud Sync] Retry character data:', charResult);
            
            const characterData = charResult[result.activeCharacterId];
            if (characterData && characterData.id) {
              console.log('[DiceCloud Sync] Found DiceCloud character ID on retry:', characterData.id);
              await window.diceCloudSync.initialize(characterData.id);
              
              // Set up event listeners after successful initialization
              window.diceCloudSync.setupRoll20EventListeners();
              console.log('[DiceCloud Sync] Event listeners set up on retry');
            }
          } catch (charError) {
            console.error('[DiceCloud Sync] Retry error getting character data:', charError);
          }
        } else if (retryCount >= 10) {
          console.log('[DiceCloud Sync] Max retries reached, stopping retry attempts');
          clearInterval(retryInterval);
        }
      } catch (error) {
        console.error(`[DiceCloud Sync] Retry ${retryCount} error accessing storage:`, error);
      }
    } else {
      console.log(`[DiceCloud Sync] Browser API not available on retry ${retryCount}`);
    }
  }, 2000); // Check every 2 seconds
  
  console.log('[DiceCloud Sync] Global initialization complete');
};
