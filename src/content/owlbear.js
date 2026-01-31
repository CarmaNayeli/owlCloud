/**
 * Owlbear Rodeo Content Script for OwlCloud Extension
 *
 * This content script runs on Owlbear Rodeo pages and:
 * 1. Detects when the browser extension is active
 * 2. Adds a OwlCloud button to the Owlbear UI
 * 3. Opens a character sheet overlay using the extension's popup modules
 * 4. Integrates with Owlbear Rodeo through the SDK
 *
 * Architecture:
 * - Browser Extension Content Script (this file) - Injects UI into Owlbear
 * - Owlbear Extension (separate) - Uses SDK to interact with Owlbear scene
 * - Communication via window.postMessage for cross-context messaging
 */

/* global browserAPI, debug */

// ============== Initialization ==============

let characterSheetWindow = null;
let currentCharacter = null;
let isOwlbearReady = false;

debug.log('🦉 OwlCloud Owlbear content script loaded');

// ============== Owlbear Detection ==============

/**
 * Wait for Owlbear Rodeo to be fully loaded
 */
function waitForOwlbear() {
  return new Promise((resolve) => {
    // Check if Owlbear is already loaded
    if (document.readyState === 'complete') {
      debug.log('🦉 Owlbear Rodeo page ready');
      resolve();
      return;
    }

    // Wait for page to be fully loaded
    window.addEventListener('load', () => {
      debug.log('🦉 Owlbear Rodeo page loaded');
      resolve();
    });
  });
}

// ============== UI Injection ==============

/**
 * Create and inject the OwlCloud button into Owlbear's UI
 */
function injectOwlCloudButton() {
  // Check if button already exists
  if (document.getElementById('owlcloud-button')) {
    debug.log('🦉 OwlCloud button already exists');
    return;
  }

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'owlcloud-button';
  buttonContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Create button
  const button = document.createElement('button');
  button.id = 'owlcloud-toggle';
  button.innerHTML = '🎲 OwlCloud';
  button.title = 'Open OwlCloud Character Sheet';
  button.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Button hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  });

  // Button click handler
  button.addEventListener('click', () => {
    toggleCharacterSheet();
  });

  buttonContainer.appendChild(button);
  document.body.appendChild(buttonContainer);

  debug.log('🦉 OwlCloud button injected into Owlbear UI');
}

// ============== Character Sheet Window ==============

/**
 * Toggle the character sheet overlay
 */
function toggleCharacterSheet() {
  if (characterSheetWindow && !characterSheetWindow.closed) {
    characterSheetWindow.close();
    characterSheetWindow = null;
    debug.log('🦉 Character sheet closed');
  } else {
    openCharacterSheet();
  }
}

/**
 * Open the character sheet overlay
 */
async function openCharacterSheet() {
  try {
    // Get active character from extension storage
    const response = await browserAPI.runtime.sendMessage({
      action: 'getActiveCharacter'
    });

    if (!response || !response.success) {
      showNotification('No active character selected. Please select a character in the OwlCloud popup.', 'error');
      return;
    }

    currentCharacter = response.character;

    // Create character sheet window/overlay
    // TODO: Implement character sheet display using extension popup modules
    // For now, we'll create a basic overlay that can be enhanced
    createCharacterSheetOverlay();

    debug.log('🦉 Character sheet opened for:', currentCharacter.name);
  } catch (error) {
    debug.error('❌ Error opening character sheet:', error);
    showNotification('Failed to open character sheet', 'error');
  }
}

/**
 * Create character sheet overlay in the page
 */
