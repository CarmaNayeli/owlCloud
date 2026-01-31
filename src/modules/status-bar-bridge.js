/**
 * Status Bar Bridge Module
 *
 * Handles communication between the main character sheet and the status bar popup.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - initStatusBarButton()
 * - sendStatusUpdate()
 * - statusBarWindow (variable)
 */

(function() {
  'use strict';

  // Track status bar window
  let statusBarWindow = null;

  /**
   * Initialize status bar button
   * Must be called after DOM is ready
   */
  function initStatusBarButton() {
    const statusBarBtn = document.getElementById('status-bar-btn');
    if (statusBarBtn) {
      statusBarBtn.addEventListener('click', () => {
        // Check if browserAPI is available
        if (typeof browserAPI === 'undefined' || !browserAPI) {
          if (typeof showNotification !== 'undefined') {
            showNotification('❌ Extension API not available', 'error');
          }
          debug.warn('⚠️ browserAPI not available');
          return;
        }

        // Open status bar window
        const width = 350;
        const height = 500;
        const left = window.screenX + window.outerWidth - width - 50;
        const top = window.screenY + 50;

        statusBarWindow = window.open(
          browserAPI.runtime.getURL('src/status-bar.html'),
          'status-bar',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=no,resizable=yes`
        );

        if (!statusBarWindow) {
          if (typeof showNotification !== 'undefined') {
            showNotification('❌ Failed to open status bar - please allow popups', 'error');
          }
          return;
        }

        debug.log('📊 Status bar opened');

        // Send initial data after a short delay
        setTimeout(() => {
          sendStatusUpdate();
        }, 500);
      });
      debug.log('✅ Status bar button initialized');
    }
  }

  /**
   * Send status update to status bar window
   * Requires characterData to be available in global scope
   */
  function sendStatusUpdate() {
    if (!statusBarWindow || statusBarWindow.closed) return;

    // characterData should be available from popup-sheet.js global scope
    if (typeof characterData === 'undefined') {
      debug.warn('⚠️ characterData not available for status update');
      return;
    }

    const statusData = {
      action: 'updateStatusData',
      data: {
        name: characterData.name || characterData.character_name,
        hitPoints: characterData.hitPoints || characterData.hit_points,
        concentrating: characterData.concentrating || false,
        concentrationSpell: characterData.concentrationSpell || '',
        activeBuffs: characterData.activeBuffs || [],
        activeDebuffs: characterData.activeDebuffs || [],
        spellSlots: characterData.spellSlots || {}
      }
    };

    statusBarWindow.postMessage(statusData, '*');
    debug.log('📊 Sent status update to status bar');
  }

  // Export to globalThis
  globalThis.initStatusBarButton = initStatusBarButton;
  globalThis.sendStatusUpdate = sendStatusUpdate;
  globalThis.statusBarWindow = statusBarWindow;

})();
