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

  // MV3 requires returning a Promise instead of using sendResponse + return true
  // Handle the request and return a Promise
  const handleRequest = async () => {
    switch (request.action) {
      case 'storeCharacterData':
        try {
          await storeCharacterData(request.data);
          return { success: true };
        } catch (error) {
          console.error('Error storing character data:', error);
          return { success: false, error: error.message };
        }

      case 'getCharacterData':
        try {
          const data = await getCharacterData();
          return { success: true, data };
        } catch (error) {
          console.error('Error retrieving character data:', error);
          return { success: false, error: error.message };
        }

      case 'clearCharacterData':
        try {
          await clearCharacterData();
          return { success: true };
        } catch (error) {
          console.error('Error clearing character data:', error);
          return { success: false, error: error.message };
        }

      case 'loginToDiceCloud':
        try {
          const authData = await loginToDiceCloud(request.username, request.password);
          return { success: true, authData };
        } catch (error) {
          console.error('Error logging in to DiceCloud:', error);
          return { success: false, error: error.message };
        }

      case 'getApiToken':
        try {
          const token = await getApiToken();
          return { success: true, token };
        } catch (error) {
          console.error('Error retrieving API token:', error);
          return { success: false, error: error.message };
        }

      case 'logout':
        try {
          await logout();
          return { success: true };
        } catch (error) {
          console.error('Error logging out:', error);
          return { success: false, error: error.message };
        }

      case 'checkLoginStatus':
        try {
          const status = await checkLoginStatus();
          return { success: true, ...status };
        } catch (error) {
          console.error('Error checking login status:', error);
          return { success: false, error: error.message };
        }

      case 'rollInDiceCloudAndForward':
        try {
          await rollInDiceCloudAndForward(request.roll);
          return { success: true };
        } catch (error) {
          console.error('Error rolling in Dice Cloud and forwarding:', error);
          return { success: false, error: error.message };
        }

      case 'sendRollToRoll20':
        try {
          await sendRollToAllRoll20Tabs(request.roll);
          return { success: true };
        } catch (error) {
          console.error('Error sending roll to Roll20:', error);
          return { success: false, error: error.message };
        }

      case 'relayRollToRoll20':
        try {
          console.log('📡 Relaying roll from popup to Roll20:', request.roll);
          await sendRollToAllRoll20Tabs(request.roll);
          console.log('✅ Roll relayed successfully');
          return { success: true };
        } catch (error) {
          console.error('❌ Error relaying roll to Roll20:', error);
          return { success: false, error: error.message };
        }

      default:
        console.warn('Unknown action:', request.action);
        return { success: false, error: 'Unknown action' };
    }
  };

  // Return the Promise for MV3 compatibility
  return handleRequest();
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
