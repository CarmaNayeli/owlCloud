/**
 * Background Script - Chrome & Firefox Support
 * Handles data storage, API authentication, and communication between Dice Cloud and Roll20
 */

// Import debug utility for Chrome service workers
if (typeof importScripts === 'function') {
  importScripts('common/debug.js');
}

debug.log('RollCloud: Background script starting...');

// Detect browser and use appropriate API
// For Firefox, use the native Promise-based 'browser' API
// For Chrome, use native 'chrome' API directly (no polyfill needed in service worker)
const browserAPI = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// Detect which browser we're running on
const isFirefox = typeof browser !== 'undefined';
debug.log('RollCloud: Background script initialized on', isFirefox ? 'Firefox' : 'Chrome');

const API_BASE = 'https://dicecloud.com/api';

// Listen for messages from content scripts and popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug.log('Background received message:', request);

  // Handle async operations and call sendResponse when done
  // This pattern keeps the message port open until sendResponse is called
  (async () => {
    try {
      let response;

      switch (request.action) {
        case 'storeCharacterData':
          await storeCharacterData(request.data, request.slotId);
          response = { success: true };
          break;

        case 'getCharacterData': {
          const data = await getCharacterData(request.characterId);
          response = { success: true, data };
          break;
        }

        case 'getAllCharacterProfiles': {
          const profiles = await getAllCharacterProfiles();
          response = { success: true, profiles };
          break;
        }

        case 'setActiveCharacter':
          await setActiveCharacter(request.characterId);
          response = { success: true };
          break;

        case 'clearCharacterData':
          await clearCharacterData(request.characterId);
          response = { success: true };
          break;

        case 'loginToDiceCloud': {
          const authData = await loginToDiceCloud(request.username, request.password);
          response = { success: true, authData };
          break;
        }

        case 'getApiToken': {
          const token = await getApiToken();
          response = { success: true, token };
          break;
        }

        case 'logout':
          await logout();
          response = { success: true };
          break;

        case 'checkLoginStatus': {
          const status = await checkLoginStatus();
          response = { success: true, ...status };
          break;
        }

        case 'rollInDiceCloudAndForward':
          await rollInDiceCloudAndForward(request.roll);
          response = { success: true };
          break;

        case 'sendRollToRoll20':
          await sendRollToAllRoll20Tabs(request.roll);
          response = { success: true };
          break;

        case 'relayRollToRoll20':
          debug.log('📡 Relaying roll from popup to Roll20:', request.roll);
          await sendRollToAllRoll20Tabs(request.roll);
          debug.log('✅ Roll relayed successfully');
          response = { success: true };
          break;

        default:
          debug.warn('Unknown action:', request.action);
          response = { success: false, error: 'Unknown action' };
      }

      sendResponse(response);
    } catch (error) {
      debug.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to keep the message channel open for async sendResponse
  return true;
});

/**
 * Logs in to DiceCloud API
 */
async function loginToDiceCloud(username, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Store authentication data
    await browserAPI.storage.local.set({
      diceCloudToken: data.token,
      diceCloudUserId: data.id,
      tokenExpires: data.tokenExpires,
      username: username
    });

    debug.log('Successfully logged in to DiceCloud');
    return data;
  } catch (error) {
    debug.error('Failed to login to DiceCloud:', error);
    throw error;
  }
}

/**
 * Gets the stored API token
 */
async function getApiToken() {
  try {
    const result = await browserAPI.storage.local.get(['diceCloudToken', 'tokenExpires']);

    if (!result.diceCloudToken) {
      return null;
    }

    // Check if token is expired
    if (result.tokenExpires) {
      const expiryDate = new Date(result.tokenExpires);
      const now = new Date();
      if (now >= expiryDate) {
        debug.warn('API token has expired');
        await logout();
        return null;
      }
    }

    return result.diceCloudToken;
  } catch (error) {
    debug.error('Failed to retrieve API token:', error);
    throw error;
  }
}

