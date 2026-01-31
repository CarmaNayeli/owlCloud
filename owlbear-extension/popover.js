/**
 * OwlCloud Owlbear Extension - Popover Script
 *
 * This script runs inside the Owlbear extension popover and:
 * 1. Communicates with the browser extension via window.postMessage
 * 2. Uses the Owlbear SDK to interact with the scene
 * 3. Displays character information and controls
 */

/* global OBR */

// ============== State ==============

let currentCharacter = null;
let isOwlbearReady = false;

// ============== DOM Elements ==============

const statusText = document.getElementById('status-text');
const characterSection = document.getElementById('character-section');
const noCharacterSection = document.getElementById('no-character-section');
const characterInfo = document.getElementById('character-info');
const openSheetBtn = document.getElementById('open-sheet-btn');
const syncCharacterBtn = document.getElementById('sync-character-btn');
const openExtensionBtn = document.getElementById('open-extension-btn');

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready');
  statusText.textContent = 'Connected to Owlbear Rodeo';

  // Create draggable character sheet button
  await createDraggableButton();

  // Check for active character
  checkForActiveCharacter();

  // Set up periodic check for character updates
  setInterval(checkForActiveCharacter, 5000);
});

// ============== Draggable Button Creation ==============

/**
 * Create a draggable character sheet button on the scene
 */
async function createDraggableButton() {
  try {
    const buttonId = 'owlcloud-character-sheet-button';

    // Remove existing button if it exists
    const existingItems = await OBR.scene.items.getItems([buttonId]);
    if (existingItems.length > 0) {
      await OBR.scene.items.deleteItems([buttonId]);
    }

    // Get viewport to position button
    const viewport = await OBR.viewport.getViewport();
    const buttonX = viewport.position.x - (viewport.width / 2) + 100;
    const buttonY = viewport.position.y;

    // Create the button as a label item
    await OBR.scene.items.addItems([{
      id: buttonId,
      type: 'LABEL',
      name: 'Character Sheet',
      text: {
        plainText: '📋 Character Sheet',
        type: 'PLAIN',
        style: {
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 700,
          textAlign: 'CENTER',
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#000000',
          strokeOpacity: 0.8,
          strokeWidth: 2,
          padding: 10
        }
      },
      position: {
        x: buttonX,
        y: buttonY
      },
      attachedTo: undefined,
      layer: 'ATTACHMENT',
      locked: false,
      visible: true,
      metadata: {
        'owlcloud/button': true
      },
      style: {
        backgroundColor: '#667eea',
        backgroundOpacity: 0.9,
        cornerRadius: 8,
        pointerWidth: 0,
        pointerHeight: 0,
        pointerDirection: 'DOWN'
      }
    }]);

    console.log('🎯 Draggable character sheet button created');

    // Listen for button clicks
    OBR.scene.items.onChange(async (items) => {
      const button = items.find(item => item.id === buttonId);
      if (button && button.metadata?.['owlcloud/clicked']) {
        // Button was clicked, show character sheet
        openCharacterSheet();
        // Clear the click metadata
        await OBR.scene.items.updateItems([buttonId], (items) => {
          items.forEach(item => {
            delete item.metadata['owlcloud/clicked'];
          });
        });
      }
    });

  } catch (error) {
    console.error('Error creating draggable button:', error);
  }
}

/**
 * Open character sheet (called when button is clicked)
 */
function openCharacterSheet() {
  const message = {
    type: 'OWLCLOUD_OPEN_CHARACTER_SHEET',
    source: 'owlbear-extension'
  };
  window.parent.postMessage(message, 'https://www.owlbear.rodeo');
  if (isOwlbearReady) {
    OBR.notification.show('Opening character sheet...', 'INFO');
  }
}

// ============== Character Management ==============

/**
 * Check if there's an active character from the browser extension
 */
async function checkForActiveCharacter() {
  try {
    // Try to communicate with the browser extension content script
    // The content script should be running on the owlbear.rodeo page
    const message = {
      type: 'OWLCLOUD_GET_ACTIVE_CHARACTER',
      source: 'owlbear-extension'
    };

    // Post message to parent window (where the browser extension content script is)
    window.parent.postMessage(message, 'https://www.owlbear.rodeo');

    // The response will come via window message listener (set up below)
  } catch (error) {
    console.error('Error checking for active character:', error);
    showNoCharacter();
  }
}

/**
 * Display character information
 */
function displayCharacter(character) {
  currentCharacter = character;

  // Update UI
  characterSection.style.display = 'block';
  noCharacterSection.style.display = 'none';

  // Populate character info
  characterInfo.innerHTML = `
    <div class="character-name">${character.name || 'Unknown Character'}</div>
    <div class="character-detail">Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}</div>
    <div class="character-detail">HP: ${character.hitPoints?.current || 0} / ${character.hitPoints?.max || 0}</div>
  `;

  console.log('🎭 Displaying character:', character.name);
}

