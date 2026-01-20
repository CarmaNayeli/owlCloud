/**
 * Background Script - Chrome & Firefox Support
 * Handles data storage, API authentication, and communication between Dice Cloud and Roll20
 */

console.log('RollCloud: Background script starting...');

// Detect browser and use appropriate API
// For Firefox, use the native Promise-based 'browser' API
// For Chrome, use native 'chrome' API directly (no polyfill needed in service worker)
const browserAPI = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// Detect which browser we're running on
const isFirefox = typeof browser !== 'undefined';
console.log('RollCloud: Background script initialized on', isFirefox ? 'Firefox' : 'Chrome');

const API_BASE = 'https://dicecloud.com/api';

// Listen for messages from content scripts and popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  // Handle async operations and call sendResponse when done
  // This pattern keeps the message port open until sendResponse is called
  (async () => {
    try {
      let response;

      switch (request.action) {
        case 'storeCharacterData':
          await storeCharacterData(request.data);
          response = { success: true };
          break;

        case 'getCharacterData': {
          const data = await getCharacterData();
          response = { success: true, data };
          break;
        }

        case 'clearCharacterData':
          await clearCharacterData();
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
          console.log('📡 Relaying roll from popup to Roll20:', request.roll);
          await sendRollToAllRoll20Tabs(request.roll);
          console.log('✅ Roll relayed successfully');
          response = { success: true };
          break;

        default:
          console.warn('Unknown action:', request.action);
          response = { success: false, error: 'Unknown action' };
      }

      sendResponse(response);
    } catch (error) {
      console.error('Error handling message:', error);
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

    console.log('Successfully logged in to DiceCloud');
    return data;
  } catch (error) {
    console.error('Failed to login to DiceCloud:', error);
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
        console.warn('API token has expired');
        await logout();
        return null;
      }
    }

    return result.diceCloudToken;
  } catch (error) {
    console.error('Failed to retrieve API token:', error);
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
    console.error('Failed to check login status:', error);
    throw error;
  }
}

/**
 * Logs out (clears authentication data)
 */
async function logout() {
  try {
    await browserAPI.storage.local.remove(['diceCloudToken', 'diceCloudUserId', 'tokenExpires', 'username']);
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Failed to logout:', error);
    throw error;
  }
}

/**
 * Stores character data in browserAPI.storage
 */
async function storeCharacterData(characterData) {
  try {
    await browserAPI.storage.local.set({
      characterData: characterData,
      timestamp: Date.now()
    });
    console.log('Character data stored successfully:', characterData);
  } catch (error) {
    console.error('Failed to store character data:', error);
    throw error;
  }
}

/**
 * Retrieves character data from browserAPI.storage
 */
async function getCharacterData() {
  try {
    const result = await browserAPI.storage.local.get(['characterData', 'timestamp']);
    if (result.characterData) {
      console.log('Retrieved character data:', result.characterData);
      return result.characterData;
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve character data:', error);
    throw error;
  }
}

/**
 * Clears stored character data
 */
async function clearCharacterData() {
  try {
    await browserAPI.storage.local.remove(['characterData', 'timestamp']);
    console.log('Character data cleared successfully');
  } catch (error) {
    console.error('Failed to clear character data:', error);
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

    console.log(' Roll initiated in Dice Cloud, will be forwarded automatically');
    return response;
  } catch (error) {
    console.error('Failed to roll in Dice Cloud:', error);
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
      console.warn('No Roll20 tabs found');
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
    console.log(`Roll sent to ${tabs.length} Roll20 tab(s)`);
  } catch (error) {
    console.error('Failed to send roll to Roll20 tabs:', error);
    throw error;
  }
}

/**
 * Handle extension installation
 */
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', browserAPI.runtime.getManifest().version);
  }
});
