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
    // We'll fetch this data from the extension's stored character data
    // since we already have it from the sync
    console.log('[DiceCloud Sync] Building property cache...');

    // This will be populated when we integrate with the actual extension
    // For now, we'll use a placeholder that can be populated later
  }

  /**
   * Increment action uses (e.g., used 1 of 3 uses)
   * @param {string} actionName - Name of the action
   * @param {string} propertyId - DiceCloud property _id
   * @param {number} amount - Amount to increment (usually 1)
   */
  async incrementActionUses(propertyId, amount = 1) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Incrementing uses for property ${propertyId} by ${amount}`);

      // Use updateCreatureProperty to set usesUsed
      // path: ['usesUsed'], value: currentUsesUsed + amount
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
   * @param {string} propertyId - DiceCloud property _id
   * @param {number} value - New value for usesUsed
   */
  async setActionUses(propertyId, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Setting uses for property ${propertyId} to ${value}`);

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
   * Adjust item quantity (for consumables, ammo, etc.)
   * @param {string} propertyId - DiceCloud property _id
   * @param {number} amount - Amount to increment/decrement
   */
  async adjustQuantity(propertyId, amount) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Adjusting quantity for property ${propertyId} by ${amount}`);

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
   * @param {string} propertyId - DiceCloud property _id
   * @param {number} value - New quantity value
   */
  async setQuantity(propertyId, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Setting quantity for property ${propertyId} to ${value}`);

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
   * Update attribute value (HP, Ki Points, Sorcery Points, etc.)
   * @param {string} propertyId - DiceCloud property _id
   * @param {number} value - New value
   */
  async updateAttributeValue(propertyId, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Updating attribute ${propertyId} to ${value}`);

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
   * Increment attribute value
   * Note: DiceCloud doesn't have a direct increment method for attributes,
   * so we need to get the current value first, then set it
   */
  async incrementAttributeValue(propertyId, amount, currentValue) {
    const newValue = currentValue + amount;
    return this.updateAttributeValue(propertyId, newValue);
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
   * Push value to array property
   * @param {string} propertyId - DiceCloud property _id
   * @param {string[]} path - Array field path
   * @param {any} value - Value to push
   */
  async pushToProperty(propertyId, path, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Pushing to property ${propertyId} at path ${path.join('.')}`);

      const result = await this.ddp.call('creatureProperties.push', {
        _id: propertyId,
        path: path,
        value: value
      });

      console.log('[DiceCloud Sync] Value pushed successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to push value:', error);
      throw error;
    }
  }

  /**
   * Pull value from array property
   * @param {string} propertyId - DiceCloud property _id
   * @param {string[]} path - Array field path
   * @param {any} value - Value to pull (or itemId for objects)
   */
  async pullFromProperty(propertyId, path, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      console.log(`[DiceCloud Sync] Pulling from property ${propertyId} at path ${path.join('.')}`);

      const result = await this.ddp.call('creatureProperties.pull', {
        _id: propertyId,
        path: path,
        value: value
      });

      console.log('[DiceCloud Sync] Value pulled successfully:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to pull value:', error);
      throw error;
    }
  }

  /**
   * Disable sync
   */
  disable() {
    this.enabled = false;
    this.propertyCache.clear();
    console.log('[DiceCloud Sync] Disabled');
  }

  /**
   * Check if sync is enabled
   */
  isEnabled() {
    return this.enabled && this.ddp.isConnected();
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
            const charResult = await browserAPI.storage.local.get([result.activeCharacterId]);
            console.log('[DiceCloud Sync] Character data for key:', result.activeCharacterId, charResult);
            
            const characterData = charResult[result.activeCharacterId];
            if (characterData && characterData.id) {
              console.log('[DiceCloud Sync] Found DiceCloud character ID:', characterData.id);
              window.diceCloudSync.initialize(characterData.id).catch(error => {
                console.error('[DiceCloud Sync] Failed to initialize:', error);
              });
            } else {
              console.warn('[DiceCloud Sync] No character data found for slot:', result.activeCharacterId);
              
              // Try to find character data in other common keys
              const commonKeys = ['slot-1', 'slot-2', 'slot-3', 'default', 'characterProfiles'];
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
              window.diceCloudSync.initialize(characterData.id).catch(error => {
                console.error('[DiceCloud Sync] Failed to initialize on retry:', error);
              });
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
