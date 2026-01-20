/**
 * Background Script - Chrome & Firefox Support
 * Handles data storage, API authentication, and communication between Dice Cloud and Roll20
 */

console.log('RollCloud: Background script starting...');

// Import browser polyfill for service worker (Chrome MV3)
try {
  importScripts('src/common/browser-polyfill.js');
  console.log('✅ Browser polyfill loaded in service worker');
} catch (e) {
  console.log('ℹ️ importScripts not available or failed:', e.message);
}

// Detect browser API (prefer polyfilled version from importScripts)
const browserAPI = (typeof self !== 'undefined' && typeof self.browserAPI !== 'undefined')
  ? self.browserAPI
  : (typeof browser !== 'undefined' && browser.runtime ? browser : chrome);

// Detect which browser we're running on
const isFirefox = typeof browser !== 'undefined' && browserAPI === browser;
console.log('RollCloud: Background script initialized on', isFirefox ? 'Firefox' : 'Chrome');

const API_BASE = 'https://dicecloud.com/api';

// Listen for messages from content scripts and popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  // Handle the message asynchronously and return a Promise
  // Chrome MV3 supports returning Promises directly from the listener
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'storeCharacterData':
          await storeCharacterData(request.data);
          return { success: true };

        case 'getCharacterData':
          const data = await getCharacterData();
          return { success: true, data };

        case 'clearCharacterData':
          await clearCharacterData();
          return { success: true };

        case 'loginToDiceCloud':
          const authData = await loginToDiceCloud(request.username, request.password);
          return { success: true, authData };

        case 'getApiToken':
          const token = await getApiToken();
          return { success: true, token };

        case 'logout':
          await logout();
          return { success: true };

        case 'checkLoginStatus':
          const status = await checkLoginStatus();
          return { success: true, ...status };

        case 'rollInDiceCloudAndForward':
          await rollInDiceCloudAndForward(request.roll);
          return { success: true };

        case 'sendRollToRoll20':
          await sendRollToAllRoll20Tabs(request.roll);
          return { success: true };

        case 'relayRollToRoll20':
          console.log('📡 Relaying roll from popup to Roll20:', request.roll);
          await sendRollToAllRoll20Tabs(request.roll);
          console.log('✅ Roll relayed successfully');
          return { success: true };

        default:
          console.warn('Unknown action:', request.action);
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  };

  // Return the Promise - Chrome MV3 will handle it correctly
  // The polyfill ensures compatibility with both Chrome and Firefox
  return handleMessage();
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