/**
 * Checks if the user is logged in
 */
async function checkLoginStatus() {
  try {
    const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires']);

    if (!result.diceCloudToken) {
      return { loggedIn: false };
    }

    // Check if token is expired
    if (result.tokenExpires) {
      const expiryDate = new Date(result.tokenExpires);
      const now = new Date();
      if (now >= expiryDate) {
        await logout();
        return { loggedIn: false };
      }
    }

    return {
      loggedIn: true,
      username: result.username,
      tokenExpires: result.tokenExpires
    };
  } catch (error) {
    debug.error('Failed to check login status:', error);
    throw error;
  }
}

/**
 * Logs out (clears authentication data)
 */
async function logout() {
  try {
    await browserAPI.storage.local.remove(['diceCloudToken', 'diceCloudUserId', 'tokenExpires', 'username']);
    debug.log('Logged out successfully');
  } catch (error) {
    debug.error('Failed to logout:', error);
    throw error;
  }
}

/**
 * Stores character data in browserAPI.storage (supports multiple profiles)
 * @param {Object} characterData - Character data to store
 * @param {string} slotId - Optional slot ID (e.g., 'slot-1'). If not provided, uses characterId from data.
 */
async function storeCharacterData(characterData, slotId) {
  try {
    // Use slotId if provided, otherwise fall back to character ID from the data
    const storageId = slotId || characterData.characterId || characterData._id || 'default';

    // Get existing profiles
    const result = await browserAPI.storage.local.get(['characterProfiles', 'activeCharacterId']);
    const characterProfiles = result.characterProfiles || {};

    // Store this character's data
    characterProfiles[storageId] = characterData;

    // Set active character to this one if none is set
    const activeCharacterId = result.activeCharacterId || storageId;

    await browserAPI.storage.local.set({
      characterProfiles: characterProfiles,
      activeCharacterId: activeCharacterId,
      timestamp: Date.now()
    });

    debug.log(`Character data stored successfully for ID: ${storageId}`, characterData);
  } catch (error) {
    debug.error('Failed to store character data:', error);
    throw error;
  }
}

/**
 * Retrieves character data from browserAPI.storage
 * If characterId is provided, returns that specific character
 * Otherwise returns the active character
 */
async function getCharacterData(characterId = null) {
  try {
    const result = await browserAPI.storage.local.get(['characterProfiles', 'activeCharacterId', 'characterData']);

    // Migration: if old single characterData exists, migrate it
    if (result.characterData && !result.characterProfiles) {
      debug.log('Migrating old single character data to profiles...');
      const charId = result.characterData.characterId || result.characterData._id || 'default';
      const characterProfiles = {};
      characterProfiles[charId] = result.characterData;

      await browserAPI.storage.local.set({
        characterProfiles: characterProfiles,
        activeCharacterId: charId
      });

      // Remove old storage
      await browserAPI.storage.local.remove('characterData');

      return result.characterData;
    }

    // Get character profiles
    const characterProfiles = result.characterProfiles || {};

    // If specific character ID requested, return it
    if (characterId) {
      return characterProfiles[characterId] || null;
    }

    // Otherwise return active character
    const activeCharacterId = result.activeCharacterId;
    if (activeCharacterId && characterProfiles[activeCharacterId]) {
      debug.log('Retrieved active character data:', characterProfiles[activeCharacterId]);
      return characterProfiles[activeCharacterId];
    }

    // Fallback: return first available character
    const characterIds = Object.keys(characterProfiles);
    if (characterIds.length > 0) {
      debug.log('No active character, returning first available:', characterProfiles[characterIds[0]]);
      return characterProfiles[characterIds[0]];
    }

    return null;
  } catch (error) {
    debug.error('Failed to retrieve character data:', error);
    throw error;
  }
}

/**
 * Gets all character profiles
 */