/**
 * Show no character state
 */
function showNoCharacter() {
  characterSection.style.display = 'none';
  noCharacterSection.style.display = 'block';
  statusText.textContent = 'No character selected';
}

// ============== Event Handlers ==============

/**
 * Open character sheet in browser extension
 */
openSheetBtn.addEventListener('click', () => {
  // Send message to browser extension content script to open character sheet
  const message = {
    type: 'OWLCLOUD_OPEN_CHARACTER_SHEET',
    source: 'owlbear-extension'
  };

  window.parent.postMessage(message, 'https://www.owlbear.rodeo');

  // Show notification in Owlbear
  if (isOwlbearReady) {
    OBR.notification.show('Opening character sheet...', 'INFO');
  }
});

/**
 * Sync character from DiceCloud
 */
syncCharacterBtn.addEventListener('click', () => {
  // Send message to browser extension to sync character
  const message = {
    type: 'OWLCLOUD_SYNC_CHARACTER',
    source: 'owlbear-extension'
  };

  window.parent.postMessage(message, 'https://www.owlbear.rodeo');

  // Show notification in Owlbear
  if (isOwlbearReady) {
    OBR.notification.show('Syncing character from DiceCloud...', 'INFO');
  }

  // Update status
  statusText.textContent = 'Syncing character...';

  // Refresh character data after a delay
  setTimeout(checkForActiveCharacter, 2000);
});

/**
 * Open browser extension popup
 */
openExtensionBtn.addEventListener('click', () => {
  // Send message to browser extension to open popup
  const message = {
    type: 'OWLCLOUD_OPEN_POPUP',
    source: 'owlbear-extension'
  };

  window.parent.postMessage(message, 'https://www.owlbear.rodeo');

  alert('Please click the OwlCloud extension icon in your browser toolbar to select a character.');
});

// ============== Message Listener ==============

/**
 * Listen for messages from the browser extension content script
 */
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== 'https://www.owlbear.rodeo') {
    return;
  }

  const { type, data } = event.data;

  switch (type) {
    case 'OWLCLOUD_ACTIVE_CHARACTER_RESPONSE':
      if (data && data.character) {
        displayCharacter(data.character);
      } else {
        showNoCharacter();
      }
      break;

    case 'OWLCLOUD_CHARACTER_UPDATED':
      if (data && data.character) {
        displayCharacter(data.character);
        if (isOwlbearReady) {
          OBR.notification.show(`Character updated: ${data.character.name}`, 'SUCCESS');
        }
      }
      break;

    case 'OWLCLOUD_SYNC_COMPLETE':
      if (isOwlbearReady) {
        OBR.notification.show('Character synced successfully', 'SUCCESS');
      }
      statusText.textContent = 'Connected to Owlbear Rodeo';
      checkForActiveCharacter();
      break;

    case 'OWLCLOUD_ERROR':
      if (isOwlbearReady) {
        OBR.notification.show(`Error: ${data.message}`, 'ERROR');
      }
      statusText.textContent = `Error: ${data.message}`;
      break;

    default:
      // Ignore unknown message types
      break;
  }
});

// ============== Dice Rolling Integration ==============

/**
 * Post a dice roll to Owlbear chat
 * This will be called when the browser extension sends roll data
 */
function postRollToOwlbear(rollData) {
  if (!isOwlbearReady) {
    console.warn('Owlbear not ready, cannot post roll');
    return;
  }

  // Use Owlbear notification system to display roll
  // TODO: In the future, this could create scene items or use a custom roll display
  const rollResult = rollData.result || '?';
  const rollName = rollData.name || 'Roll';
  const characterName = rollData.characterName || 'Unknown';

  OBR.notification.show(
    `${characterName} rolled ${rollName}: ${rollResult}`,
    'INFO'
  );

  console.log('🎲 Roll posted to Owlbear:', rollData);
}

// Listen for roll messages from browser extension
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.owlbear.rodeo') {
    return;
  }

  if (event.data.type === 'OWLCLOUD_POST_ROLL') {
    postRollToOwlbear(event.data.data);
  }
});

// ============== Initialization ==============

console.log('🎲 OwlCloud Owlbear extension popover loaded');
statusText.textContent = 'Initializing...';

// Initial check for character (will happen after OBR.onReady)
setTimeout(() => {
  if (!isOwlbearReady) {
    statusText.textContent = 'Waiting for Owlbear SDK...';
  }
}, 1000);
