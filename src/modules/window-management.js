/**
 * Window Management Module
 *
 * Handles popup window features:
 * - Window size persistence (save/restore dimensions)
 * - Status bar integration (toggle and data sync)
 * - Window state management
 *
 * This module manages the popup window's appearance and communication
 * with the Roll20 status bar overlay system.
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - saveWindowSize()
 * - loadWindowSize()
 * - initWindowSizeTracking()
 * - initStatusBarButton()
 * - sendStatusUpdate(targetWindow)
 *
 * State exported to globalThis:
 * - statusBarWindow (via getter/setter)
 */

(function() {
  'use strict';

  // ===== WINDOW SIZE PERSISTENCE =====

  /**
   * Save current window dimensions to storage
   */
  function saveWindowSize() {
    // Check if browserAPI is available
    if (typeof browserAPI === 'undefined' || !browserAPI) {
      debug.log('⚠️ browserAPI not available, skipping window size save');
      return;
    }

    const width = window.outerWidth;
    const height = window.outerHeight;

    browserAPI.storage.local.set({
      popupWindowSize: { width, height }
    });

    debug.log(`💾 Saved window size: ${width}x${height}`);
  }

  /**
   * Load and apply saved window dimensions
   */
  async function loadWindowSize() {
    // Check if browserAPI is available
    if (typeof browserAPI === 'undefined' || !browserAPI) {
      debug.log('⚠️ browserAPI not available, skipping window size restore');
      return;
    }

    try {
      const result = await browserAPI.storage.local.get(['popupWindowSize']);
      if (result.popupWindowSize) {
        const { width, height } = result.popupWindowSize;
        window.resizeTo(width, height);
        debug.log(`📐 Restored window size: ${width}x${height}`);
      }
    } catch (error) {
      debug.warn('⚠️ Could not restore window size:', error);
    }
  }

  /**
   * Initialize window size tracking
   * Loads saved size on startup and tracks changes
   */
  function initWindowSizeTracking() {
    // Load saved size on startup
    loadWindowSize();

    // Save size when window is resized
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        saveWindowSize();
      }, 500); // Debounce to avoid excessive saves
    });

    debug.log('📐 Window size tracking initialized');
  }

  // ===== STATUS BAR INTEGRATION =====

  // Reference to status bar window (if using window-based status bar)
  let statusBarWindow = null;

  /**
   * Initialize status bar button
   * Sets up click handler to toggle Roll20 GM panel overlay (status bar)
   */
  function initStatusBarButton() {
    const statusBarBtn = document.getElementById('status-bar-btn');
    if (statusBarBtn) {
      statusBarBtn.addEventListener('click', async () => {
        // Send message to Roll20 tabs to toggle the status bar overlay
        try {
          const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

          if (tabs.length === 0) {
            showNotification('⚠️ No Roll20 tabs found. Open Roll20 to use the status bar.', 'warning');
            return;
          }

          // Send toggle message to all Roll20 tabs
          for (const tab of tabs) {
            try {
              await browserAPI.tabs.sendMessage(tab.id, {
                action: 'toggleStatusBar',
                enabled: undefined  // Toggle current state
              });

              showNotification('📊 Status bar toggled', 'success');
              debug.log('📊 Status bar overlay toggled');
            } catch (error) {
              debug.warn('⚠️ Could not toggle status bar on tab:', error.message);
            }
          }
        } catch (error) {
          debug.error('❌ Failed to toggle status bar:', error);
          showNotification('❌ Failed to toggle status bar', 'error');
        }
      });
      debug.log('✅ Status bar button initialized');
    }
  }

  /**
   * Send status update to status bar window
   * @param {Window} targetWindow - Optional target window (defaults to statusBarWindow)
   */
  function sendStatusUpdate(targetWindow = null) {
    // Use provided target window or the stored statusBarWindow
    const target = targetWindow || statusBarWindow;

    if (!target || target.closed) {
      debug.log('📊 No valid status bar window to send to');
      return;
    }

    if (!characterData) {
      debug.log('📊 No character data available to send');
      return;
    }

    const statusData = {
      action: 'updateStatusData',
      data: {
        name: characterData.name || characterData.character_name,
        hitPoints: characterData.hitPoints || characterData.hit_points,
        temporaryHP: characterData.temporaryHP || 0,
        concentrating: !!concentratingSpell,
        concentrationSpell: concentratingSpell || '',
        activeBuffs: activeBuffs || [],
        activeDebuffs: activeConditions || [],
        spellSlots: characterData.spellSlots || {}
      }
    };

    target.postMessage(statusData, '*');
    debug.log('📊 Sent status update to status bar', statusData.data);
  }

  // ===== EXPORTS =====

  // Export statusBarWindow state variable
  Object.defineProperty(globalThis, 'statusBarWindow', {
    get: () => statusBarWindow,
    set: (value) => { statusBarWindow = value; },
    configurable: true
  });

  // Export functions to globalThis
  globalThis.saveWindowSize = saveWindowSize;
  globalThis.loadWindowSize = loadWindowSize;
  globalThis.initWindowSizeTracking = initWindowSizeTracking;
  globalThis.initStatusBarButton = initStatusBarButton;
  globalThis.sendStatusUpdate = sendStatusUpdate;

  debug.log('✅ Window Management module loaded');

  // ===== AUTO-INITIALIZATION =====

  // Initialize window size tracking when module loads
  // Check if we're in the main popup window context
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Initialize immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initWindowSizeTracking();
      });
    } else {
      // DOM already ready, but use pendingOperations if available
      if (typeof pendingOperations !== 'undefined' && !domReady) {
        pendingOperations.push(initWindowSizeTracking);
      } else {
        initWindowSizeTracking();
      }
    }
  }

})();