async function getAllCharacterProfiles() {
  try {
    const result = await browserAPI.storage.local.get(['characterProfiles']);
    return result.characterProfiles || {};
  } catch (error) {
    debug.error('Failed to retrieve character profiles:', error);
    throw error;
  }
}

/**
 * Sets the active character
 */
async function setActiveCharacter(characterId) {
  try {
    await browserAPI.storage.local.set({
      activeCharacterId: characterId
    });
    debug.log(`Active character set to: ${characterId}`);
  } catch (error) {
    debug.error('Failed to set active character:', error);
    throw error;
  }
}

/**
 * Clears stored character data (all profiles or specific profile)
 */
async function clearCharacterData(characterId = null) {
  try {
    if (characterId) {
      // Clear specific character
      const result = await browserAPI.storage.local.get(['characterProfiles', 'activeCharacterId']);
      const characterProfiles = result.characterProfiles || {};
      const activeCharacterId = result.activeCharacterId;

      delete characterProfiles[characterId];

      const updates = {
        characterProfiles: characterProfiles
      };

      // If we just deleted the active character, switch to another one
      if (activeCharacterId === characterId) {
        const remainingIds = Object.keys(characterProfiles);
        if (remainingIds.length > 0) {
          // Set first available character as active
          updates.activeCharacterId = remainingIds[0];
          debug.log(`Active character was cleared, switching to ${remainingIds[0]}`);
        } else {
          // No characters left, clear active ID
          updates.activeCharacterId = null;
          debug.log('No characters remaining, clearing active character ID');
        }
      }

      await browserAPI.storage.local.set(updates);

      debug.log(`Character profile cleared for ID: ${characterId}`);
    } else {
      // Clear all characters
      await browserAPI.storage.local.remove(['characterProfiles', 'activeCharacterId', 'timestamp']);
      debug.log('All character data cleared successfully');
    }
  } catch (error) {
    debug.error('Failed to clear character data:', error);
    throw error;
  }
}

/**
 * Rolls in Dice Cloud and forwards to Roll20
 */
async function rollInDiceCloudAndForward(rollData) {
  try {
    // Find Dice Cloud tab
    const diceCloudTabs = await browserAPI.tabs.query({ url: '*://dicecloud.com/*' });
    
    if (diceCloudTabs.length === 0) {
      throw new Error('No Dice Cloud tab found. Please open Dice Cloud first.');
    }

    // Send roll request to Dice Cloud
    const diceCloudTab = diceCloudTabs[0];
    const response = await browserAPI.tabs.sendMessage(diceCloudTab.id, {
      action: 'rollInDiceCloud',
      roll: rollData
    });

    if (!response || !response.success) {
      throw new Error('Failed to roll in Dice Cloud');
    }

    debug.log(' Roll initiated in Dice Cloud, will be forwarded automatically');
    return response;
  } catch (error) {
    debug.error('Failed to roll in Dice Cloud:', error);
    throw error;
  }
}

/**
 * Sends a roll to all open Roll20 tabs
 */
async function sendRollToAllRoll20Tabs(rollData) {
  try {
    // Query all tabs for Roll20
    const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

    if (tabs.length === 0) {
      debug.warn('No Roll20 tabs found');
      return;
    }

    // Send roll to each Roll20 tab
    const promises = tabs.map(tab => {
      return browserAPI.tabs.sendMessage(tab.id, {
        action: 'postRollToChat',
        roll: rollData
      });
    });

    await Promise.all(promises);
    debug.log(`Roll sent to ${tabs.length} Roll20 tab(s)`);
  } catch (error) {
    debug.error('Failed to send roll to Roll20 tabs:', error);
    throw error;
  }
}

/**
 * Handle extension installation
 */
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    debug.log('Extension installed');
  } else if (details.reason === 'update') {
    debug.log('Extension updated to version', browserAPI.runtime.getManifest().version);
  }
});
