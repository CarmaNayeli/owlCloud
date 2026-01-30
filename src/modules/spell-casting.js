/**
 * Spell Casting Module
 *
 * Handles all spell casting logic including:
 * - Main casting function with slot management
 * - Resource usage (spell slots, class resources, Pact Magic)
 * - Concentration tracking
 * - Metamagic cost calculation
 * - Spell announcements to chat
 * - Spell recovery mechanics
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 */

(function() {
  'use strict';

  // ===== CORE CASTING FUNCTIONS =====

  /**
   * Main spell casting function
   * Handles slot consumption, resource management, and executes afterCast callback
   *
   * @param {object} spell - Spell object
   * @param {number} index - Spell index
   * @param {function} afterCast - Callback to execute after casting (receives spell and slot)
   * @param {number|string|null} selectedSlotLevel - Level to cast at (or "pact:X" for Pact Magic)
   * @param {Array} selectedMetamagic - Array of metamagic options
   * @param {boolean} skipSlotConsumption - Whether to skip consuming a slot (concentration recast)
   * @param {boolean} skipAnnouncement - Whether to skip announcing the cast
   */
  function castSpell(spell, index, afterCast = null, selectedSlotLevel = null, selectedMetamagic = [], skipSlotConsumption = false, skipAnnouncement = false) {
    const debug = window.debug || console;
    debug.log('✨ Attempting to cast:', spell.name, spell, 'at level:', selectedSlotLevel, 'with metamagic:', selectedMetamagic, 'skipSlot:', skipSlotConsumption, 'skipAnnouncement:', skipAnnouncement);

    if (!characterData) {
      if (typeof showNotification === 'function') {
        showNotification('❌ Character data not available', 'error');
      }
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

    // Check if spell doesn't require spell slots (DiceCloud toggle or resource consumption)
    const isFreeSpell = (spell.castWithoutSpellSlots === true) || (
      spell.resources &&
      spell.resources.itemsConsumed &&
      spell.resources.itemsConsumed.length > 0
    );

    // Cantrips (level 0), magic item spells, free spells, or concentration recast don't need slots
    if (!spell.level || spell.level === 0 || spell.level === '0' || isMagicItemSpell || isFreeSpell || skipSlotConsumption) {
      const reason = skipSlotConsumption ? 'concentration recast' : (isMagicItemSpell ? 'magic item' : (isFreeSpell ? 'free spell' : 'cantrip'));
      debug.log(`✨ Casting ${reason} (no spell slot needed)`);

      if (!skipAnnouncement && typeof announceSpellCast === 'function') {
        announceSpellCast(spell, skipSlotConsumption ? 'concentration recast (no slot)' : ((isMagicItemSpell || isFreeSpell) ? `${spell.source} (no slot)` : null));
      }

      if (typeof showNotification === 'function') {
        showNotification(`✨ ${skipSlotConsumption ? 'Using' : 'Cast'} ${spell.name}!`);
      }

      // Handle concentration
      if (spell.concentration && !skipSlotConsumption && typeof setConcentration === 'function') {
        setConcentration(spell.name);
      }

      // Track reuseable spells
      const shouldTrackAsReusable = typeof isReuseableSpell === 'function' && isReuseableSpell(spell.name, characterData);
      if (shouldTrackAsReusable && !skipSlotConsumption) {
        const castSpellsKey = `castSpells_${characterData.name}`;
        const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
        if (!castSpells.includes(spell.name)) {
          castSpells.push(spell.name);
          localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
          debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
        }
      }

      // Execute afterCast with a fake slot for magic items and free spells
      if (afterCast && typeof afterCast === 'function') {
        setTimeout(() => {
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
      const slotsObject = characterData.spellSlots || characterData;

      // Check if this is a Pact Magic slot (format: "pact:${level}")
      const isPactMagicSlot = typeof selectedSlotLevel === 'string' && selectedSlotLevel.startsWith('pact:');
      let actualLevel, slotVar, currentSlots, slotLabel;

      if (isPactMagicSlot) {
        // Parse pact magic slot level
        actualLevel = parseInt(selectedSlotLevel.split(':')[1]);
        slotVar = 'pactMagicSlots';
        currentSlots = slotsObject.pactMagicSlots ?? characterData.otherVariables?.pactMagicSlots ?? 0;
        // Pact Magic always casts at the pact slot level - no "upcasting" terminology
        slotLabel = `Pact Magic (level ${actualLevel})`;
        debug.log(`🔮 Using Pact Magic slot at level ${actualLevel}, current=${currentSlots}`);
      } else {
        // Regular spell slot
        actualLevel = parseInt(selectedSlotLevel);
        slotVar = `level${actualLevel}SpellSlots`;
        currentSlots = slotsObject[slotVar] || 0;
        const isUpcast = actualLevel > spellLevel;
        slotLabel = isUpcast ? `level ${actualLevel} slot (upcast from ${spellLevel})` : `level ${actualLevel} slot`;
      }

      if (currentSlots <= 0 && typeof showNotification === 'function') {
        showNotification(`❌ No ${slotLabel} remaining!`, 'error');
        return;
      }

      // Consume the slot
      if (currentSlots > 0) {
        if (isPactMagicSlot) {
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

        if (typeof saveCharacterData === 'function') {
          saveCharacterData();
        }
        if (typeof buildSheet === 'function') {
          buildSheet(characterData);
        }
      }

      // Apply metamagic costs
      if (selectedMetamagic && selectedMetamagic.length > 0) {
        debug.log('Metamagic selected:', selectedMetamagic);
        // Metamagic point deduction is handled elsewhere
      }

      // Update selectedSlotLevel to actual level for formula resolution
      selectedSlotLevel = actualLevel;

      if (!skipAnnouncement && typeof announceSpellCast === 'function') {
        announceSpellCast(spell, slotLabel);
      }

      if (typeof showNotification === 'function') {
        showNotification(`✨ Cast ${spell.name} using ${slotLabel}!`);
      }

      // Handle concentration
      if (spell.concentration && typeof setConcentration === 'function') {
        setConcentration(spell.name);
      }

      // Track reuseable spells
      const shouldTrackAsReusable = typeof isReuseableSpell === 'function' && isReuseableSpell(spell.name, characterData);
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

    // No slot level selected - check for Divine Smite or show upcast choice
    if (spell.name.toLowerCase().includes('divine smite') && typeof showDivineSmiteModal === 'function') {
      debug.log(`⚡ Divine Smite spell detected, showing custom modal`);
      showDivineSmiteModal(spell);
      return;
    }

    if (typeof showUpcastChoice === 'function') {
      showUpcastChoice(spell, spellLevel, afterCast);
    }
  }

  /**
   * Cast spell with a specific slot
   * @param {object} spell - Spell object
   * @param {object} slot - Slot object with level, current, max, slotVar, noSlotUsed
   * @param {Array} metamagicOptions - Selected metamagic options
   * @param {function} afterCast - Callback after casting
   */
  function castWithSlot(spell, slot, metamagicOptions = [], afterCast = null) {
    const debug = window.debug || console;

    // Deduct spell slot (unless casting without a slot)
    if (!slot.noSlotUsed && slot.slotVar) {
      characterData.spellSlots[slot.slotVar] = slot.current - 1;

      // Also update otherVariables for Pact Magic to keep in sync
      if (slot.isPactMagic && characterData.otherVariables?.pactMagicSlots !== undefined) {
        characterData.otherVariables.pactMagicSlots = slot.current - 1;
      }
    }

    // Deduct sorcery points for metamagic
    let totalMetamagicCost = 0;
    let metamagicNames = [];

    if (metamagicOptions && metamagicOptions.length > 0 && typeof getSorceryPointsResource === 'function') {
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

    if (typeof saveCharacterData === 'function') {
      saveCharacterData();
    }

    let resourceText;
    let notificationText;

    if (slot.noSlotUsed) {
      resourceText = `Level ${slot.level} (NO SLOT USED - slot not decremented)`;
      notificationText = `✨ Cast ${spell.name}! (no spell slot decremented)`;
      debug.log(`⚠️ Cast without slot - no slot decremented`);
    } else if (slot.isPactMagic) {
      resourceText = `Pact Magic (Level ${slot.level})`;
      debug.log(`✅ Used Pact Magic slot. Remaining: ${characterData.spellSlots[slot.slotVar]}/${slot.max}`);
      notificationText = `✨ Cast ${spell.name}! (${characterData.spellSlots[slot.slotVar]}/${slot.max} Pact slots left)`;
    } else if (slot.level > parseInt(spell.level)) {
      resourceText = `Level ${slot.level} slot (upcast from ${spell.level})`;
      debug.log(`✅ Used spell slot. Remaining: ${characterData.spellSlots[slot.slotVar]}/${slot.max}`);
      notificationText = `✨ Cast ${spell.name}! (${characterData.spellSlots[slot.slotVar]}/${slot.max} slots left)`;
    } else {
      resourceText = `Level ${slot.level} slot`;
      debug.log(`✅ Used spell slot. Remaining: ${characterData.spellSlots[slot.slotVar]}/${slot.max}`);
      notificationText = `✨ Cast ${spell.name}! (${characterData.spellSlots[slot.slotVar]}/${slot.max} slots left)`;
    }

    // Add metamagic to resource text
    if (metamagicNames.length > 0) {
      resourceText += ` + ${metamagicNames.join(', ')} (${totalMetamagicCost} SP)`;
      const sorceryPoints = getSorceryPointsResource();
      notificationText += ` with ${metamagicNames.join(', ')}! (${sorceryPoints.current}/${sorceryPoints.max} SP left)`;
    }

    if (typeof announceSpellCast === 'function') {
      announceSpellCast(spell, resourceText);
    }
    if (typeof showNotification === 'function') {
      showNotification(notificationText);
    }

    // Handle concentration
    if (spell.concentration && typeof setConcentration === 'function') {
      setConcentration(spell.name);
    }

    // Track reuseable spells
    const shouldTrackAsReusable = typeof isReuseableSpell === 'function' && isReuseableSpell(spell.name, characterData);
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
    if (typeof buildSheet === 'function') {
      buildSheet(characterData);
    }

    // Execute after-cast callback
    if (afterCast && typeof afterCast === 'function') {
      setTimeout(() => {
        afterCast(spell, slot);
      }, 300);
    }
  }

  /**
   * Use a class resource to cast a spell
   * @param {object} resource - Resource object with name, current, max, varName
   * @param {object} spell - Spell object
   * @returns {boolean} Whether the resource was successfully used
   */
  function useClassResource(resource, spell) {
    if (resource.current <= 0) {
      if (typeof showNotification === 'function') {
        showNotification(`❌ No ${resource.name} remaining!`, 'error');
      }
      return false;
    }

    characterData.otherVariables[resource.varName] = resource.current - 1;

    if (typeof saveCharacterData === 'function') {
      saveCharacterData();
    }

    const debug = window.debug || console;
    debug.log(`✅ Used ${resource.name}. Remaining: ${characterData.otherVariables[resource.varName]}/${resource.max}`);

    if (typeof showNotification === 'function') {
      showNotification(`✨ Cast ${spell.name}! (${characterData.otherVariables[resource.varName]}/${resource.max} ${resource.name} left)`);
    }

    // Handle concentration
    if (spell.concentration && typeof setConcentration === 'function') {
      setConcentration(spell.name);
    }

    // Track reuseable spells
    const shouldTrackAsReusable = typeof isReuseableSpell === 'function' && isReuseableSpell(spell.name, characterData);
    if (shouldTrackAsReusable) {
      const castSpellsKey = `castSpells_${characterData.name}`;
      const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
      if (!castSpells.includes(spell.name)) {
        castSpells.push(spell.name);
        localStorage.setItem(castSpellsKey, JSON.stringify(castSpells));
        debug.log(`✅ Tracked reuseable spell: ${spell.name}`);
      }
    }

    if (typeof buildSheet === 'function') {
      buildSheet(characterData);
    }

    return true;
  }

  /**
   * Detect available class resources that can be used for spell casting
   * @param {object} spell - Spell object
   * @returns {Array} Array of available class resources
   */
  function detectClassResources(spell) {
    if (typeof executorDetectClassResources === 'function') {
      return executorDetectClassResources(characterData);
    }
    return [];
  }

  // ===== SPELL ANNOUNCEMENTS =====

  /**
   * Announce spell description to chat
   * @param {object} spell - Spell object
   * @param {number|null} castLevel - Level the spell is being cast at
   */
  function announceSpellDescription(spell, castLevel = null) {
    const messageData = {
      action: 'announceSpell',
      spellName: spell.name,
      characterName: characterData.name,
      color: characterData.notificationColor,
      spellData: spell,
      castLevel: castLevel
    };

    const debug = window.debug || console;

    // Try window.opener first (Chrome)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
        debug.log('✅ Spell data sent via window.opener');
        return;
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
      }
    }

    // Fallback: Use background script to relay to Roll20 (Firefox)
    if (typeof browserAPI !== 'undefined') {
      debug.log('📡 Using background script to relay spell data to Roll20...');
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      }, (response) => {
        if (browserAPI.runtime.lastError) {
          debug.error('❌ Error relaying spell announcement:', browserAPI.runtime.lastError);
        } else if (response && response.success) {
          debug.log('✅ Spell data announced to Roll20');
        }
      });
    }
  }

  /**
   * Announce spell cast with resource usage
   * @param {object} spell - Spell object
   * @param {string|null} resourceUsed - Description of resource used
   */
  function announceSpellCast(spell, resourceUsed) {
    const debug = window.debug || console;

    // Check if spell has damage rolls (buttons will be shown)
    const hasDamageRolls = spell.damageRolls && spell.damageRolls.length > 0;

    // Build the announcement message
    const colorBanner = typeof getColoredBanner === 'function' ? getColoredBanner(characterData) : '';
    let message = `&{template:default} {{name=${colorBanner}${characterData.name} casts ${spell.name}!}}`;

    // Add resource usage if specified
    if (resourceUsed) {
      message += ` {{Resource Used=${resourceUsed}}}`;
    }

    const messageData = {
      action: 'announceSpell',
      spellName: spell.name,
      characterName: characterData.name,
      message: message,
      color: characterData.notificationColor
    };

    // Send announcement to Roll20
    // Try window.opener first (Chrome)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
        debug.log('✅ Spell announcement sent via window.opener');
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
        // Fallback
        if (typeof browserAPI !== 'undefined') {
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
    } else if (typeof browserAPI !== 'undefined') {
      // Fallback
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      }, (response) => {
        if (browserAPI.runtime.lastError) {
          debug.error('❌ Error relaying spell announcement:', browserAPI.runtime.lastError);
        }
      });
    }

    // Only auto-roll if there are NO damage rolls (no buttons)
    // If there are damage rolls, the modal will handle rolling when buttons are clicked
    if (spell.formula && typeof roll === 'function' && !hasDamageRolls) {
      debug.log('✨ Auto-rolling spell formula (no damage rolls - no buttons)', spell.name);
      setTimeout(() => {
        roll(spell.name, spell.formula);
      }, 500);
    } else if (hasDamageRolls) {
      debug.log('✨ Spell has damage rolls - skipping auto-roll, modal buttons will handle it', spell.name);
    }
  }

  // ===== SPELL HELPERS =====

  /**
   * Get spellcasting ability modifier based on character class
   * @returns {number} Spellcasting ability modifier
   */
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

  /**
   * Calculate spell attack bonus
   * @returns {number} Spell attack bonus
   */
  function getSpellAttackBonus() {
    const spellMod = getSpellcastingAbilityMod();
    const profBonus = characterData.proficiencyBonus || 0;
    return spellMod + profBonus;
  }

  /**
   * Calculate metamagic cost for a given metamagic option and spell level
   * @param {string} metamagicName - Name of the metamagic
   * @param {number} spellLevel - Level of the spell
   * @returns {number} Cost in sorcery points
   */
  function calculateMetamagicCost(metamagicName, spellLevel) {
    // Use executor function if available
    if (typeof executorCalculateMetamagicCost === 'function') {
      return executorCalculateMetamagicCost(metamagicName, spellLevel);
    }

    // Fallback implementation
    switch (metamagicName) {
      case 'Twinned Spell':
        return spellLevel === 0 ? 1 : spellLevel; // Cantrips cost 1, leveled spells cost spell level
      case 'Heightened Spell':
        return 3;
      case 'Quickened Spell':
        return 2;
      case 'Careful Spell':
      case 'Distant Spell':
      case 'Extended Spell':
      case 'Subtle Spell':
        return 1;
      case 'Empowered Spell':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get available metamagic options for character
   * @returns {Array} Array of available metamagic options
   */
  function getAvailableMetamagic() {
    if (typeof executorGetAvailableMetamagic === 'function') {
      return executorGetAvailableMetamagic(characterData);
    }
    return [];
  }

  /**
   * Handle recover spell slot (Arcane Recovery, etc.)
   * @param {object} action - Action object
   */
  function handleRecoverSpellSlot(action) {
    // Calculate max recoverable level from proficiency bonus
    const profBonus = characterData.proficiencyBonus || 2;
    const maxLevel = Math.ceil(profBonus / 2);

    const debug = window.debug || console;
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
      if (typeof showNotification === 'function') {
        showNotification(`❌ No spell slots to recover (max level: ${maxLevel})`, 'error');
      }
      return;
    }

    // If only one eligible slot, recover it automatically
    if (eligibleSlots.length === 1) {
      recoverSpellSlot(eligibleSlots[0], action, maxLevel);
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
      if (typeof showNotification === 'function') {
        showNotification('❌ Invalid choice', 'error');
      }
      return;
    }

    recoverSpellSlot(eligibleSlots[choiceIndex], action, maxLevel);
  }

  /**
   * Recover a spell slot
   * @param {object} slot - Slot object with level, current, max, slotKey
   * @param {object} action - Action object
   * @param {number} maxLevel - Maximum level that can be recovered
   */
  function recoverSpellSlot(slot, action, maxLevel) {
    // Increment the spell slot
    characterData[slot.slotKey] = Math.min(characterData[slot.slotKey] + 1, characterData[slot.maxKey]);

    if (typeof saveCharacterData === 'function') {
      saveCharacterData();
    }

    // Create description with resolved formula
    const description = `You expend a use of your Channel Divinity to fuel your spells. As a bonus action, you touch your holy symbol, utter a prayer, and regain one expended spell slot, the level of which can be no higher than ${maxLevel}.`;

    // Announce the action
    if (typeof announceAction === 'function') {
      announceAction({
        name: action.name,
        description: description,
        actionType: action.actionType || 'bonus'
      });
    }

    if (typeof showNotification === 'function') {
      showNotification(`🔮 Recovered Level ${slot.level} Spell Slot (${characterData[slot.slotKey]}/${characterData[slot.maxKey]})`, 'success');
    }

    // Refresh display
    if (typeof buildSheet === 'function') {
      buildSheet(characterData);
    }
  }

  // Export functions to globalThis
  Object.assign(globalThis, {
    // Core casting
    castSpell,
    castWithSlot,
    useClassResource,
    detectClassResources,

    // Announcements
    announceSpellDescription,
    announceSpellCast,

    // Helpers
    getSpellcastingAbilityMod,
    getSpellAttackBonus,
    calculateMetamagicCost,
    getAvailableMetamagic,
    handleRecoverSpellSlot,
    recoverSpellSlot
  });

  console.log('✅ Spell Casting module loaded');

})();
