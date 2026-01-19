/**
 * Background Script - Chrome & Firefox Support
 * Handles data storage, API authentication, and communication between Dice Cloud and Roll20
 */

console.log('RollCloud: Background script starting...');

// Detect browser API
const browserAPI = typeof browser !== 'undefined' && browser.runtime ? browser : chrome;

console.log('RollCloud: Background script initialized on', browserAPI === browser ? 'Firefox' : 'Chrome');

const API_BASE = 'https://dicecloud.com/api';

// Listen for messages from content scripts and popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  switch (request.action) {
    case 'storeCharacterData':
      storeCharacterData(request.data)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error storing character data:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    case 'getCharacterData':
      getCharacterData()
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((error) => {
          console.error('Error retrieving character data:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'clearCharacterData':
      clearCharacterData()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error clearing character data:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'loginToDiceCloud':
      loginToDiceCloud(request.username, request.password)
        .then((authData) => {
          sendResponse({ success: true, authData });
        })
        .catch((error) => {
          console.error('Error logging in to DiceCloud:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'getApiToken':
      getApiToken()
        .then((token) => {
          sendResponse({ success: true, token });
        })
        .catch((error) => {
          console.error('Error retrieving API token:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'logout':
      logout()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error logging out:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'checkLoginStatus':
      checkLoginStatus()
        .then((status) => {
          sendResponse({ success: true, ...status });
        })
        .catch((error) => {
          console.error('Error checking login status:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'rollInDiceCloudAndForward':
      rollInDiceCloudAndForward(request.roll)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error rolling in Dice Cloud and forwarding:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'sendRollToRoll20':
      // Forward roll from DiceCloud to all Roll20 tabs
      sendRollToAllRoll20Tabs(request.roll)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error sending roll to Roll20:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'relayRollToRoll20':
      // Relay roll from popup window to Roll20 tabs (Firefox fallback)
      console.log('📡 Relaying roll from popup to Roll20:', request.roll);
      sendRollToAllRoll20Tabs(request.roll)
        .then(() => {
          console.log('✅ Roll relayed successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('❌ Error relaying roll to Roll20:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
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
