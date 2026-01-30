/**
 * Concentration Tracker Module
 *
 * Manages spell concentration mechanics:
 * - Tracks which spell the character is concentrating on
 * - Displays concentration indicator UI
 * - Handles dropping concentration
 * - Auto-hides for non-spellcasters
 *
 * Concentration is a core D&D 5e mechanic where certain spells require
 * ongoing focus to maintain their effects. Only one concentration spell
 * can be active at a time.
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - updateConcentrationDisplay()
 * - initConcentrationTracker()
 * - setConcentration(spellName)
 * - dropConcentration()
 *
 * State exported to globalThis:
 * - concentratingSpell (via getter/setter)
 */

(function() {
  'use strict';

  // Track concentration state
  let concentratingSpell = null;

  /**
   * Update the concentration indicator UI
   * Shows/hides the concentration banner based on current state
   * Auto-hides for characters without spell slots (e.g., rogues, fighters)
   */
  function updateConcentrationDisplay() {
    const concentrationIndicator = document.getElementById('concentration-indicator');
    const concentrationSpell = document.getElementById('concentration-spell');

    if (!concentrationIndicator) return;

    // Hide concentration row if character has no spell slots (e.g., rogues)
    if (characterData && characterData.spellSlots) {
      const spellSlots = characterData.spellSlots;
      let hasSpellSlots = false;

      // Check for regular spell slots (levels 1-9)
      for (let level = 1; level <= 9; level++) {
        if ((spellSlots[`level${level}SpellSlotsMax`] || 0) > 0) {
          hasSpellSlots = true;
          break;
        }
      }

      // Also check for pact magic (warlocks)
      if ((spellSlots.pactMagicSlotsMax || 0) > 0) {
        hasSpellSlots = true;
      }

      // If no spell slots, hide the concentration tracker entirely
      if (!hasSpellSlots) {
        concentrationIndicator.style.display = 'none';
        return;
      }
    }

    // Show/hide based on concentration state
    if (concentratingSpell) {
      concentrationIndicator.style.display = 'flex';
      if (concentrationSpell) {
        concentrationSpell.textContent = concentratingSpell;
      }
    } else {
      concentrationIndicator.style.display = 'none';
    }
  }

  /**
   * Initialize concentration tracker button
   * Sets up click handler for the "Drop Concentration" button
   */
  function initConcentrationTracker() {
    const dropConcentrationBtn = document.getElementById('drop-concentration-btn');

    if (dropConcentrationBtn) {
      dropConcentrationBtn.addEventListener('click', () => {
        dropConcentration();
      });
    }

    debug.log('✅ Concentration tracker initialized');
  }

  /**
   * Set concentration on a spell
   * @param {string} spellName - Name of the spell to concentrate on
   */
  function setConcentration(spellName) {
    concentratingSpell = spellName;
    if (characterData) {
      characterData.concentrationSpell = spellName;
      saveCharacterData();
    }
    updateConcentrationDisplay();

    // Update status bar if available
    if (typeof sendStatusUpdate === 'function') {
      sendStatusUpdate();
    }

    showNotification(`🧠 Concentrating on: ${spellName}`);
    debug.log(`🧠 Concentration set: ${spellName}`);
  }

  /**
   * Drop concentration on the current spell
   */
  function dropConcentration() {
    if (!concentratingSpell) return;

    const spellName = concentratingSpell;
    concentratingSpell = null;
    if (characterData) {
      characterData.concentrationSpell = null;
      saveCharacterData();
    }
    updateConcentrationDisplay();

    // Update status bar if available
    if (typeof sendStatusUpdate === 'function') {
      sendStatusUpdate();
    }

    showNotification(`✅ Dropped concentration on ${spellName}`);
    debug.log(`🗑️ Concentration dropped: ${spellName}`);
  }

  // ===== EXPORTS =====

  // Export concentratingSpell state variable
  Object.defineProperty(globalThis, 'concentratingSpell', {
    get: () => concentratingSpell,
    set: (value) => { concentratingSpell = value; },
    configurable: true
  });

  // Export functions to globalThis
  globalThis.updateConcentrationDisplay = updateConcentrationDisplay;
  globalThis.initConcentrationTracker = initConcentrationTracker;
  globalThis.setConcentration = setConcentration;
  globalThis.dropConcentration = dropConcentration;

  debug.log('✅ Concentration Tracker module loaded');

})();
