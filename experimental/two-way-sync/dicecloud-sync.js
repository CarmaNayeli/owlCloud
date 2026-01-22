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
    this.previousValues = new Map(); // propertyName -> last synced value
    this.enabled = false;

    // Request queue to prevent spamming DDP
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.minRequestDelay = 250; // Minimum delay between requests (ms)
    this.lastRequestTime = 0;
    this.maxRetries = 3; // Maximum retries for failed requests
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Async function that makes the DDP call
   * @param {string} description - Description for logging
   * @returns {Promise} - Resolves when request completes
   */
  async queueRequest(requestFn, description = 'DDP Request') {
    return new Promise((resolve, reject) => {
      const queueItem = {
        requestFn,
        description,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };

      this.requestQueue.push(queueItem);
      console.log(`[DiceCloud Sync] Queued: ${description} (Queue size: ${this.requestQueue.length})`);

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue sequentially
   */
  async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue[0]; // Peek at first item

      try {
        // Rate limiting: ensure minimum delay between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestDelay) {
          const delayNeeded = this.minRequestDelay - timeSinceLastRequest;
          console.log(`[DiceCloud Sync] Rate limiting: waiting ${delayNeeded}ms before next request`);
          await this.sleep(delayNeeded);
        }

        console.log(`[DiceCloud Sync] Processing: ${item.description} (${this.requestQueue.length} remaining)`);

        // Execute the request
        this.lastRequestTime = Date.now();
        const result = await item.requestFn();

        // Success - remove from queue and resolve
        this.requestQueue.shift();
        item.resolve(result);

        console.log(`[DiceCloud Sync] Completed: ${item.description}`);

      } catch (error) {
        console.error(`[DiceCloud Sync] Error: ${item.description}`, error);

        // Check if it's a rate limit error
        const isTooManyRequests =
          error.message?.includes('too many requests') ||
          error.message?.includes('rate limit') ||
          error.error === 'too-many-requests' ||
          error.error === 429;

        if (isTooManyRequests && item.retries < this.maxRetries) {
          // Retry with exponential backoff
          item.retries++;
          const backoffDelay = Math.min(1000 * Math.pow(2, item.retries), 10000); // Max 10s
          console.warn(`[DiceCloud Sync] Rate limited. Retry ${item.retries}/${this.maxRetries} after ${backoffDelay}ms`);

          await this.sleep(backoffDelay);
          // Don't remove from queue - will retry on next iteration
        } else {
          // Max retries reached or different error - remove and reject
          this.requestQueue.shift();
          item.reject(error);

          if (isTooManyRequests) {
            console.error(`[DiceCloud Sync] Max retries reached for: ${item.description}`);
          }
        }
      }
    }

    this.isProcessingQueue = false;
    console.log('[DiceCloud Sync] Queue processing complete');
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

      // Check user preference for auto backwards sync
      const result = await browserAPI.storage.local.get(['autoBackwardsSync']);
      const autoBackwardsSync = result.autoBackwardsSync !== false; // Default to true
      this.enabled = autoBackwardsSync;

      console.log('[DiceCloud Sync] Initialized successfully');
      console.log('[DiceCloud Sync] Auto backwards sync preference:', autoBackwardsSync);
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
              
              // First pass: collect all properties
              const allProperties = {};
              for (const property of apiData.creatureProperties) {
                if (property._id && property.name) {
                  if (!allProperties[property.name]) {
                    allProperties[property.name] = [];
                  }
                  allProperties[property.name].push(property);
                }
              }
              
              // Second pass: cache the best property for each name
              for (const [propertyName, properties] of Object.entries(allProperties)) {
                let selectedProperty = properties[0]; // default to first
                
                // Handle Hit Points - find the healthBar that tracks current HP
                if (propertyName === 'Hit Points') {
                  // Debug: Show all Hit Points properties for comparison
                  console.log(`[DiceCloud Sync] All Hit Points properties found:`);
                  properties.forEach(p => {
                    console.log(`  - ${p.name} (${p.type}): id=${p._id}, value=${p.value}, baseValue=${p.baseValue}, total=${p.total}, damage=${p.damage}, attributeType=${p.attributeType || 'none'}`);
                  });

                  // Find all healthBar attributes
                  const healthBars = properties.filter(p =>
                    p.type === 'attribute' &&
                    p.attributeType === 'healthBar'
                  );

                  let hpProperty = null;

                  if (healthBars.length > 0) {
                    // Priority 1: Find the healthBar with the highest total (main HP)
                    // AND that has a damage field defined (editable)
                    const editableHealthBars = healthBars.filter(p => p.damage !== undefined);
                    if (editableHealthBars.length > 0) {
                      hpProperty = editableHealthBars.sort((a, b) =>
                        (b.total || 0) - (a.total || 0)
                      )[0];
                    }

                    // Priority 2: If no editable ones, just take the one with highest total
                    if (!hpProperty) {
                      hpProperty = healthBars.sort((a, b) =>
                        (b.total || 0) - (a.total || 0)
                      )[0];
                    }
                  }

                  // Priority 3: Find any attribute with a damage field (fallback)
                  if (!hpProperty) {
                    hpProperty = properties.find(p =>
                      p.type === 'attribute' &&
                      p.damage !== undefined
                    );
                  }

                  if (hpProperty) {
                    this.propertyCache.set('Hit Points', hpProperty._id);
                    console.log(`[DiceCloud Sync] Selected Hit Points property: ${hpProperty.name} -> ${hpProperty._id} (type: ${hpProperty.type}, attributeType: ${hpProperty.attributeType || 'none'}, value: ${hpProperty.value}, total: ${hpProperty.total}, baseValue: ${hpProperty.baseValue}, damage: ${hpProperty.damage})`);
                  } else {
                    console.log(`[DiceCloud Sync] No suitable Hit Points property found`);
                  }
                  continue;
                }
                
                // Cache class-specific HP as the main "Hit Points" if no main HP was found
                // BUT: Don't cache Temporary Hit Points - only class-specific ones like "Hit Points: Monk"
                if (propertyName.includes('Hit Points') &&
                    propertyName !== 'Hit Points' &&
                    !propertyName.includes('Temporary')) {
                  const classHP = properties.find(p =>
                    p.type !== 'skill' &&
                    (p.value !== undefined || p.skillValue !== undefined)
                  );

                  if (classHP) {
                    this.propertyCache.set('Hit Points', classHP._id);
                    console.log(`[DiceCloud Sync] Cached class-specific HP as main Hit Points: ${propertyName} -> ${classHP._id} (type: ${classHP.type})`);
                  }
                  continue;
                }

                // Cache spell slots (1st Level, 2nd Level, etc.)
                const spellSlotMatch = propertyName.match(/^(\d+(?:st|nd|rd|th)) Level$/);
                if (spellSlotMatch) {
                  // Find the attribute for this spell slot level
                  const spellSlotAttr = properties.find(p =>
                    p.name === propertyName &&
                    p.type === 'attribute' &&
                    !p.removed &&
                    !p.inactive
                  );

                  if (spellSlotAttr) {
                    // Cache with both the full name and a short key
                    this.propertyCache.set(propertyName, spellSlotAttr._id);
                    this.propertyCache.set(`spellSlot${spellSlotMatch[1].replace(/\D/g, '')}`, spellSlotAttr._id);
                    console.log(`[DiceCloud Sync] Cached spell slot: ${propertyName} -> ${spellSlotAttr._id}`);
                  }
                  continue;
                }

                // Cache Channel Divinity and similar limited-use class features
                if (propertyName === 'Channel Divinity') {
                  const channelDivinity = properties.find(p =>
                    p.name === propertyName &&
                    p.type === 'attribute' &&
                    !p.removed &&
                    !p.inactive
                  );

                  if (channelDivinity) {
                    this.propertyCache.set('Channel Divinity', channelDivinity._id);
                    console.log(`[DiceCloud Sync] Cached Channel Divinity: ${channelDivinity._id}`);
                  }
                  continue;
                }

                // Cache all other properties normally
                this.propertyCache.set(propertyName, selectedProperty._id);
                console.log(`[DiceCloud Sync] Cached property: ${propertyName} -> ${selectedProperty._id}`);
              }
            }

            // Cache actions with limited uses from the raw API data
            const actionsWithUses = apiData.creatureProperties.filter(p =>
              p.type === 'action' &&
              p.name &&
              p.uses !== undefined &&
              p.uses > 0 &&
              !p.removed &&
              !p.inactive
            );

            console.log(`[DiceCloud Sync] Found ${actionsWithUses.length} actions with limited uses`);
            for (const action of actionsWithUses) {
              // Only cache if not already cached by name
              if (!this.propertyCache.has(action.name)) {
                this.propertyCache.set(action.name, action._id);
                console.log(`[DiceCloud Sync] Cached action with uses: ${action.name} -> ${action._id} (${action.usesUsed || 0}/${action.uses} used)`);
              }
            }

            // Cache common class resources (Ki Points, Sorcery Points, etc.)
            const classResourceNames = [
              'Ki Points', 'Sorcery Points', 'Bardic Inspiration', 'Superiority Dice',
              'Lay on Hands', 'Wild Shape', 'Rage', 'Action Surge', 'Indomitable',
              'Second Wind', 'Sneak Attack', 'Cunning Action', 'Arcane Recovery',
              'Song of Rest', 'Font of Magic', 'Metamagic', 'Sorcery Point',
              'Warlock Spell Slots', 'Pact Magic', 'Eldritch Invocations'
            ];

            const classResources = apiData.creatureProperties.filter(p =>
              p.type === 'attribute' &&
              p.name &&
              classResourceNames.some(name => p.name.includes(name)) &&
              !p.removed &&
              !p.inactive
            );

            console.log(`[DiceCloud Sync] Found ${classResources.length} class resources`);
            for (const resource of classResources) {
              if (!this.propertyCache.has(resource.name)) {
                this.propertyCache.set(resource.name, resource._id);
                console.log(`[DiceCloud Sync] Cached class resource: ${resource.name} -> ${resource._id}`);
              }
            }

            // Cache Temporary Hit Points
            const tempHP = apiData.creatureProperties.find(p =>
              p.name === 'Temporary Hit Points' &&
              p.type === 'attribute' &&
              !p.removed &&
              !p.inactive
            );
            if (tempHP) {
              this.propertyCache.set('Temporary Hit Points', tempHP._id);
              console.log(`[DiceCloud Sync] Cached Temporary Hit Points: ${tempHP._id}`);
            }

            // Cache Death Saves
            const deathSaveProps = apiData.creatureProperties.filter(p =>
              p.type === 'attribute' &&
              (p.name === 'Succeeded Saves' || p.name === 'Failed Saves') &&
              !p.removed &&
              !p.inactive
            );
            for (const deathSave of deathSaveProps) {
              this.propertyCache.set(deathSave.name, deathSave._id);
              console.log(`[DiceCloud Sync] Cached Death Save: ${deathSave.name} -> ${deathSave._id}`);
            }

            // Cache Hit Dice (d6, d8, d10, d12)
            const hitDiceNames = ['d6 Hit Dice', 'd8 Hit Dice', 'd10 Hit Dice', 'd12 Hit Dice'];
            const hitDice = apiData.creatureProperties.filter(p =>
              p.type === 'attribute' &&
              p.name &&
              hitDiceNames.some(name => p.name.includes(name)) &&
              !p.removed &&
              !p.inactive
            );
            for (const hitDie of hitDice) {
              this.propertyCache.set(hitDie.name, hitDie._id);
              console.log(`[DiceCloud Sync] Cached Hit Die: ${hitDie.name} -> ${hitDie._id}`);
            }

            // Cache Heroic Inspiration (2024 rules)
            const inspiration = apiData.creatureProperties.find(p =>
              (p.name === 'Heroic Inspiration' || p.name === 'Inspiration') &&
              p.type === 'attribute' &&
              !p.removed &&
              !p.inactive
            );
            if (inspiration) {
              this.propertyCache.set('Heroic Inspiration', inspiration._id);
              this.propertyCache.set('Inspiration', inspiration._id); // Cache both names
              console.log(`[DiceCloud Sync] Cached Inspiration: ${inspiration._id}`);
            }

            // Cache any other attributes with reset fields (short/long rest resources)
            const restorableAttributes = apiData.creatureProperties.filter(p =>
              p.type === 'attribute' &&
              p.name &&
              p.reset &&
              p.reset !== 'none' &&
              !p.removed &&
              !p.inactive &&
              !this.propertyCache.has(p.name) // Don't duplicate
            );
            console.log(`[DiceCloud Sync] Found ${restorableAttributes.length} additional restorable attributes`);
            for (const attr of restorableAttributes) {
              this.propertyCache.set(attr.name, attr._id);
              console.log(`[DiceCloud Sync] Cached restorable attribute: ${attr.name} (resets on ${attr.reset}) -> ${attr._id}`);
            }

            // IMPROVEMENT: Cache ALL remaining attributes (even without reset fields)
            // This ensures custom resources and homebrew attributes sync properly
            const allRemainingAttributes = apiData.creatureProperties.filter(p =>
              p.type === 'attribute' &&
              p.name &&
              !p.removed &&
              !p.inactive &&
              !this.propertyCache.has(p.name) && // Don't duplicate
              // Only cache if it has a value or baseValue (actual trackable resource)
              (p.value !== undefined || p.baseValue !== undefined)
            );
            console.log(`[DiceCloud Sync] Found ${allRemainingAttributes.length} additional custom attributes to cache`);
            for (const attr of allRemainingAttributes) {
              this.propertyCache.set(attr.name, attr._id);
              console.log(`[DiceCloud Sync] Cached custom attribute: ${attr.name} -> ${attr._id} (value: ${attr.value}, baseValue: ${attr.baseValue})`);
            }

            // Cache important toggles (conditions, active features, etc.)
            const importantToggles = apiData.creatureProperties.filter(p =>
              p.type === 'toggle' &&
              p.name &&
              !p.removed &&
              !p.inactive
            );
            console.log(`[DiceCloud Sync] Found ${importantToggles.length} toggles`);
            for (const toggle of importantToggles) {
              if (!this.propertyCache.has(toggle.name)) {
                this.propertyCache.set(toggle.name, toggle._id);
                console.log(`[DiceCloud Sync] Cached toggle: ${toggle.name} -> ${toggle._id}`);
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

      // Initialize previousValues from current character data to avoid syncing everything on first update
      console.log('[DiceCloud Sync] Initializing previousValues from current character data...');
      await this.initializePreviousValues(characterData);
    } else {
      console.warn('[DiceCloud Sync] No character data available for cache building');
      console.warn('[DiceCloud Sync] activeCharacterId:', activeCharacterId);
      console.warn('[DiceCloud Sync] characterProfiles:', characterProfiles);
    }
  }

  /**
   * Initialize previousValues from character data to avoid syncing everything on first update
   * @param {Object} characterData - Character data object
   */
  async initializePreviousValues(characterData) {
    console.log('[DiceCloud Sync] Populating previousValues to establish baseline...');

    // HP values
    if (characterData.hp !== undefined) {
      this.previousValues.set('Hit Points', characterData.hp);
    }
    if (characterData.tempHp !== undefined) {
      this.previousValues.set('Temporary Hit Points', characterData.tempHp);
    }
    if (characterData.maxHp !== undefined) {
      this.previousValues.set('Max Hit Points', characterData.maxHp);
    }

    // Spell slots
    if (characterData.spellSlots) {
      for (let level = 1; level <= 9; level++) {
        const currentKey = `level${level}SpellSlots`;
        const maxKey = `level${level}SpellSlotsMax`;

        if (characterData.spellSlots[currentKey] !== undefined && characterData.spellSlots[maxKey] !== undefined) {
          if (characterData.spellSlots[maxKey] > 0) {
            const cacheKey = `spellSlot${level}`;
            this.previousValues.set(cacheKey, characterData.spellSlots[currentKey]);
          }
        }
      }
    }

    // Channel Divinity
    if (characterData.channelDivinity !== undefined && characterData.channelDivinity.current !== undefined) {
      this.previousValues.set('Channel Divinity', characterData.channelDivinity.current);
    }

    // Resources
    if (characterData.resources && Array.isArray(characterData.resources)) {
      for (const resource of characterData.resources) {
        if (resource.name && resource.current !== undefined) {
          this.previousValues.set(resource.name, resource.current);
        }
      }
    }

    // Death saves
    if (characterData.deathSaves) {
      if (characterData.deathSaves.successes !== undefined) {
        this.previousValues.set('Succeeded Saves', characterData.deathSaves.successes);
      }
      if (characterData.deathSaves.failures !== undefined) {
        this.previousValues.set('Failed Saves', characterData.deathSaves.failures);
      }
    }

    // Inspiration
    if (characterData.inspiration !== undefined) {
      this.previousValues.set('Inspiration', characterData.inspiration);
    }

    console.log(`[DiceCloud Sync] Initialized ${this.previousValues.size} previous values`);
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

    const propertyId = this.findPropertyId(actionName);
    if (!propertyId) {
      console.warn(`[DiceCloud Sync] Property not found: ${actionName}`);
      return;
    }

    // Queue the request instead of calling directly
    return this.queueRequest(
      async () => {
        console.log(`[DiceCloud Sync] Incrementing uses for ${actionName} (${propertyId}) by ${amount}`);

        const result = await this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['usesUsed'],
          value: amount
        });

        console.log('[DiceCloud Sync] ⏳ Increment request sent:', result);
        return result;
      },
      `Increment ${actionName} uses`
    );
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

    const propertyId = this.findPropertyId(actionName);
    if (!propertyId) {
      console.warn(`[DiceCloud Sync] Property not found: ${actionName}`);
      return;
    }

    // Queue the request instead of calling directly
    return this.queueRequest(
      async () => {
        console.log(`[DiceCloud Sync] Setting uses for ${actionName} (${propertyId}) to ${value}`);

        const result = await this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['usesUsed'],
          value: value
        });

        console.log('[DiceCloud Sync] ⏳ Set uses request sent:', result);
        return result;
      },
      `Set ${actionName} uses to ${value}`
    );
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

    const propertyId = this.findPropertyId(attributeName);
    if (!propertyId) {
      console.warn(`[DiceCloud Sync] Property not found: ${attributeName}`);
      return;
    }

    console.log(`[DiceCloud Sync] Updating attribute ${attributeName} (${propertyId}) to ${value}`);

    // Prepare the update - this runs BEFORE queueing
    const updatePayload = {
      _id: propertyId,
      path: ['value'],  // Default, will be updated based on property type
      value: value
    };

    // Check current value before update and determine correct field name
    try {
      const tokenResult = await browserAPI.storage.local.get(['diceCloudToken']);
      const { diceCloudToken } = tokenResult;

      if (diceCloudToken) {
        // Use the character endpoint like the debug button does
        const characterId = this.characterId;
        const currentResponse = await browserAPI.runtime.sendMessage({
          action: 'fetchDiceCloudAPI',
          url: `https://dicecloud.com/api/creature/${characterId}`,
          token: diceCloudToken
        });

        if (currentResponse.success && currentResponse.data) {
          // Find the property in the full character data
          const property = currentResponse.data.creatureProperties.find(p => p._id === propertyId);
          if (property) {
            console.log('[DiceCloud Sync] Property before update:', {
              id: property._id,
              name: property.name,
              type: property.type,
              attributeType: property.attributeType,
              value: property.value,
              baseValue: property.baseValue,
              total: property.total,
              damage: property.damage,
              skillValue: property.skillValue,
              dirty: property.dirty
            });

            // Determine the correct field name and value based on property type
            let fieldName = 'value'; // default
            let updateValue = value; // default to the passed value
            let useHealthBarMethod = false; // Flag to use creatureProperties.damage method

            if (property.type === 'skill') {
              fieldName = 'skillValue';
            } else if (property.type === 'effect') {
              // For effects, check if there's a calculation or if it uses value
              fieldName = property.calculation ? 'calculation' : 'value';
            } else if (property.type === 'attribute' && property.attributeType === 'healthBar') {
              // For healthBar attributes (like HP), we must use creatureProperties.damage method
              // The damage field cannot be updated directly via creatureProperties.update
              // Instead, use operation: 'set' with the new current HP value
              console.log(`[DiceCloud Sync] HealthBar update: currentHP=${property.value}, newCurrentHP=${value}, total=${property.total}, currentDamage=${property.damage}`);
              useHealthBarMethod = true;
              updateValue = value; // Pass the new current HP value directly
            } else if (property.type === 'attribute') {
              // For other attributes, update the value directly
              fieldName = 'value';
            }
            console.log(`[DiceCloud Sync] Using field name: ${fieldName} for property type: ${property.type}, attributeType: ${property.attributeType || 'none'}`);
            console.log(`[DiceCloud Sync] Use healthBar method: ${useHealthBarMethod}`);

            // Update the payload with the correct field name and value
            if (useHealthBarMethod) {
              // For healthBar, use different payload structure for creatureProperties.damage
              updatePayload.operation = 'set';
              updatePayload.value = updateValue;
              delete updatePayload.path; // Remove path field, not used in damage method
            } else {
              updatePayload.path = [fieldName];
              updatePayload.value = updateValue;
            }
          }
        }
      } else {
        console.warn('[DiceCloud Sync] No DiceCloud token available for verification');
      }
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to get current property value:', error);
    }

    // Determine which DDP method to use based on property type
    let methodName = 'creatureProperties.update';
    if (updatePayload.operation === 'set' && !updatePayload.path) {
      // For healthBar attributes, use the damage method
      methodName = 'creatureProperties.damage';
    }

    console.log(`[DiceCloud Sync] Using DDP method: ${methodName}`);
    console.log('[DiceCloud Sync] DDP update payload:', JSON.stringify(updatePayload, null, 2));

    // Queue the actual DDP call
    return this.queueRequest(
      async () => {
        const result = await this.ddp.call(methodName, updatePayload);

        console.log(`[DiceCloud Sync] ⏳ Update request sent using ${methodName}:`, result);
        console.log('[DiceCloud Sync] Checking if update was applied...');

        // Verify the update by checking the property again
        setTimeout(async () => {
          try {
            const tokenResult = await browserAPI.storage.local.get(['diceCloudToken']);
            const { diceCloudToken } = tokenResult;

            if (diceCloudToken) {
              console.log('[DiceCloud Sync] Verifying update for property:', propertyId);
              console.log('[DiceCloud Sync] Character ID available:', this.characterId);

              // Use the character endpoint like the debug button does
              const characterId = this.characterId;
              if (!characterId) {
                console.error('[DiceCloud Sync] No character ID available for verification');
                return;
              }

              const verifyResponse = await browserAPI.runtime.sendMessage({
                action: 'fetchDiceCloudAPI',
                url: `https://dicecloud.com/api/creature/${characterId}`,
                token: diceCloudToken
              });

              console.log('[DiceCloud Sync] Verification API response:', verifyResponse);

              if (verifyResponse.success && verifyResponse.data) {
                console.log('[DiceCloud Sync] Verification API data received, looking for property:', propertyId);
                console.log('[DiceCloud Sync] Total properties in response:', verifyResponse.data.creatureProperties?.length);

                // Find the property in the full character data
                const property = verifyResponse.data.creatureProperties.find(p => p._id === propertyId);
                if (property) {
                  console.log('[DiceCloud Sync] Property after update:', {
                    id: property._id,
                    name: property.name,
                    type: property.type,
                    attributeType: property.attributeType,
                    value: property.value,
                    total: property.total,
                    baseValue: property.baseValue,
                    damage: property.damage,
                    dirty: property.dirty,
                    lastUpdated: property.lastUpdated
                  });

                  // Check if the value actually changed
                  if (property.value === value) {
                    console.log('[DiceCloud Sync] ✅ SUCCESS: Value updated correctly!');
                  } else {
                    console.warn('[DiceCloud Sync] ❌ ISSUE: Value did not change. Expected:', value, 'Actual:', property.value);
                    if (property.total && property.damage !== undefined) {
                      const calculatedValue = property.total - property.damage;
                      console.log(`[DiceCloud Sync] Calculated value: ${property.total} - ${property.damage} = ${calculatedValue}`);
                    }
                  }
                } else {
                  console.warn('[DiceCloud Sync] Property not found in character data');
                  console.log('[DiceCloud Sync] Available HP properties:', verifyResponse.data.creatureProperties
                    .filter(p => p.name && p.name.toLowerCase().includes('hit points'))
                    .map(p => ({ id: p._id, name: p.name, value: p.value }))
                  );
                }
              } else {
                console.error('[DiceCloud Sync] Failed to verify update:', verifyResponse.error);
              }
            } else {
              console.warn('[DiceCloud Sync] No DiceCloud token available for verification');
            }
          } catch (error) {
            console.error('[DiceCloud Sync] Failed to verify update:', error);
          }
        }, 1000);

        return result;
      },
      `Update ${attributeName} to ${value}`
    );
  }

  /**
   * Update spell slot current value
   * @param {number} level - Spell level (1-9)
   * @param {number} slotsRemaining - Number of slots remaining
   */
  async updateSpellSlot(level, slotsRemaining) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      // Try both naming conventions
      const slotKey = `spellSlot${level}`;
      const slotName = `${level}${this.getOrdinalSuffix(level)} Level`;

      let propertyId = this.findPropertyId(slotKey);
      if (!propertyId) {
        propertyId = this.findPropertyId(slotName);
      }

      if (!propertyId) {
        console.warn(`[DiceCloud Sync] ❌ Spell slot level ${level} not found in property cache`);
        console.warn(`[DiceCloud Sync] Tried keys: "${slotKey}", "${slotName}"`);

        // Show spell slots that ARE cached
        const spellSlotProps = Array.from(this.propertyCache.keys())
          .filter(name => name.toLowerCase().includes('level') || name.toLowerCase().includes('spell'));
        console.warn(`[DiceCloud Sync] Cached spell-related properties:`, spellSlotProps);

        return;
      }

      console.log(`[DiceCloud Sync] Updating spell slot level ${level} to ${slotsRemaining} remaining`);

      const result = await this.queueRequest(
        () => this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['value'],
          value: slotsRemaining
        }),
        `Update spell slot level ${level} to ${slotsRemaining}`
      );

      console.log(`[DiceCloud Sync] ⏳ Spell slot level ${level} update request sent:`, result);
      return result;
    } catch (error) {
      console.error(`[DiceCloud Sync] ❌ Failed to update spell slot level ${level}:`, error);
      throw error;
    }
  }

  /**
   * Update Channel Divinity uses
   * @param {number} usesRemaining - Number of uses remaining
   */
  async updateChannelDivinity(usesRemaining) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId('Channel Divinity');
      if (!propertyId) {
        console.warn('[DiceCloud Sync] Channel Divinity not found');
        return;
      }

      console.log(`[DiceCloud Sync] Updating Channel Divinity to ${usesRemaining} uses remaining`);

      const result = await this.queueRequest(
        () => this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['value'],
          value: usesRemaining
        }),
        `Update Channel Divinity to ${usesRemaining}`
      );

      console.log('[DiceCloud Sync] ⏳ Channel Divinity update request sent:', result);
      return result;
    } catch (error) {
      console.error('[DiceCloud Sync] Failed to update Channel Divinity:', error);
      throw error;
    }
  }

  /**
   * Update any generic resource by name
   * @param {string} resourceName - Name of the resource (Ki Points, Sorcery Points, etc.)
   * @param {number} value - New value
   */
  async updateResource(resourceName, value) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(resourceName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] ❌ Resource "${resourceName}" not found in property cache`);
        console.warn(`[DiceCloud Sync] Available cached properties:`, Array.from(this.propertyCache.keys()).sort());

        // Suggest similar property names (fuzzy matching)
        const similarNames = Array.from(this.propertyCache.keys())
          .filter(name => name.toLowerCase().includes(resourceName.toLowerCase()) ||
                          resourceName.toLowerCase().includes(name.toLowerCase()))
          .slice(0, 5);

        if (similarNames.length > 0) {
          console.warn(`[DiceCloud Sync] 💡 Did you mean one of these? ${similarNames.join(', ')}`);
        }

        return;
      }

      console.log(`[DiceCloud Sync] Updating ${resourceName} to ${value}`);

      const result = await this.queueRequest(
        () => this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['value'],
          value: value
        }),
        `Update ${resourceName} to ${value}`
      );

      console.log(`[DiceCloud Sync] ⏳ ${resourceName} update request sent:`, result);
      return result;
    } catch (error) {
      console.error(`[DiceCloud Sync] ❌ Failed to update ${resourceName}:`, error);
      throw error;
    }
  }

  /**
   * Update Temporary Hit Points
   * @param {number} tempHP - Temporary HP value
   */
  async updateTemporaryHP(tempHP) {
    return this.updateResource('Temporary Hit Points', tempHP);
  }

  /**
   * Update Death Saves
   * @param {number} succeeded - Number of succeeded death saves
   * @param {number} failed - Number of failed death saves
   */
  async updateDeathSaves(succeeded, failed) {
    const results = [];

    if (succeeded !== undefined) {
      results.push(await this.updateResource('Succeeded Saves', succeeded));
    }

    if (failed !== undefined) {
      results.push(await this.updateResource('Failed Saves', failed));
    }

    return results;
  }

  /**
   * Update Hit Dice remaining
   * @param {string} dieType - Die type ('d6', 'd8', 'd10', 'd12')
   * @param {number} remaining - Number of hit dice remaining
   */
  async updateHitDice(dieType, remaining) {
    const resourceName = `${dieType} Hit Dice`;
    return this.updateResource(resourceName, remaining);
  }

  /**
   * Update Inspiration/Heroic Inspiration
   * @param {number} value - Inspiration value (typically 0 or 1)
   */
  async updateInspiration(value) {
    return this.updateResource('Heroic Inspiration', value);
  }

  /**
   * Update toggle state (conditions, active features, etc.)
   * @param {string} toggleName - Name of the toggle
   * @param {boolean} enabled - Whether the toggle is enabled
   */
  async updateToggle(toggleName, enabled) {
    if (!this.enabled) {
      console.warn('[DiceCloud Sync] Sync not enabled');
      return;
    }

    try {
      const propertyId = this.findPropertyId(toggleName);
      if (!propertyId) {
        console.warn(`[DiceCloud Sync] Toggle "${toggleName}" not found`);
        return;
      }

      console.log(`[DiceCloud Sync] Setting toggle ${toggleName} to ${enabled ? 'enabled' : 'disabled'}`);

      // Toggles use the 'enabled' field instead of 'value'
      const result = await this.queueRequest(
        () => this.ddp.call('creatureProperties.update', {
          _id: propertyId,
          path: ['enabled'],
          value: enabled
        }),
        `Update toggle ${toggleName} to ${enabled ? 'enabled' : 'disabled'}`
      );

      console.log(`[DiceCloud Sync] ⏳ Toggle ${toggleName} update request sent:`, result);
      return result;
    } catch (error) {
      console.error(`[DiceCloud Sync] Failed to update toggle ${toggleName}:`, error);
      throw error;
    }
  }

  /**
   * Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
   */
  getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  findPropertyId(attributeName) {
    const propertyId = this.propertyCache.get(attributeName);
    if (propertyId) {
      console.log(`[DiceCloud Sync] Found property ID for ${attributeName}: ${propertyId}`);
      return propertyId;
    }

    // Handle special cases for Hit Points (use class-specific HP instead of calculated base HP)
    if (attributeName === 'Hit Points') {
      console.log('[DiceCloud Sync] Looking for Hit Points alternatives...');
      const hpRelatedProps = Array.from(this.propertyCache.keys()).filter(name => 
        name.toLowerCase().includes('hit points') || 
        name.toLowerCase().includes('hp') ||
        name.toLowerCase().includes('health')
      );
      console.log('[DiceCloud Sync] HP-related properties found:', hpRelatedProps);
      
      // Try class-specific HP first (like "Hit Points: Monk")
      const classSpecificHP = hpRelatedProps.find(name => name !== 'Hit Points' && name.includes('Hit Points'));
      if (classSpecificHP) {
        const classSpecificId = this.propertyCache.get(classSpecificHP);
        console.log(`[DiceCloud Sync] Using class-specific HP: ${classSpecificHP} -> ${classSpecificId}`);
        return classSpecificId;
      }
    }

    console.warn(`[DiceCloud Sync] Property ID not found for: ${attributeName}`);
    console.log(`[DiceCloud Sync] Available properties:`, Array.from(this.propertyCache.keys()).slice(0, 20));
    return null;
  }

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

    // Helper function to check if value has changed
    const hasChanged = (key, newValue) => {
      const oldValue = this.previousValues.get(key);
      const changed = oldValue !== newValue;
      if (changed) {
        console.log(`[DiceCloud Sync] ✏️ Value changed for ${key}: ${oldValue} -> ${newValue} (will sync)`);
        this.previousValues.set(key, newValue);
      }
      // Skip logging for unchanged values to reduce console spam
      return changed;
    };

    // Update HP if changed
    if (characterData.hp !== undefined && hasChanged('Hit Points', characterData.hp)) {
      await this.updateAttributeValue('Hit Points', characterData.hp);
    }

    // Update temporary HP if changed
    if (characterData.tempHp !== undefined && hasChanged('Temporary Hit Points', characterData.tempHp)) {
      await this.updateAttributeValue('Temporary Hit Points', characterData.tempHp);
    }

    // Update max HP if changed
    if (characterData.maxHp !== undefined && hasChanged('Max Hit Points', characterData.maxHp)) {
      await this.updateAttributeValue('Max Hit Points', characterData.maxHp);
    }

    // Update spell slots if they exist (level1SpellSlots, level2SpellSlots, etc.)
    if (characterData.spellSlots) {
      for (let level = 1; level <= 9; level++) {
        const currentKey = `level${level}SpellSlots`;
        const maxKey = `level${level}SpellSlotsMax`;

        if (characterData.spellSlots[currentKey] !== undefined && characterData.spellSlots[maxKey] !== undefined) {
          // Only sync if max > 0 (character has slots of this level)
          if (characterData.spellSlots[maxKey] > 0) {
            const cacheKey = `spellSlot${level}`;
            const currentValue = characterData.spellSlots[currentKey];

            if (hasChanged(cacheKey, currentValue)) {
              console.log(`[DiceCloud Sync] Syncing spell slot level ${level}: ${currentValue}/${characterData.spellSlots[maxKey]}`);
              await this.updateSpellSlot(level, currentValue);
            }
          }
        }
      }
    }

    // Update Channel Divinity if it exists
    if (characterData.channelDivinity !== undefined) {
      const currentValue = characterData.channelDivinity.current;
      if (hasChanged('Channel Divinity', currentValue)) {
        console.log(`[DiceCloud Sync] Syncing Channel Divinity: ${currentValue}/${characterData.channelDivinity.max}`);
        await this.updateChannelDivinity(currentValue);
      }
    }

    // Update other tracked resources
    if (characterData.resources && Array.isArray(characterData.resources)) {
      for (const resource of characterData.resources) {
        if (resource.name && resource.current !== undefined) {
          if (hasChanged(resource.name, resource.current)) {
            console.log(`[DiceCloud Sync] Syncing resource ${resource.name}: ${resource.current}/${resource.max}`);
            await this.updateResource(resource.name, resource.current);
          }
        }
      }
    }

    // Update death saves if changed
    if (characterData.deathSaves) {
      if (characterData.deathSaves.successes !== undefined) {
        if (hasChanged('Succeeded Saves', characterData.deathSaves.successes)) {
          await this.updateDeathSaves(characterData.deathSaves.successes, undefined);
        }
      }
      if (characterData.deathSaves.failures !== undefined) {
        if (hasChanged('Failed Saves', characterData.deathSaves.failures)) {
          await this.updateDeathSaves(undefined, characterData.deathSaves.failures);
        }
      }
    }

    // Update inspiration if changed
    if (characterData.inspiration !== undefined && hasChanged('Inspiration', characterData.inspiration)) {
      await this.updateInspiration(characterData.inspiration);
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
    
    // Get DiceCloud token for authentication
    const tokenResult = await browserAPI.storage.local.get(['diceCloudToken']);
    const { diceCloudToken } = tokenResult;
    
    if (diceCloudToken) {
      console.log('[DiceCloud Sync] Setting up DDP authentication...');
      // Set up authentication after connection
      ddpClient.onConnected = async () => {
        console.log('[DiceCloud Sync] DDP connected, authenticating...');
        try {
          const result = await ddpClient.call('login', {
            resume: diceCloudToken
          });
          console.log('[DiceCloud Sync] DDP authentication successful:', result);
        } catch (error) {
          console.error('[DiceCloud Sync] DDP authentication failed:', error);
        }
      };
      
      // Connect to DDP
      console.log('[DiceCloud Sync] About to connect to DDP...');
      try {
        await ddpClient.connect();
        console.log('[DiceCloud Sync] DDP connect() completed');
      } catch (error) {
        console.error('[DiceCloud Sync] DDP connect() failed:', error);
      }
    } else {
      console.warn('[DiceCloud Sync] No DiceCloud token found for DDP authentication');
      // Still connect without authentication
      console.log('[DiceCloud Sync] About to connect to DDP without token...');
      try {
        await ddpClient.connect();
        console.log('[DiceCloud Sync] DDP connect() completed without token');
      } catch (error) {
        console.error('[DiceCloud Sync] DDP connect() failed without token:', error);
      }
    }
    
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
    console.error('[DiceCloud Sync] Error details:', error.stack);
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
