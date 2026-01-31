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
const linkExtensionBtn = document.getElementById('link-extension-btn');

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready');
  statusText.textContent = 'Connected to Owlbear Rodeo';

  // Check for active character
  checkForActiveCharacter();

  // Set up periodic check for character updates
  setInterval(checkForActiveCharacter, 5000);
});

// ============== Character Management ==============

/**
 * Check if there's an active character from Supabase using Owlbear player ID
 */
async function checkForActiveCharacter() {
  try {
    // Get current player's Owlbear ID
    const playerId = await OBR.player.getId();

    console.log('🎭 Checking for character with player ID:', playerId);

    // Call Supabase Edge Function to get active character by player ID
    const response = await fetch(
      `https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/get-active-character?owlbear_player_id=${encodeURIComponent(playerId)}`
    );

    if (!response.ok) {
      console.error('Failed to get character:', response.statusText);
      showNoCharacter();
      return;
    }

    const data = await response.json();

    if (data.success && data.character) {
      displayCharacter(data.character);
    } else {
      showNoCharacter();
    }
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

/**
 * Link Owlbear player to browser extension characters
 */
linkExtensionBtn.addEventListener('click', async () => {
  try {
    if (!isOwlbearReady) {
      alert('Owlbear SDK not ready. Please wait a moment and try again.');
      return;
    }

    // Get Owlbear player ID
    const playerId = await OBR.player.getId();
    console.log('🔗 Linking player ID:', playerId);

    // Prompt user for their DiceCloud user ID
    const dicecloudUserId = prompt(
      'Enter your DiceCloud User ID:\n\n' +
      'You can find this in the OwlCloud extension popup after syncing a character.\n' +
      'It looks like: aBcDeFgHiJkLmNoP1'
    );

    if (!dicecloudUserId || dicecloudUserId.trim() === '') {
      return; // User cancelled
    }

    // Show loading state
    linkExtensionBtn.textContent = '⏳ Linking...';
    linkExtensionBtn.disabled = true;

    // Call Supabase edge function to link
    const response = await fetch(
      'https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/link-owlbear-player',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owlbearPlayerId: playerId,
          dicecloudUserId: dicecloudUserId.trim()
        })
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`✅ Successfully linked! ${result.linkedCharacters} character(s) are now connected to Owlbear.`);

      // Refresh character data
      checkForActiveCharacter();
    } else {
      alert(`❌ Linking failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error linking to extension:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    // Restore button state
    linkExtensionBtn.textContent = '🔗 Link to Browser Extension';
    linkExtensionBtn.disabled = false;
  }
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