function createCharacterSheetOverlay() {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('owlcloud-character-sheet');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'owlcloud-character-sheet';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Create sheet container
  const sheetContainer = document.createElement('div');
  sheetContainer.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 800px;
    height: 90%;
    max-height: 800px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const title = document.createElement('h2');
  title.textContent = currentCharacter?.name || 'Character Sheet';
  title.style.cssText = 'margin: 0; font-size: 24px; font-weight: 600;';

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '✕';
  closeButton.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `;
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
  });
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
  });
  closeButton.addEventListener('click', () => {
    overlay.remove();
  });

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content area
  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  `;

  // TODO: Load actual character sheet using extension's popup modules
  // For now, show placeholder
  content.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <h3 style="color: #667eea; margin-bottom: 16px;">Character Sheet Integration</h3>
      <p style="color: #666; margin-bottom: 20px;">
        This will display your DiceCloud character sheet using the OwlCloud extension modules.
      </p>
      <p style="color: #999; font-size: 14px;">
        TODO: Integrate popup modules (sheet-builder.js, action-display.js, etc.)
      </p>
    </div>
  `;

  sheetContainer.appendChild(header);
  sheetContainer.appendChild(content);
  overlay.appendChild(sheetContainer);

  // Close on overlay click (but not on sheet click)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

// ============== Dice Rolling Integration ==============

/**
 * Post a dice roll to Owlbear (via Owlbear extension)
 * This will be implemented when the Owlbear extension is built
 */
function postRollToOwlbear(rollData) {
  // TODO: Communicate with Owlbear extension to display roll in Owlbear UI
  // This will use window.postMessage or the Owlbear SDK
  debug.log('🎲 Roll to Owlbear (TODO):', rollData);

  showNotification(`Rolled ${rollData.name}: ${rollData.formula}`, 'success');
}

// ============== Message Handlers ==============

/**
 * Listen for messages from the background script
 */
browserAPI.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debug.log('📨 Owlbear content script received message:', request.action);

  switch (request.action) {
    case 'postRollToChat':
      // Roll dice and post to Owlbear
      postRollToOwlbear(request.roll);
      sendResponse({ success: true });
      break;

    case 'showCharacterSheet':
      // Open character sheet overlay
      openCharacterSheet();
      sendResponse({ success: true });
      break;

    case 'closeCharacterSheet':
      // Close character sheet
      if (document.getElementById('owlcloud-character-sheet')) {
        document.getElementById('owlcloud-character-sheet').remove();
      }
      sendResponse({ success: true });
      break;

    case 'characterSelected': {
      // Character was selected in popup - send to Supabase with Owlbear player ID
      try {
        // Check if OBR SDK is available (it should be on Owlbear pages)
        if (typeof OBR === 'undefined') {
          console.error('❌ OBR SDK not available on this page');
          sendResponse({ success: false, error: 'OBR SDK not available' });
          break;
        }

        await OBR.onReady();
        const playerId = await OBR.player.getId();

        console.log('🎭 Sending character to Supabase with player ID:', playerId);

        // Send character to Supabase
        const response = await fetch(
          'https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/set-active-character',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owlbearPlayerId: playerId,
              character: request.character
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          console.log('✅ Character saved to Supabase');
          sendResponse({ success: true });
        } else {
          console.error('❌ Failed to save character:', data.error);
          sendResponse({ success: false, error: data.error });
        }
      } catch (error) {
        console.error('❌ Error saving character to Supabase:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
    }

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return true; // Keep message channel open for async response
});

/**
 * Listen for messages from the Owlbear extension
 */
window.addEventListener('message', async (event) => {
  console.log('🔍 OwlCloud received message:', { origin: event.origin, data: event.data });

  // Only accept messages from Owlbear Rodeo domain or OwlCloud popover
  const allowedOrigins = ['https://www.owlbear.rodeo', 'https://owlcloud.vercel.app'];
  if (!allowedOrigins.includes(event.origin)) {
    console.log('❌ OwlCloud rejected: wrong origin', event.origin);
    return;
  }

  const { type, source } = event.data;

  // Only process messages from our Owlbear extension
  // Silently ignore messages without the expected source field (likely SDK internal messages)
  if (source !== 'owlbear-extension') {
    return;
  }

  console.log('📨 OwlCloud message from Owlbear extension:', type);
  debug.log('📨 Message from Owlbear extension:', type);

  switch (type) {
    case 'OWLCLOUD_GET_ACTIVE_CHARACTER': {
      // Get active character from extension storage
      try {
        const response = await browserAPI.runtime.sendMessage({
          action: 'getActiveCharacter'
        });

        // Send response back to Owlbear extension
        event.source.postMessage({
          type: 'OWLCLOUD_ACTIVE_CHARACTER_RESPONSE',
          data: {
            character: response?.character || null
          }
        }, event.origin);
      } catch (error) {
        debug.error('Error getting active character:', error);
        event.source.postMessage({
          type: 'OWLCLOUD_ERROR',
          data: { message: 'Failed to get active character' }
        }, event.origin);
      }
      break;
    }

    case 'OWLCLOUD_OPEN_CHARACTER_SHEET': {
      // Open character sheet overlay
      openCharacterSheet();
      break;
    }

    case 'OWLCLOUD_SYNC_CHARACTER': {
      // Request character sync from DiceCloud
      try {
        await browserAPI.runtime.sendMessage({
          action: 'syncCharacterFromDiceCloud'
        });

        event.source.postMessage({
          type: 'OWLCLOUD_SYNC_COMPLETE',
          data: { success: true }
        }, event.origin);
      } catch (error) {
        debug.error('Error syncing character:', error);
        event.source.postMessage({
          type: 'OWLCLOUD_ERROR',
          data: { message: 'Failed to sync character' }
        }, event.origin);
      }
      break;
    }

    case 'OWLCLOUD_OPEN_POPUP': {
      // Request to open browser extension popup
      // This will open the action popup programmatically
      try {
        await browserAPI.runtime.sendMessage({
          action: 'openPopup'
        });
      } catch (error) {
        debug.error('Error opening popup:', error);
      }
      break;
    }

    default:
      debug.warn('Unknown message type from Owlbear extension:', type);
  }
});

// ============== Notifications ==============

/**
 * Show a notification to the user
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10001;
    max-width: 300px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ============== Initialization ==============

// Wait for Owlbear to load
waitForOwlbear().then(() => {
  isOwlbearReady = true;
  // Note: Using Owlbear extension popover instead of injected button
  // injectOwlCloudButton();
  debug.log('🦉 OwlCloud initialized on Owlbear Rodeo');
});

debug.log('🦉 OwlCloud Owlbear content script initialized');
