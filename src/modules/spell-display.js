/**
 * Spell Display Module
 *
 * Handles spell list display, organization, and filtering.
 * - Builds spell list organized by level
 * - Applies filters (level, category, casting time, search)
 * - Categorizes spells (damage/healing/utility)
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 */

(function() {
  'use strict';

  /**
   * Build and display spells organized by level
   * @param {HTMLElement} container - Container element for spells
   * @param {Array} spells - Array of spell objects
   */
  function buildSpellsBySource(container, spells) {
    if (typeof characterData === 'undefined' || !characterData) {
      console.error('characterData not available');
      return;
    }

    const debug = window.debug || console;
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
      // Filter out duplicate Divine Smite entries - keep only the main one
      const spellName = (spell.name || '').toLowerCase();
      if (spellName.includes('divine smite')) {
        // Skip variants like "Divine Smite Level 1", "Divine Smite (Against Fiends, Critical) Level 1", etc.
        // Keep only the base "Divine Smite" entry
        if (spellName !== 'divine smite' && !spellName.match(/^divine smite$/)) {
          debug.log(`⏭️ Filtering out duplicate Divine Smite spell: ${spell.name}`);
          return false;
        } else {
          debug.log(`✅ Keeping main Divine Smite spell: ${spell.name}`);
        }
      }

      // Filter by spell level
      if (window.spellFilters && window.spellFilters.level !== 'all') {
        const spellLevel = parseInt(spell.level) || 0;
        if (spellLevel.toString() !== window.spellFilters.level) {
          return false;
        }
      }

      // Filter by category
      if (window.spellFilters && window.spellFilters.category !== 'all') {
        const category = categorizeSpell(spell);
        if (category !== window.spellFilters.category) {
          return false;
        }
      }

      // Filter by casting time
      if (window.spellFilters && window.spellFilters.castingTime !== 'all') {
        const castingTime = (spell.castingTime || '').toLowerCase();
        if (window.spellFilters.castingTime === 'action') {
          // Match "action" but exclude "bonus action" and "reaction"
          if (!castingTime.includes('action') || castingTime.includes('bonus') || castingTime.includes('reaction')) {
            return false;
          }
        }
        if (window.spellFilters.castingTime === 'bonus' && !castingTime.includes('bonus')) {
          return false;
        }
        if (window.spellFilters.castingTime === 'reaction' && !castingTime.includes('reaction')) {
          return false;
        }
      }

      // Filter by search term
      if (window.spellFilters && window.spellFilters.search) {
        const searchLower = window.spellFilters.search;
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
      levelHeader.style.cssText = 'color: var(--text-primary); margin-bottom: 10px; padding: 5px; background: var(--bg-secondary, #ecf0f1); border-radius: 4px;';
      levelSection.appendChild(levelHeader);

      // Sort spells alphabetically within level
      const sortedSpells = spellsByLevel[levelKey].sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '');
      });

      // Deduplicate spells by name and combine sources
      const deduplicatedSpells = [];
      const spellsByName = {};

      debug.log(`📚 Deduplicating ${sortedSpells.length} spells in ${levelKey}`, sortedSpells.map(s => s.name));
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
      debug.log(`📚 After deduplication: ${deduplicatedSpells.length} unique spells in ${levelKey}`, deduplicatedSpells.map(s => s.name));

      // Add deduplicated spells
      deduplicatedSpells.forEach(spell => {
        if (typeof createSpellCard === 'function') {
          const spellCard = createSpellCard(spell, spell.index);
          levelSection.appendChild(spellCard);
        } else {
          debug.warn('createSpellCard function not available');
        }
      });

      container.appendChild(levelSection);
    });
  }

  /**
   * Rebuild spells with current filters
   */
  function rebuildSpells() {
    if (!characterData || !characterData.spells) return;
    const container = document.getElementById('spells-container');
    buildSpellsBySource(container, characterData.spells);
  }

  /**
   * Categorize a spell as damage, healing, or utility
   * @param {object} spell - Spell object
   * @returns {string} Category: 'damage', 'healing', or 'utility'
   */
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

  /**
   * Initialize spell filter event listeners
   */
  function initializeSpellFilters() {
    // Initialize spell filters object
    if (!window.spellFilters) {
      window.spellFilters = {
        level: 'all',
        category: 'all',
        castingTime: 'all',
        search: ''
      };
    }

    // Spell search filter
    const spellsSearch = document.getElementById('spells-search');
    if (spellsSearch) {
      spellsSearch.addEventListener('input', (e) => {
        window.spellFilters.search = e.target.value.toLowerCase();
        rebuildSpells();
      });
    }

    // Spell level filters
    document.querySelectorAll('[data-type="spell-level"]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.spellFilters.level = btn.dataset.filter;
        document.querySelectorAll('[data-type="spell-level"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rebuildSpells();
      });
    });

    // Spell category filters
    document.querySelectorAll('[data-type="spell-category"]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.spellFilters.category = btn.dataset.filter;
        document.querySelectorAll('[data-type="spell-category"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rebuildSpells();
      });
    });

    // Spell casting time filters
    document.querySelectorAll('[data-type="spell-casting-time"]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.spellFilters.castingTime = btn.dataset.filter;
        document.querySelectorAll('[data-type="spell-casting-time"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rebuildSpells();
      });
    });

    debug.log('✅ Spell filters initialized');
  }

  // Export functions to globalThis
  Object.assign(globalThis, {
    buildSpellsBySource,
    rebuildSpells,
    categorizeSpell,
    initializeSpellFilters
  });

  console.log('✅ Spell Display module loaded');

})();
