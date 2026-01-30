/**
 * Warlock Invocations Module
 *
 * Handles detection and application of Warlock invocations that modify spells and abilities.
 * Provides a centralized system for checking active invocations and applying their effects.
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - getActiveInvocations(characterData)
 * - applyInvocationToSpell(spell, invocations, characterData)
 * - applyInvocationToDamage(spellName, damageFormula, invocations, characterData)
 */

(function() {
  'use strict';

  /**
   * Warlock invocations that modify spell behavior
   * Each entry defines the invocation name pattern and the effect it has
   */
  const INVOCATION_DEFINITIONS = {
    // Agonizing Blast: Add CHA modifier to Eldritch Blast damage
    AGONIZING_BLAST: {
      namePattern: /agonizing blast/i,
      affectsSpells: ['eldritch blast'],
      modifyDamage: (damage, characterData) => {
        const charismaMod = characterData.abilityMods?.charismaMod || 0;
        if (charismaMod === 0) return damage;

        const modifier = charismaMod >= 0 ? `+${charismaMod}` : `${charismaMod}`;
        return `${damage}${modifier}`;
      },
      description: 'Adds Charisma modifier to each Eldritch Blast beam'
    },

    // Repelling Blast: Push creatures 10 feet with Eldritch Blast
    REPELLING_BLAST: {
      namePattern: /repelling blast/i,
      affectsSpells: ['eldritch blast'],
      modifyDescription: (description) => {
        return description + '\n\n**Repelling Blast:** On a hit, push the target up to 10 feet away from you in a straight line.';
      },
      description: 'Push Eldritch Blast targets 10 feet away'
    },

    // Grasp of Hadar: Pull creatures 10 feet with Eldritch Blast
    GRASP_OF_HADAR: {
      namePattern: /grasp of hadar/i,
      affectsSpells: ['eldritch blast'],
      modifyDescription: (description) => {
        return description + '\n\n**Grasp of Hadar:** Once per turn when you hit with Eldritch Blast, pull the target up to 10 feet closer to you in a straight line.';
      },
      description: 'Pull Eldritch Blast target 10 feet closer (once per turn)'
    },

    // Lance of Lethargy: Reduce speed with Eldritch Blast
    LANCE_OF_LETHARGY: {
      namePattern: /lance of lethargy/i,
      affectsSpells: ['eldritch blast'],
      modifyDescription: (description) => {
        return description + '\n\n**Lance of Lethargy:** Once per turn when you hit with Eldritch Blast, reduce the target\'s speed by 10 feet until the end of your next turn.';
      },
      description: 'Reduce Eldritch Blast target speed by 10 feet (once per turn)'
    },

    // Eldritch Spear: Increase Eldritch Blast range to 300 feet
    ELDRITCH_SPEAR: {
      namePattern: /eldritch spear/i,
      affectsSpells: ['eldritch blast'],
      modifyRange: () => '300 feet',
      description: 'Increases Eldritch Blast range to 300 feet'
    }
  };

  /**
   * Get all active invocations for a character
   * @param {Object} characterData - The character data object
   * @returns {Array} Array of active invocation objects with their definitions
   */
  function getActiveInvocations(characterData) {
    if (!characterData || !characterData.features) {
      return [];
    }

    const activeInvocations = [];

    // Search through character features for invocations
    characterData.features.forEach(feature => {
      if (!feature.name) return;

      // Check if this feature matches any known invocation
      for (const [key, invocation] of Object.entries(INVOCATION_DEFINITIONS)) {
        if (invocation.namePattern.test(feature.name)) {
          activeInvocations.push({
            name: feature.name,
            key: key,
            definition: invocation
          });
          debug.log(`🔮 Detected warlock invocation: ${feature.name}`);
        }
      }
    });

    return activeInvocations;
  }

  /**
   * Check if a specific invocation is active
   * @param {String} invocationKey - The invocation key (e.g., 'AGONIZING_BLAST')
   * @param {Array} activeInvocations - Array of active invocations from getActiveInvocations()
   * @returns {Boolean} True if the invocation is active
   */
  function hasInvocation(invocationKey, activeInvocations) {
    return activeInvocations.some(inv => inv.key === invocationKey);
  }

  /**
   * Apply invocation modifications to a spell
   * This modifies spell properties based on active invocations
   * @param {Object} spell - The spell object to modify
   * @param {Array} invocations - Array of active invocations
   * @param {Object} characterData - The character data object
   * @returns {Object} Modified spell object (creates a shallow copy)
   */
  function applyInvocationToSpell(spell, invocations, characterData) {
    if (!spell || !invocations || invocations.length === 0) {
      return spell;
    }

    const spellNameLower = (spell.name || '').toLowerCase();
    let modifiedSpell = { ...spell };
    let hasModifications = false;

    // Check each active invocation
    invocations.forEach(invocation => {
      const def = invocation.definition;

      // Check if this invocation affects this spell
      if (!def.affectsSpells || !def.affectsSpells.some(s => spellNameLower.includes(s))) {
        return;
      }

      // Apply description modifications
      if (def.modifyDescription && modifiedSpell.description) {
        modifiedSpell.description = def.modifyDescription(modifiedSpell.description);
        hasModifications = true;
        debug.log(`🔮 Applied ${invocation.name} description to ${spell.name}`);
      }

      // Apply range modifications
      if (def.modifyRange) {
        modifiedSpell.range = def.modifyRange();
        hasModifications = true;
        debug.log(`🔮 Applied ${invocation.name} range to ${spell.name}`);
      }
    });

    return hasModifications ? modifiedSpell : spell;
  }

  /**
   * Apply invocation modifications to a damage formula
   * This is specifically for damage rolls that need modification
   * @param {String} spellName - Name of the spell being cast
   * @param {String} damageFormula - The base damage formula
   * @param {Array} invocations - Array of active invocations
   * @param {Object} characterData - The character data object
   * @returns {Object} { formula: modified formula, display: display formula }
   */
  function applyInvocationToDamage(spellName, damageFormula, invocations, characterData) {
    if (!damageFormula || !invocations || invocations.length === 0) {
      return { formula: damageFormula, display: damageFormula };
    }

    const spellNameLower = (spellName || '').toLowerCase();
    let modifiedFormula = damageFormula;
    let modifiedDisplay = damageFormula;
    let hasModifications = false;

    // Check each active invocation
    invocations.forEach(invocation => {
      const def = invocation.definition;

      // Check if this invocation affects this spell
      if (!def.affectsSpells || !def.affectsSpells.some(s => spellNameLower.includes(s))) {
        return;
      }

      // Apply damage modifications
      if (def.modifyDamage) {
        const modified = def.modifyDamage(modifiedFormula, characterData);
        if (modified !== modifiedFormula) {
          modifiedFormula = modified;
          modifiedDisplay = modified;
          hasModifications = true;
          debug.log(`🔮 Applied ${invocation.name} damage to ${spellName}: ${damageFormula} → ${modified}`);
        }
      }
    });

    return {
      formula: modifiedFormula,
      display: modifiedDisplay,
      modified: hasModifications
    };
  }

  // ===== EXPORTS =====

  // Export functions to globalThis
  globalThis.getActiveInvocations = getActiveInvocations;
  globalThis.hasInvocation = hasInvocation;
  globalThis.applyInvocationToSpell = applyInvocationToSpell;
  globalThis.applyInvocationToDamage = applyInvocationToDamage;

  debug.log('✅ Warlock Invocations module loaded');

})();
