/**
 * Action Display Module
 *
 * Handles rendering of actions and action cards.
 * Loaded as a plain script (no ES6 modules) to export to window.
 *
 * Functions exported to globalThis:
 * - buildActionsDisplay(container, actions)
 * - decrementActionUses(action)
 */

(function() {
  'use strict';

  // ===== MAIN DISPLAY FUNCTION =====

function buildActionsDisplay(container, actions) {
  // Clear container
  container.innerHTML = '';

  // Class feature toggle states
  let sneakAttackEnabled = false;
  let sneakAttackDamage = null;
  let elementalWeaponEnabled = false;
  let elementalWeaponDamage = null;

  // DEBUG: Log all actions to see what we have
  debug.log('🔍 buildActionsDisplay called with actions:', actions.map(a => ({ name: a.name, damage: a.damage, actionType: a.actionType })));
  debug.log('🔍 Total actions received:', actions.length);

  /**
   * Normalize action name by removing common suffixes that indicate variants
   * @param {string} name - The action name
   * @returns {string} Normalized name for deduplication
   */
  function normalizeActionName(name) {
    if (!name) return '';

    // Remove common suffixes that indicate the same ability but free/different action type
    const suffixPatterns = [
      /\s*\(free\)$/i,
      /\s*\(free action\)$/i,
      /\s*\(bonus action\)$/i,
      /\s*\(bonus\)$/i,
      /\s*\(reaction\)$/i,
      /\s*\(action\)$/i,
      /\s*\(no spell slot\)$/i,
      /\s*\(at will\)$/i
    ];

    let normalized = name.trim();
    for (const pattern of suffixPatterns) {
      normalized = normalized.replace(pattern, '');
    }

    return normalized.trim();
  }

  // Deduplicate actions by normalized name and combine sources (similar to spells)
  const deduplicatedActions = [];
  const actionsByNormalizedName = {};

  // Sort actions by name for consistent processing
  // Prefer base names without suffixes (shorter names first within same normalized group)
  const sortedActions = [...actions].sort((a, b) => {
    const normA = normalizeActionName(a.name || '');
    const normB = normalizeActionName(b.name || '');

    // First sort by normalized name
    if (normA !== normB) {
      return normA.localeCompare(normB);
    }

    // Within same normalized name, prefer shorter names (base versions)
    return (a.name || '').length - (b.name || '').length;
  });

  sortedActions.forEach(action => {
    const actionName = (action.name || '').trim();
    const normalizedName = normalizeActionName(actionName);

    if (!normalizedName) {
      debug.log('⚠️ Skipping action with no name');
      return;
    }

    if (!actionsByNormalizedName[normalizedName]) {
      // First occurrence of this action (by normalized name)
      actionsByNormalizedName[normalizedName] = action;
      deduplicatedActions.push(action);
      debug.log(`📝 First occurrence of action: "${actionName}" (normalized: "${normalizedName}")`);
    } else {
      // Duplicate action - combine sources and other properties
      const existingAction = actionsByNormalizedName[normalizedName];
      
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
    const actionName = (action.name || '').toLowerCase();
    
    // Filter out duplicate Divine Smite entries - keep only the main one
    if (actionName.includes('divine smite')) {
      // Skip variants like "Divine Smite Level 1", "Divine Smite (Against Fiends, Critical) Level 1", etc.
      // Keep only the base "Divine Smite" entry
      if (actionName !== 'divine smite' && !actionName.match(/^divine smite$/)) {
        debug.log(`⏭️ Filtering out duplicate Divine Smite entry: ${action.name}`);
        return false;
      } else {
        debug.log(`✅ Keeping main Divine Smite entry: ${action.name}`);
      }
    }
    
    // Debug: Log all Lay on Hands related actions
    if (actionName.includes('lay on hands')) {
      const normalizedActionName = action.name.toLowerCase()
        .replace(/[^a-z0-9\s:]/g, '') // Remove special chars except colon and space
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      const normalizedSearch = 'lay on hands: heal';
      
      debug.log(`🔍 Found Lay on Hands action: "${action.name}"`);
      debug.log(`🔍 Normalized action name: "${normalizedActionName}"`);
      debug.log(`🔍 Normalized search term: "${normalizedSearch}"`);
      debug.log(`🔍 Do they match? ${normalizedActionName === normalizedSearch}`);
      debug.log(`🔍 Action object:`, action);
    }
    
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
    // Set default elemental weapon damage (typically 1d4, but can vary by spell slot)
    elementalWeaponDamage = '1d4';

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
      actionBtn.textContent = '✨ Use';
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
        // Check for Divine Smite special handling
        if (action.name.toLowerCase().includes('divine smite')) {
          showDivineSmiteModal(action);
          return;
        }
        
        // Check for Lay on Hands: Heal special handling
        const normalizedActionName = action.name.toLowerCase()
          .replace(/[^a-z0-9\s:]/g, '') // Remove special chars except colon and space
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        const normalizedSearch = 'lay on hands: heal';
        
        if (normalizedActionName === normalizedSearch) {
          debug.log(`💚 Lay on Hands: Heal action clicked: ${action.name}, showing custom modal`);
          debug.log(`💚 Normalized match: "${normalizedActionName}" === "${normalizedSearch}"`);
          const layOnHandsPool = getLayOnHandsResource();
          if (layOnHandsPool) {
            showLayOnHandsModal(layOnHandsPool);
          } else {
            showNotification('❌ No Lay on Hands pool resource found', 'error');
          }
          return;
        }
        
        // Fallback: Catch ANY Lay on Hands action for debugging
        if (action.name.toLowerCase().includes('lay on hands')) {
          debug.log(`🚨 FALLBACK: Caught Lay on Hands action: "${action.name}"`);
          debug.log(`🚨 This action didn't match 'lay on hands: heal' but contains 'lay on hands'`);
          debug.log(`🚨 Showing modal anyway for debugging`);
          const layOnHandsPool = getLayOnHandsResource();
          if (layOnHandsPool) {
            showLayOnHandsModal(layOnHandsPool);
          } else {
            showNotification('❌ No Lay on Hands pool resource found', 'error');
          }
          return;
        }
        
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
      let actionAnnounced = false; // Track if action has been announced
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
          // Check for Divine Smite special handling
          if (action.name.toLowerCase().includes('divine smite')) {
            showDivineSmiteModal(action);
            return;
          }
          
          // Check for Lay on Hands: Heal special handling
          const normalizedActionName = action.name.toLowerCase()
            .replace(/[^a-z0-9\s:]/g, '') // Remove special chars except colon and space
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
          const normalizedSearch = 'lay on hands: heal';
          
          if (normalizedActionName === normalizedSearch) {
            debug.log(`💚 Lay on Hands: Heal action clicked: ${action.name}, showing custom modal`);
            debug.log(`💚 Normalized match: "${normalizedActionName}" === "${normalizedSearch}"`);
            const layOnHandsPool = getLayOnHandsResource();
            if (layOnHandsPool) {
              showLayOnHandsModal(layOnHandsPool);
            } else {
              showNotification('❌ No Lay on Hands pool resource found', 'error');
            }
            return;
          }
          
          // Fallback: Catch ANY Lay on Hands action for debugging
          if (action.name.toLowerCase().includes('lay on hands')) {
            debug.log(`🚨 FALLBACK: Caught Lay on Hands action: "${action.name}"`);
            debug.log(`🚨 This action didn't match 'lay on hands: heal' but contains 'lay on hands'`);
            debug.log(`🚨 Showing modal anyway for debugging`);
            const layOnHandsPool = getLayOnHandsResource();
            if (layOnHandsPool) {
              showLayOnHandsModal(layOnHandsPool);
            } else {
              showNotification('❌ No Lay on Hands pool resource found', 'error');
            }
            return;
          }
          
          // Announce the action on the FIRST button click only
          if (!actionAnnounced) {
            announceAction(action);
            actionAnnounced = true;
          }
          
          // Handle different option types
          if (option.type === 'attack') {
            // Mark action as used for attacks
            markActionAsUsed('action');

            // Attack roll is just the d20 + modifiers, no damage dice
            debug.log(`🎯 Attack button clicked for "${action.name}", formula: "${option.formula}"`);
            console.log(`🎯 ATTACK DEBUG: Rolling attack for ${action.name} with formula ${option.formula}`);

            try {
              roll(`${action.name} Attack`, option.formula);
              debug.log(`✅ Attack roll called successfully for "${action.name}"`);
            } catch (error) {
              debug.error(`❌ Error rolling attack for "${action.name}":`, error);
              console.error('❌ ATTACK ERROR:', error);
              showNotification(`❌ Error rolling attack: ${error.message}`, 'error');
            }
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

            // Roll the damage/healing
            const rollType = option.type === 'healing' ? 'Healing' : (option.type === 'temphp' ? 'Temp HP' : 'Damage');
            let damageFormula = option.formula;

            // Add Sneak Attack if toggle is enabled and this is a damage roll (not healing/temphp)
            if (option.type === 'damage' && sneakAttackEnabled && sneakAttackDamage && action.attackRoll) {
              damageFormula += `+${sneakAttackDamage}`;
              debug.log(`🎯 Adding Sneak Attack to ${action.name} damage: ${damageFormula}`);
            }

            // Add Elemental Weapon if toggle is enabled and this is a damage roll
            if (option.type === 'damage' && elementalWeaponEnabled && elementalWeaponDamage && action.attackRoll) {
              damageFormula += `+${elementalWeaponDamage}`;
              debug.log(`⚔️ Adding Elemental Weapon to ${action.name} damage: ${damageFormula}`);
            }

            roll(`${action.name} ${rollType}`, damageFormula);
          }
        });

        buttonsDiv.appendChild(actionBtn);
      });
    }

    // Add "Use" button for actions with no attack/damage options
    // Show for any action that should be usable (has description OR is a valid action type)
    if (actionOptions.length === 0 && !actionOptionsResult.skipNormalButtons) {
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

    // Add Details button if there's a description
    if (action.description) {
      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'details-btn';
      detailsBtn.textContent = '📋 Details';
      detailsBtn.style.cssText = `
        background: #34495e;
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
      detailsBtn.addEventListener('click', () => {
        const descDiv = actionCard.querySelector('.action-description');
        if (descDiv) {
          descDiv.style.display = descDiv.style.display === 'none' ? 'block' : 'none';
          detailsBtn.textContent = descDiv.style.display === 'none' ? '📋 Details' : '📋 Hide';
        }
      });
      buttonsDiv.appendChild(detailsBtn);
    }

    // Append nameDiv and buttonsDiv to actionHeader
    actionHeader.appendChild(nameDiv);
    actionHeader.appendChild(buttonsDiv);

    // Append actionHeader to actionCard
    actionCard.appendChild(actionHeader);

    // Add description if available (hidden by default, toggled by Details button)
    if (action.description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'action-description';
      descDiv.style.display = 'none'; // Hidden by default
      // Resolve any variables in the description (like {bardicInspirationDie})
      const resolvedDescription = resolveVariablesInFormula(action.description);
      descDiv.innerHTML = `
        <div style="margin-top: 10px; padding: 10px; background: var(--bg-secondary, #f5f5f5); border-radius: 4px; font-size: 0.9em;">${resolvedDescription}</div>
      `;

      actionCard.appendChild(descDiv);
    }

    container.appendChild(actionCard);
  });
}

// Note: Inventory functions (rebuildInventory, buildInventoryDisplay, createInventoryCard)
// are now provided by inventory-manager.js

// buildCompanionsDisplay is now in modules/companions-manager.js

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

  // ===== EXPORTS =====

  window.buildActionsDisplay = buildActionsDisplay;
  window.decrementActionUses = decrementActionUses;

  console.log('✅ Action Display module loaded');

})();
