/**
 * Resource Manager Module
 *
 * Handles class resource tracking, consumption, and conversion.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - buildResourcesDisplay()
 * - adjustResource(resource)
 * - getSorceryPointsResource()
 * - getKiPointsResource()
 * - findResourceByVariableName(variableName)
 * - getResourceCostsFromAction(action)
 * - getKiCostFromAction(action)
 * - getSorceryPointCostFromAction(action)
 * - decrementActionResources(action)
 * - showConvertSlotToPointsModal()
 * - showFontOfMagicModal()
 * - showSpellSlotRestorationModal(channelDivinityResource, maxSlotLevel)
 * - restoreSpellSlot(level, channelDivinityResource)
 */

(function() {
  'use strict';

  // ===== RESOURCE DISPLAY FUNCTIONS =====

  /**
   * Build resources display grid
   */
  function buildResourcesDisplay() {
    const container = document.getElementById('resources-container');

    if (!characterData || !characterData.resources || characterData.resources.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666;">No class resources available</p>';
      debug.log('⚠️ No resources in character data');
      // Collapse the section when empty
      if (typeof collapseSectionByContainerId !== 'undefined') {
        collapseSectionByContainerId('resources-container');
      }
      return;
    }

    // Expand the section when it has content
    if (typeof expandSectionByContainerId !== 'undefined') {
      expandSectionByContainerId('resources-container');
    }

    debug.log(`📊 Building resources display with ${characterData.resources.length} resources:`,
      characterData.resources.map(r => `${r.name} (${r.current}/${r.max})`));

    const resourcesGrid = document.createElement('div');
    resourcesGrid.className = 'spell-slots-grid'; // Reuse spell slot styling

    characterData.resources.forEach(resource => {
      // Skip resources with MAX = 0 (useless paladin amount resources)
      if (resource.max === 0) {
        debug.log(`⏭️ Skipping resource with MAX = 0: ${resource.name}`);
        return;
      }

      // Skip Lucky resources since they have their own action button
      const lowerName = resource.name.toLowerCase().trim();
      if (lowerName.includes('lucky point') || lowerName.includes('luck point') || lowerName === 'lucky points' || lowerName === 'lucky') {
        debug.log(`⏭️ Skipping Lucky resource from display: ${resource.name}`);
        return;
      }

      // Skip HP resources since HP has its own dedicated UI section
      if (lowerName.includes('hit point') || lowerName === 'hp' || lowerName === 'health' || lowerName.includes('hitpoint')) {
        debug.log(`⏭️ Skipping HP resource from display: ${resource.name}`);
        return;
      }

      // Skip "Spell Level" resource - this is metadata, not an actual resource
      if (lowerName === 'spell level' || lowerName === 'spelllevel') {
        debug.log(`⏭️ Skipping Spell Level resource from display: ${resource.name}`);
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

  /**
   * Manual resource adjustment modal
   */
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

    if (typeof saveCharacterData !== 'undefined') {
      saveCharacterData();
    }
    if (typeof buildSheet !== 'undefined') {
      buildSheet(characterData);
    }

    if (typeof showNotification !== 'undefined') {
      showNotification(`✅ ${resource.name} updated to ${resource.current}/${resource.max}`);
    }
  }

  // ===== RESOURCE FINDER FUNCTIONS =====

  /**
   * Get Sorcery Points resource (uses action-executor)
   */
  function getSorceryPointsResource() {
    if (typeof executorGetSorceryPointsResource !== 'undefined') {
      return executorGetSorceryPointsResource(characterData);
    }
    return null;
  }

  /**
   * Get Ki Points resource
   */
  function getKiPointsResource() {
    if (!characterData || !characterData.resources) return null;

    // Find ki points in resources
    const kiResource = characterData.resources.find(r => {
      const lowerName = r.name.toLowerCase();
      return lowerName.includes('ki point') || lowerName === 'ki points' || lowerName === 'ki';
    });

    return kiResource || null;
  }

  /**
   * Find resource by variable name (with flexible Channel Divinity matching)
   */
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

  // ===== RESOURCE COST EXTRACTION FUNCTIONS =====

  /**
   * Get resource costs from action (uses DiceCloud structured data)
   */
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

  /**
   * Get Ki cost from action (legacy compatibility)
   */
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

  /**
   * Get Sorcery Point cost from action (legacy compatibility)
   */
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

  // ===== RESOURCE CONSUMPTION FUNCTIONS =====

  /**
   * Decrement action resources (Wild Shape uses, Breath Weapon uses, etc.)
   */
  function decrementActionResources(action) {
    // Decrement all resource costs for an action
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
        if (typeof showNotification !== 'undefined') {
          showNotification(`❌ Not enough ${cost.name || cost.variableName}! Need ${cost.quantity}, have ${resource.current}`, 'error');
        }
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
        if (typeof showNotification !== 'undefined') {
          showNotification(`✅ Used ${action.name}! (${resource.current}/${resource.max} ${cost.name || cost.variableName} left)`);
        }
      }
    }

    if (typeof saveCharacterData !== 'undefined') {
      saveCharacterData();
    }
    if (typeof buildSheet !== 'undefined') {
      buildSheet(characterData); // Refresh display
    }
    return true;
  }

  // ===== SORCERY POINT CONVERSION MODALS =====

  /**
   * Convert spell slot to sorcery points (Font of Magic)
   */
  function showConvertSlotToPointsModal() {
    const sorceryPoints = getSorceryPointsResource();

    if (!sorceryPoints) {
      if (typeof showNotification !== 'undefined') {
        showNotification('❌ No Sorcery Points resource found', 'error');
      }
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
      if (typeof showNotification !== 'undefined') {
        showNotification('❌ No spell slots available to convert!', 'error');
      }
      return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

    let optionsHTML = `
      <h3 style="margin: 0 0 15px 0; color: var(--text-primary); text-align: center;">Convert Spell Slot to Sorcery Points</h3>
      <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 10px; font-weight: bold; color: var(--text-primary);">Expend Spell Slot:</label>
        <select id="slot-to-points-level" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid var(--border-color); border-radius: 6px; box-sizing: border-box; background: var(--bg-tertiary); color: var(--text-primary);">
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
        if (typeof showNotification !== 'undefined') {
          showNotification(`❌ No Level ${selectedLevel} spell slots available!`, 'error');
        }
        return;
      }

      // Remove spell slot
      characterData.spellSlots[slotVar] -= 1;

      // Gain sorcery points equal to slot level
      const pointsGained = selectedLevel;
      sorceryPoints.current = Math.min(sorceryPoints.current + pointsGained, sorceryPoints.max);

      if (typeof saveCharacterData !== 'undefined') {
        saveCharacterData();
      }

      const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
      const newSlotCount = characterData.spellSlots[slotVar];
      const maxSlots = characterData.spellSlots[maxSlotVar];
      if (typeof showNotification !== 'undefined') {
        showNotification(`✨ Gained ${pointsGained} Sorcery Points! (${sorceryPoints.current}/${sorceryPoints.max} SP, ${newSlotCount}/${maxSlots} slots)`);
      }

      // Announce to Roll20
      if (typeof getColoredBanner !== 'undefined') {
        const colorBanner = getColoredBanner(characterData);
        const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Spell Slot to Sorcery Points}} {{Result=Expended Level ${selectedLevel} spell slot for ${pointsGained} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            action: 'roll',
            characterName: characterData.name,
            message: message,
            color: characterData.notificationColor
          }, '*');
        }
      }

      document.body.removeChild(modal);
      if (typeof buildSheet !== 'undefined') {
        buildSheet(characterData); // Refresh display
      }
    });
  }

  /**
   * Convert sorcery points to spell slot (Font of Magic)
   */
  function showFontOfMagicModal() {
    const sorceryPoints = getSorceryPointsResource();

    if (!sorceryPoints) {
      if (typeof showNotification !== 'undefined') {
        showNotification('❌ No Sorcery Points resource found', 'error');
      }
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
    modalContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

    let optionsHTML = `
      <h3 style="margin: 0 0 15px 0; color: var(--text-primary); text-align: center;">Convert Sorcery Points to Spell Slot</h3>
      <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 10px; font-weight: bold; color: var(--text-primary);">Create Spell Slot Level:</label>
        <select id="font-of-magic-slot" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid var(--border-color); border-radius: 6px; box-sizing: border-box; background: var(--bg-tertiary); color: var(--text-primary);">
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
        if (typeof showNotification !== 'undefined') {
          showNotification(`❌ Not enough Sorcery Points! Need ${cost}, have ${sorceryPoints.current}`, 'error');
        }
        return;
      }

      // Deduct sorcery points
      sorceryPoints.current -= cost;

      // Add spell slot
      const slotVar = `level${selectedLevel}SpellSlots`;
      const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
      const maxSlots = characterData.spellSlots?.[maxSlotVar] || 0;

      characterData.spellSlots[slotVar] = Math.min((characterData.spellSlots[slotVar] || 0) + 1, maxSlots);

      if (typeof saveCharacterData !== 'undefined') {
        saveCharacterData();
      }

      const currentSlots = characterData.spellSlots[slotVar];
      if (typeof showNotification !== 'undefined') {
        showNotification(`✨ Created Level ${selectedLevel} spell slot! (${sorceryPoints.current}/${sorceryPoints.max} SP left, ${currentSlots}/${maxSlots} slots)`);
      }

      // Announce to Roll20
      if (typeof getColoredBanner !== 'undefined') {
        const colorBanner = getColoredBanner(characterData);
        const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Sorcery Points to Spell Slot}} {{Result=Created Level ${selectedLevel} spell slot for ${cost} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            action: 'roll',
            characterName: characterData.name,
            message: message,
            color: characterData.notificationColor
          }, '*');
        }
      }

      document.body.removeChild(modal);
      if (typeof buildSheet !== 'undefined') {
        buildSheet(characterData); // Refresh display
      }
    });
  }

  // ===== CHANNEL DIVINITY SPELL SLOT RESTORATION =====

  /**
   * Show spell slot restoration modal (Harness Divine Power)
   */
  function showSpellSlotRestorationModal(channelDivinityResource, maxSlotLevel) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 400px; max-width: 500px;';

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
      <h3 style="margin: 0 0 15px 0; color: var(--text-primary); text-align: center;">🔮 Harness Divine Power</h3>
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

  /**
   * Restore a spell slot using Channel Divinity (Harness Divine Power)
   */
  function restoreSpellSlot(level, channelDivinityResource) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;

    if (!characterData.spellSlots) {
      if (typeof showNotification !== 'undefined') {
        showNotification('❌ No spell slots available!', 'error');
      }
      return;
    }

    const current = characterData.spellSlots[slotVar] || 0;
    const max = characterData.spellSlots[slotMaxVar] || 0;

    if (max === 0) {
      if (typeof showNotification !== 'undefined') {
        showNotification('❌ No spell slots at that level!', 'error');
      }
      return;
    }

    if (current >= max) {
      if (typeof showNotification !== 'undefined') {
        showNotification(`❌ Level ${level} spell slots already full!`, 'error');
      }
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

    if (typeof saveCharacterData !== 'undefined') {
      saveCharacterData();
    }
    if (typeof buildSheet !== 'undefined') {
      buildSheet(characterData);
    }

    // Announce to Roll20
    if (typeof getColoredBanner !== 'undefined') {
      const colorBanner = getColoredBanner(characterData);
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
          if (typeof browserAPI !== 'undefined') {
            browserAPI.runtime.sendMessage({
              action: 'relayRollToRoll20',
              roll: messageData
            });
          }
        }
      } else if (typeof browserAPI !== 'undefined') {
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    }

    if (typeof showNotification !== 'undefined') {
      showNotification(`🔮 Harness Divine Power! Restored Level ${level} spell slot. Channel Divinity: ${channelDivinityResource.current}/${channelDivinityResource.max}`);
    }
    debug.log(`✨ Harness Divine Power used to restore Level ${level} spell slot`);
  }

  // ===== EXPORTS =====

  globalThis.buildResourcesDisplay = buildResourcesDisplay;
  globalThis.adjustResource = adjustResource;
  globalThis.getSorceryPointsResource = getSorceryPointsResource;
  globalThis.getKiPointsResource = getKiPointsResource;
  globalThis.findResourceByVariableName = findResourceByVariableName;
  globalThis.getResourceCostsFromAction = getResourceCostsFromAction;
  globalThis.getKiCostFromAction = getKiCostFromAction;
  globalThis.getSorceryPointCostFromAction = getSorceryPointCostFromAction;
  globalThis.decrementActionResources = decrementActionResources;
  globalThis.showConvertSlotToPointsModal = showConvertSlotToPointsModal;
  globalThis.showFontOfMagicModal = showFontOfMagicModal;
  globalThis.showSpellSlotRestorationModal = showSpellSlotRestorationModal;
  globalThis.restoreSpellSlot = restoreSpellSlot;

})();
