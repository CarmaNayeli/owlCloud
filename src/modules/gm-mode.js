/**
 * GM Mode Module
 *
 * Handles GM (Game Master) mode features for Roll20 integration:
 * - GM Mode toggle (enables/disables GM panel overlay on Roll20)
 * - Character sharing (broadcasts full character sheet to GM via Roll20 chat)
 * - Read-only mode (hides controls when sheet is opened from GM panel)
 *
 * GM Mode allows the DM to:
 * - View a persistent overlay panel on Roll20 with player character stats
 * - Receive character broadcasts via encoded chat messages
 * - Open read-only character sheets from the GM panel
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - hideGMControls()
 * - initGMMode()
 * - initShowToGM()
 */

(function() {
  'use strict';

  /**
   * Hide GM controls when opened from GM panel (read-only mode)
   * This function is called when a character sheet is opened from the GM panel
   * to prevent the GM from modifying player character data.
   */
  function hideGMControls() {
    // Hide GM mode toggle
    const gmModeContainer = document.querySelector('.gm-mode-container');
    if (gmModeContainer) {
      gmModeContainer.style.display = 'none';
      debug.log('👑 Hidden GM mode toggle');
    }

    // Hide settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.style.display = 'none';
      debug.log('👑 Hidden settings button');
    }

    // Hide color picker
    const colorPickerContainer = document.querySelector('.color-picker-container');
    if (colorPickerContainer) {
      colorPickerContainer.style.display = 'none';
      debug.log('👑 Hidden color picker');
    }

    // Update title to indicate read-only mode
    const titleElement = document.querySelector('.char-name-section');
    if (titleElement) {
      titleElement.innerHTML = titleElement.innerHTML.replace('🎲 Character Sheet', '🎲 Character Sheet (Read Only)');
    }
  }

  /**
   * Initialize GM Mode toggle button
   * Toggles the GM panel overlay on Roll20 tabs
   */
  function initGMMode() {
    const gmModeToggle = document.getElementById('gm-mode-toggle');

    if (gmModeToggle) {
      gmModeToggle.addEventListener('click', () => {
        const isActive = gmModeToggle.classList.contains('active');

        // Send message to Roll20 content script to toggle GM panel
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            action: 'toggleGMMode',
            enabled: !isActive
          }, '*');
          debug.log(`👑 GM Mode ${!isActive ? 'enabled' : 'disabled'}`);
        } else {
          // Try via background script
          browserAPI.runtime.sendMessage({
            action: 'toggleGMMode',
            enabled: !isActive
          });
        }

        // Toggle active state
        gmModeToggle.classList.toggle('active');
        showNotification(isActive ? '👑 GM Mode disabled' : '👑 GM Mode enabled!');
      });

      debug.log('✅ GM Mode toggle initialized');
    }
  }

  /**
   * Initialize Show to GM button
   * Broadcasts complete character data to GM via Roll20 chat
   * The data is base64-encoded and wrapped in special markers for GM panel to detect
   */
  function initShowToGM() {
    const showToGMBtn = document.getElementById('show-to-gm-btn');

    if (showToGMBtn) {
      showToGMBtn.addEventListener('click', () => {
        if (!characterData) {
          showNotification('⚠️ No character data to share', 'warning');
          return;
        }

        try {
          // Create character broadcast message with ENTIRE sheet data
          const broadcastData = {
            type: 'ROLLCLOUD_CHARACTER_BROADCAST',
            character: characterData,
            // Include ALL character data for complete sheet
            fullSheet: {
              ...characterData,
              // Ensure all sections are included
              attributes: characterData.attributes || {},
              skills: characterData.skills || [],
              savingThrows: characterData.savingThrows || {},
              actions: characterData.actions || [],
              spells: characterData.spells || [],
              features: characterData.features || [],
              equipment: characterData.equipment || [],
              inventory: characterData.inventory || {},
              resources: characterData.resources || {},
              spellSlots: characterData.spellSlots || {},
              companions: characterData.companions || [],
              conditions: characterData.conditions || [],
              notes: characterData.notes || '',
              background: characterData.background || '',
              personality: characterData.personality || {},
              proficiencies: characterData.proficiencies || [],
              languages: characterData.languages || [],
              // Add simplified properties for popout compatibility
              hp: characterData.hitPoints?.current || characterData.hp || 0,
              maxHp: characterData.hitPoints?.max || characterData.maxHp || 0,
              ac: characterData.armorClass || characterData.ac || 10,
              initiative: characterData.initiative || 0,
              passivePerception: characterData.passivePerception || 10,
              proficiency: characterData.proficiencyBonus || characterData.proficiency || 0,
              speed: characterData.speed || '30 ft'
            },
            timestamp: new Date().toISOString()
          };

          // Encode the data for safe transmission (handle UTF-8 properly)
          const jsonString = JSON.stringify(broadcastData);
          const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
          const broadcastMessage = `👑[ROLLCLOUD:CHARACTER:${encodedData}]👑`;

          // Send to Roll20 chat via parent window
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              action: 'postChatMessageFromPopup',
              message: broadcastMessage
            }, '*');

            showNotification(`👑 ${characterData.name} shared with GM!`, 'success');
            debug.log('👑 Character broadcast sent to GM:', characterData.name);
          } else {
            // Try via background script
            browserAPI.runtime.sendMessage({
              action: 'postChatMessageFromPopup',
              message: broadcastMessage
            }).then(() => {
              showNotification(`👑 ${characterData.name} shared with GM!`, 'success');
              debug.log('👑 Character broadcast sent via background script:', characterData.name);
            }).catch(err => {
              debug.error('❌ Failed to send character broadcast:', err);
              showNotification('❌ Failed to share with GM', 'error');
            });
          }
        } catch (error) {
          debug.error('❌ Error creating character broadcast:', error);
          showNotification('❌ Failed to prepare character data', 'error');
        }
      });

      debug.log('✅ Show to GM button initialized in settings');
    } else {
      debug.warn('⚠️ Show to GM button not found in settings');
    }
  }

  // ===== EXPORTS =====

  // Export functions to globalThis
  globalThis.hideGMControls = hideGMControls;
  globalThis.initGMMode = initGMMode;
  globalThis.initShowToGM = initShowToGM;

  debug.log('✅ GM Mode module loaded');

})();
