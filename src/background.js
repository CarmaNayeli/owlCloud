/**
 * Background Script - Chrome & Firefox Support
 * Handles data storage, API authentication, and communication between Dice Cloud and Roll20
 */

// For Chrome service workers, import debug utility
if (typeof importScripts === 'function' && typeof chrome !== 'undefined') {
  importScripts('src/common/debug.js');
}

debug.log('RollCloud: Background script starting...');

// Detect browser and use appropriate API
// For Firefox, use the native Promise-based 'browser' API
// For Chrome, use native 'chrome' API directly (no polyfill needed in service worker)
const browserAPI = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// Detect which browser we're running on
const isFirefox = typeof browser !== 'undefined';
debug.log('RollCloud: Background script initialized on', isFirefox ? 'Firefox' : 'Chrome');

// Firefox-specific debugging
if (isFirefox) {
  debug.log('🦊 Firefox detected - checking extension context...');
  
  // Test if we can access runtime
  try {
    const manifest = browserAPI.runtime.getManifest();
    debug.log('✅ Firefox runtime accessible, version:', manifest.version);
  } catch (error) {
    debug.error('❌ Firefox runtime not accessible:', error);
  }
  
  // Test storage
  try {
    browserAPI.storage.local.get(['test'], (result) => {
      if (browserAPI.runtime.lastError) {
        debug.error('❌ Firefox storage error:', browserAPI.runtime.lastError);
      } else {
        debug.log('✅ Firefox storage working');
      }
    });
  } catch (error) {
    debug.error('❌ Firefox storage test error:', error);
  }
}

const API_BASE = 'https://dicecloud.com/api';

// Listen for messages from content scripts and popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug.log('Background received message:', request);
  debug.log('Message sender:', sender);

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

        case 'setApiToken': {
          await setApiToken(request.token, request.userId, request.tokenExpires, request.username);
          response = { success: true };
          break;
        }

        case 'getApiToken': {
          const token = await getApiToken();
          response = { success: true, token };
          break;
        }

        case 'getManifest': {
          const manifest = browserAPI.runtime.getManifest();
          response = { success: true, manifest };
          break;
        }

        case 'logout':
          await logout();
          response = { success: true };
          break;

        case 'rollResult':
          // Forward roll result to Roll20 content script for popup forwarding
          debug.log('🧬 Forwarding roll result to Roll20 for popup:', request);
          
          // Send to Roll20 content script to forward to popup
          const roll20Tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });
          if (roll20Tabs.length > 0) {
            await browserAPI.tabs.sendMessage(roll20Tabs[0].id, {
              action: 'forwardToPopup',
              rollResult: request.rollResult,
              baseRoll: request.baseRoll,
              characterName: request.characterName,
              characterId: request.characterId
            });
            response = { success: true };
          } else {
            response = { success: false, error: 'No Roll20 tabs found' };
          }
          break;

        case 'relayRollToRoll20': {
          // Relay roll from popup-sheet to Roll20 content script
          debug.log('🎲 Relaying roll to Roll20:', request.roll);

          const r20Tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });
          if (r20Tabs.length > 0) {
            for (const tab of r20Tabs) {
              try {
                await browserAPI.tabs.sendMessage(tab.id, {
                  action: 'rollFromPopout',
                  roll: request.roll,
                  name: request.roll?.name,
                  formula: request.roll?.formula,
                  characterName: request.roll?.characterName
                });
                debug.log('✅ Roll relayed to Roll20 tab:', tab.id);
              } catch (tabError) {
                debug.warn('⚠️ Could not send to tab', tab.id, tabError.message);
              }
            }
            response = { success: true };
          } else {
            debug.warn('⚠️ No Roll20 tabs found to relay roll');
            response = { success: false, error: 'No Roll20 tabs found' };
          }
          break;
        }

        // ============== Discord Pairing Message Handlers ==============

        case 'checkLoginStatus': {
          const loginStatus = await checkLoginStatus();
          response = { success: true, ...loginStatus };
          break;
        }

        case 'createDiscordPairing': {
          const pairingResult = await createDiscordPairing(request.code, request.username);
          response = pairingResult;
          break;
        }

        case 'checkDiscordPairing': {
          const checkResult = await checkDiscordPairing(request.code);
          response = checkResult;
          break;
        }

        case 'setDiscordWebhook': {
          await setDiscordWebhookSettings(request.webhookUrl, true, request.serverName);
          // Also set the pairing ID for command polling if provided
          if (request.pairingId) {
            currentPairingId = request.pairingId;
            await browserAPI.storage.local.set({ currentPairingId: request.pairingId });
            // Start command polling
            startCommandPolling(request.pairingId);
          }
          response = { success: true };
          break;
        }

        case 'getDiscordWebhook': {
          const settings = await getDiscordWebhookSettings();
          response = { success: true, ...settings };
          break;
        }

        case 'testDiscordWebhook': {
          const testResult = await testDiscordWebhook(request.webhookUrl);
          response = testResult;
          break;
        }

        case 'requestPairingCodeFromInstaller': {
          // Request pairing code from native messaging host
          if (installerPort) {
            installerPort.postMessage({ type: 'getPairingCode' });
            response = { success: true, message: 'Pairing code requested from installer' };
          } else {
            // Try to connect first
            const port = await connectToInstaller();
            if (port) {
              port.postMessage({ type: 'getPairingCode' });
              response = { success: true, message: 'Connected and requested pairing code' };
            } else {
              response = { success: false, error: 'Could not connect to installer' };
            }
          }
          break;
        }

        default:
          debug.warn('Unknown action:', request.action);
          response = { success: false, error: 'Unknown action: ' + request.action };
          break;
      }

      debug.log('Sending response:', response);
      sendResponse(response);
    } catch (error) {
      debug.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we'll respond asynchronously
  return true;
});

/**
 * Logs in to DiceCloud API with username/password
 * Per DiceCloud API docs: POST https://dicecloud.com/api/login
 * Accepts either username or email with password
 */
async function loginToDiceCloud(username, password) {
  try {
    // Try to determine if input is email or username
    const isEmail = username.includes('@');

    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(isEmail ? {
        email: username,
        password: password
      } : {
        username: username,
        password: password
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Store authentication data including token expiry
    await browserAPI.storage.local.set({
      diceCloudToken: data.token,
      diceCloudUserId: data.id,
      tokenExpires: data.tokenExpires,
      username: username
    });

    debug.log('Successfully logged in to DiceCloud');
    debug.log('Token expires:', data.tokenExpires);
    return data;
  } catch (error) {
    debug.error('Failed to login to DiceCloud:', error);
    throw error;
  }
}

/**
 * Stores the API token (extracted from DiceCloud session or manually entered)
 */
async function setApiToken(token, userId = null, tokenExpires = null, username = null) {
  try {
    // Validate token format (basic check)
    if (!token || token.length < 10) {
      throw new Error('Invalid API token format');
    }

    // Store the API token with optional metadata
    const storageData = {
      diceCloudToken: token,
      username: username || 'DiceCloud User'
    };

    if (userId) {
      storageData.diceCloudUserId = userId;
    }

    if (tokenExpires) {
      storageData.tokenExpires = tokenExpires;
    }

    await browserAPI.storage.local.set(storageData);

    debug.log('Successfully stored API token');
    return { success: true };
  } catch (error) {
    debug.error('Failed to store API token:', error);
    throw error;
  }
}

/**
 * Gets the stored API token
 * Checks expiry for tokens obtained via username/password login
 */
async function getApiToken() {
  try {
    const result = await browserAPI.storage.local.get(['diceCloudToken', 'tokenExpires']);

    if (!result.diceCloudToken) {
      return null;
    }

    // Check if token is expired (only if tokenExpires exists - API tokens don't expire)
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
 * Also validates token expiry for username/password logins
 */
async function checkLoginStatus() {
  try {
    const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires']);

    if (!result.diceCloudToken) {
      return { loggedIn: false };
    }

    // Check if token is expired (only if tokenExpires exists - API tokens don't expire)
    if (result.tokenExpires) {
      const expiryDate = new Date(result.tokenExpires);
      const now = new Date();
      if (now >= expiryDate) {
        debug.warn('Session expired - please login again');
        await logout();
        return { loggedIn: false };
      }
    }

    return {
      loggedIn: true,
      username: result.username || 'DiceCloud User'
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

    // Only update activeCharacterId if slotId was explicitly provided
    // This prevents the "default" storage from overriding a specific slot selection
    const updates = {
      characterProfiles: characterProfiles,
      timestamp: Date.now()
    };

    // If slotId was explicitly provided, set it as active
    // If no slotId was provided but there's no active character, set this as active
    if (slotId || !result.activeCharacterId) {
      updates.activeCharacterId = storageId;
      debug.log(`Setting active character to: ${storageId}`);
    } else {
      debug.log(`Keeping existing active character: ${result.activeCharacterId}`);
    }

    await browserAPI.storage.local.set(updates);

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

    // Notify Roll20 tabs about the character change for experimental sync
    try {
      const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });
      if (tabs.length > 0) {
        // Get the character data to send the DiceCloud character ID
        const result = await browserAPI.storage.local.get(['characterProfiles']);
        const characterProfiles = result.characterProfiles || {};
        const characterData = characterProfiles[characterId];

        if (characterData && characterData.id) {
          debug.log(`Broadcasting active character change to Roll20 tabs: ${characterData.id}`);
          for (const tab of tabs) {
            browserAPI.tabs.sendMessage(tab.id, {
              action: 'activeCharacterChanged',
              characterId: characterData.id,
              slotId: characterId
            }).catch(err => {
              debug.warn(`Failed to notify tab ${tab.id} about character change:`, err);
            });
          }
        }
      }
    } catch (error) {
      debug.warn('Failed to broadcast character change to Roll20 tabs:', error);
    }
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
 * Sends GM Mode toggle to all open Roll20 tabs
 */
async function sendGMModeToggleToRoll20Tabs(enabled) {
  try {
    // Query all tabs for Roll20
    const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

    if (tabs.length === 0) {
      debug.warn('No Roll20 tabs found');
      return;
    }

    // Send GM Mode toggle to each Roll20 tab
    const promises = tabs.map(tab => {
      return browserAPI.tabs.sendMessage(tab.id, {
        action: 'toggleGMMode',
        enabled: enabled
      }).catch(err => {
        debug.warn(`Failed to send GM Mode toggle to tab ${tab.id}:`, err);
      });
    });

    await Promise.all(promises);
    debug.log(`GM Mode toggle sent to ${tabs.length} Roll20 tab(s)`);
  } catch (error) {
    debug.error('Failed to send GM Mode toggle to Roll20 tabs:', error);
    throw error;
  }
}

/**
 * Sends chat message to all open Roll20 tabs
 */
async function sendChatMessageToAllRoll20Tabs(message) {
  try {
    // Query all tabs for Roll20
    const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

    if (tabs.length === 0) {
      debug.warn('No Roll20 tabs found');
      return;
    }

    // Send chat message to each Roll20 tab
    const promises = tabs.map(tab => {
      return browserAPI.tabs.sendMessage(tab.id, {
        action: 'postChatMessageFromPopup',
        message: message
      }).catch(err => {
        debug.warn(`Failed to send chat message to tab ${tab.id}:`, err);
      });
    });

    await Promise.all(promises);
    debug.log(`Chat message sent to ${tabs.length} Roll20 tab(s)`);
  } catch (error) {
    debug.error('Failed to send chat message to Roll20 tabs:', error);
    throw error;
  }
}

/**
 * Handle extension installation
 */
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    debug.log('Extension installed');
    
    // Auto-open popup after installation
    setTimeout(() => {
      openExtensionPopup();
    }, 1000); // Wait 1 second for extension to fully initialize
    
  } else if (details.reason === 'update') {
    debug.log('Extension updated to version', browserAPI.runtime.getManifest().version);
  }
});

/**
 * Open the extension popup
 */
async function openExtensionPopup() {
  try {
    debug.log('🚀 Opening extension popup after installation...');
    
    // For Chrome, we can open the popup directly
    if (!isFirefox) {
      // Chrome doesn't have a direct API to open popup, but we can open the options page
      // which serves a similar purpose for first-time setup
      browserAPI.runtime.openOptionsPage();
      debug.log('✅ Opened options page for Chrome');
    } else {
      // For Firefox, we can try to open the popup
      try {
        // Firefox doesn't have a direct popup opening API either
        // So we'll open the options page as well
        browserAPI.runtime.openOptionsPage();
        debug.log('✅ Opened options page for Firefox');
      } catch (error) {
        debug.log('⚠️ Could not open options page:', error);
      }
    }
  } catch (error) {
    debug.log('❌ Error opening popup/options:', error);
  }
}

// ============================================================================
// Discord Webhook Integration
// ============================================================================

/**
 * Stores Discord webhook settings
 * @param {string} webhookUrl - The Discord webhook URL
 * @param {boolean} enabled - Whether notifications are enabled
 * @param {string} serverName - Optional Discord server name for display
 */
async function setDiscordWebhookSettings(webhookUrl, enabled = true, serverName = null) {
  try {
    const settings = {
      discordWebhookUrl: webhookUrl || '',
      discordWebhookEnabled: enabled
    };
    if (serverName) {
      settings.discordServerName = serverName;
    }
    await browserAPI.storage.local.set(settings);
    debug.log('Discord webhook settings saved:', { enabled, hasUrl: !!webhookUrl, serverName });
  } catch (error) {
    debug.error('Failed to save Discord webhook settings:', error);
    throw error;
  }
}

/**
 * Gets Discord webhook settings
 */
async function getDiscordWebhookSettings() {
  try {
    const result = await browserAPI.storage.local.get([
      'discordWebhookUrl',
      'discordWebhookEnabled',
      'discordServerName'
    ]);
    return {
      webhookUrl: result.discordWebhookUrl || '',
      enabled: result.discordWebhookEnabled !== false, // Default to true if URL exists
      serverName: result.discordServerName || null
    };
  } catch (error) {
    debug.error('Failed to get Discord webhook settings:', error);
    return { webhookUrl: '', enabled: false, serverName: null };
  }
}

/**
 * Tests a Discord webhook by sending a test message
 */
async function testDiscordWebhook(webhookUrl) {
  try {
    if (!webhookUrl || !webhookUrl.includes('discord.com/api/webhooks')) {
      return { success: false, error: 'Invalid Discord webhook URL' };
    }

    const testEmbed = {
      embeds: [{
        title: '🎲 RollCloud Connected!',
        description: 'Discord webhook integration is working correctly.',
        color: 0x4ECDC4, // Teal color matching the extension theme
        footer: {
          text: 'RollCloud - Dice Cloud → Roll20 Bridge'
        },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEmbed)
    });

    if (response.ok || response.status === 204) {
      debug.log('✅ Discord webhook test successful');
      return { success: true };
    } else {
      const errorText = await response.text();
      debug.warn('❌ Discord webhook test failed:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    debug.error('❌ Discord webhook test error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Posts a message to Discord via webhook
 * Rate limited to prevent spam (max 1 message per second)
 */
let lastDiscordPost = 0;
const DISCORD_RATE_LIMIT_MS = 1000;

async function postToDiscordWebhook(payload) {
  try {
    // Get webhook settings
    const settings = await getDiscordWebhookSettings();

    if (!settings.enabled || !settings.webhookUrl) {
      debug.log('Discord webhook disabled or not configured');
      return { success: false, error: 'Webhook not configured' };
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastDiscordPost < DISCORD_RATE_LIMIT_MS) {
      debug.log('Discord rate limit - skipping post');
      return { success: false, error: 'Rate limited' };
    }
    lastDiscordPost = now;

    // Build the Discord message
    const message = buildDiscordMessage(payload);

    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (response.ok || response.status === 204) {
      debug.log('✅ Posted to Discord:', payload.type);
      return { success: true };
    } else {
      const errorText = await response.text();
      debug.warn('❌ Discord post failed:', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    debug.error('❌ Discord post error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Builds a Discord embed message from the payload
 * Messages are structured for both human readability and Pip Bot parsing
 *
 * Pip Bot can parse these fields:
 * - embed.title: Contains character name and event type
 * - embed.fields: Structured data (character, round, actions)
 * - embed.footer.text: Contains parseable metadata like "TURN_START|Chepi|Round:3"
 */
function buildDiscordMessage(payload) {
  const { type, characterName, combatant, round, actions, initiative } = payload;

  // Action economy status icons
  const getIcon = (used) => used ? '❌' : '✅';

  // Build action status string
  const buildActionStatus = (acts) => {
    if (!acts) return null;
    return [
      `Action: ${getIcon(acts.action)}`,
      `Bonus: ${getIcon(acts.bonus)}`,
      `Move: ${getIcon(acts.movement)}`,
      `React: ${getIcon(acts.reaction)}`
    ].join(' | ');
  };

  // Build parseable footer for Pip Bot
  const buildFooter = (eventType, charName, roundNum, acts) => {
    const parts = [eventType, charName];
    if (roundNum) parts.push(`Round:${roundNum}`);
    if (acts) {
      const actionBits = [
        acts.action ? '0' : '1',
        acts.bonus ? '0' : '1',
        acts.movement ? '0' : '1',
        acts.reaction ? '0' : '1'
      ].join('');
      parts.push(`Actions:${actionBits}`); // e.g., "Actions:1111" = all available
    }
    return parts.join('|');
  };

  if (type === 'turnStart') {
    const actionStatus = buildActionStatus(actions);

    return {
      embeds: [{
        title: `🎲 ${characterName}'s Turn`,
        description: actionStatus || 'Combat turn started!',
        color: 0x4ECDC4, // Teal - active turn
        fields: [
          { name: 'Character', value: characterName, inline: true },
          ...(round ? [{ name: 'Round', value: String(round), inline: true }] : []),
          ...(initiative ? [{ name: 'Initiative', value: String(initiative), inline: true }] : [])
        ],
        footer: { text: buildFooter('TURN_START', characterName, round, actions) },
        timestamp: new Date().toISOString()
      }]
    };
  }

  if (type === 'turnEnd') {
    return {
      embeds: [{
        title: `⏸️ ${characterName}'s Turn Ended`,
        color: 0x95A5A6, // Gray - inactive
        fields: [
          { name: 'Character', value: characterName, inline: true }
        ],
        footer: { text: buildFooter('TURN_END', characterName, round) },
        timestamp: new Date().toISOString()
      }]
    };
  }

  if (type === 'actionUpdate') {
    const actionStatus = buildActionStatus(actions);
    const hasUsedActions = actions && (actions.action || actions.bonus);

    return {
      embeds: [{
        title: `⚔️ ${characterName}`,
        description: actionStatus,
        color: hasUsedActions ? 0xF39C12 : 0x4ECDC4, // Orange if actions used, teal if available
        fields: [
          { name: 'Character', value: characterName, inline: true },
          { name: 'Status', value: hasUsedActions ? 'Actions Used' : 'Actions Available', inline: true }
        ],
        footer: { text: buildFooter('ACTION_UPDATE', characterName, round, actions) },
        timestamp: new Date().toISOString()
      }]
    };
  }

  if (type === 'combatStart') {
    return {
      embeds: [{
        title: '⚔️ Combat Started!',
        description: combatant ? `First up: **${combatant}**` : 'Roll for initiative!',
        color: 0xE74C3C, // Red - combat
        footer: { text: 'COMBAT_START' },
        timestamp: new Date().toISOString()
      }]
    };
  }

  if (type === 'roundChange') {
    return {
      embeds: [{
        title: `🔄 Round ${round}`,
        description: combatant ? `Current turn: **${combatant}**` : 'New round begins!',
        color: 0x9B59B6, // Purple - round change
        footer: { text: `ROUND_CHANGE|Round:${round}` },
        timestamp: new Date().toISOString()
      }]
    };
  }

  // Default simple message
  return {
    content: payload.message || `🎲 ${characterName || 'Unknown'}: ${type}`
  };
}

// ============================================================================
// Discord Pairing via Supabase
// ============================================================================

// Supabase configuration - set these to enable automatic pairing
// If not configured, users can still use manual webhook URL entry
const SUPABASE_URL = 'https://gkfpxwvmumaylahtxqrk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZnB4d3ZtdW1heWxhaHR4cXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDA4MDIsImV4cCI6MjA4MDAxNjgwMn0.P4a17PQ7i1ZgUvLnFdQGupOtKxx8-CWvPhIaFOl2i7g';

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured() {
  return SUPABASE_URL &&
         !SUPABASE_URL.includes('your-project') &&
         SUPABASE_ANON_KEY &&
         SUPABASE_ANON_KEY !== 'your-anon-key';
}

/**
 * Create a Discord pairing code in Supabase
 */
async function createDiscordPairing(code, diceCloudUsername) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    debug.warn('Supabase not configured - pairing unavailable');
    return {
      success: false,
      error: 'Automatic pairing not available. Please use manual webhook setup.',
      supabaseNotConfigured: true
    };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rollcloud_pairings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        pairing_code: code,
        dicecloud_username: diceCloudUsername,
        status: 'pending'
      })
    });

    if (response.ok) {
      debug.log('✅ Discord pairing created:', code);
      return { success: true, code };
    } else {
      const error = await response.text();
      debug.error('❌ Failed to create pairing:', error);
      return { success: false, error: 'Failed to create pairing code' };
    }
  } catch (error) {
    debug.error('❌ Supabase error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a Discord pairing has been completed (webhook URL filled in)
 */
async function checkDiscordPairing(code) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured', supabaseNotConfigured: true };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        const pairing = data[0];
        if (pairing.status === 'connected' && pairing.webhook_url) {
          debug.log('✅ Discord pairing connected!');
          return {
            success: true,
            connected: true,
            webhookUrl: pairing.webhook_url,
            serverName: pairing.discord_guild_name,
            pairingId: pairing.id // Return pairing ID for command polling
          };
        } else {
          return { success: true, connected: false };
        }
      } else {
        return { success: false, error: 'Pairing code not found' };
      }
    } else {
      return { success: false, error: 'Failed to check pairing' };
    }
  } catch (error) {
    debug.error('❌ Supabase check error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Discord Command Polling (Discord → Extension → Roll20)
// ============================================================================

let commandPollInterval = null;
let currentPairingId = null;
const COMMAND_POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

/**
 * Start polling for Discord commands
 * Called when webhook is connected and user is in Roll20
 */
async function startCommandPolling(pairingId) {
  if (commandPollInterval) {
    debug.log('Command polling already active');
    return;
  }

  if (!pairingId) {
    // Try to get pairing ID from storage
    const settings = await browserAPI.storage.local.get(['discordPairingId']);
    pairingId = settings.discordPairingId;
  }

  if (!pairingId) {
    debug.warn('No pairing ID available for command polling');
    return;
  }

  currentPairingId = pairingId;
  debug.log('🎧 Starting Discord command polling for pairing:', pairingId);

  // Poll immediately, then set interval
  await pollForCommands();
  commandPollInterval = setInterval(pollForCommands, COMMAND_POLL_INTERVAL_MS);
}

/**
 * Stop polling for Discord commands
 */
function stopCommandPolling() {
  if (commandPollInterval) {
    clearInterval(commandPollInterval);
    commandPollInterval = null;
    debug.log('🔇 Stopped Discord command polling');
  }
}

/**
 * Poll Supabase for pending commands
 */
async function pollForCommands() {
  if (!isSupabaseConfigured() || !currentPairingId) {
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_commands?pairing_id=eq.${currentPairingId}&status=eq.pending&order=created_at.asc&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      debug.warn('Failed to poll for commands:', response.status);
      return;
    }

    const commands = await response.json();

    if (commands.length > 0) {
      debug.log(`📥 Received ${commands.length} command(s) from Discord`);

      for (const command of commands) {
        await executeCommand(command);
      }
    }
  } catch (error) {
    debug.error('Command poll error:', error);
  }
}

/**
 * Execute a command from Discord
 */
async function executeCommand(command) {
  debug.log('⚡ Executing command:', command.command_type, command);

  try {
    // Mark as processing
    await updateCommandStatus(command.id, 'processing');

    let result;

    switch (command.command_type) {
      case 'roll':
        result = await executeRollCommand(command);
        break;

      case 'use_action':
        result = await executeUseActionCommand(command, 'action');
        break;

      case 'use_bonus':
        result = await executeUseActionCommand(command, 'bonus');
        break;

      case 'end_turn':
        result = await executeEndTurnCommand(command);
        break;

      case 'use_ability':
        result = await executeUseAbilityCommand(command);
        break;

      default:
        result = { success: false, error: `Unknown command type: ${command.command_type}` };
    }

    // Mark as completed or failed
    await updateCommandStatus(
      command.id,
      result.success ? 'completed' : 'failed',
      result
    );

    debug.log('✅ Command executed:', command.command_type, result);
  } catch (error) {
    debug.error('❌ Command execution failed:', error);
    await updateCommandStatus(command.id, 'failed', null, error.message);
  }
}

/**
 * Execute a roll command (e.g., attack roll, save, check)
 */
async function executeRollCommand(command) {
  const { action_name, command_data } = command;

  // Build roll string from command data
  const rollString = command_data.roll_string || `/roll 1d20`;
  const rollName = action_name || command_data.roll_name || 'Discord Roll';

  // Send to Roll20
  await sendRollToAllRoll20Tabs({
    formula: rollString,
    name: rollName,
    source: 'discord'
  });

  return { success: true, message: `Rolled ${rollName}` };
}

/**
 * Execute an action/bonus action use command
 */
async function executeUseActionCommand(command, actionType) {
  const { action_name, command_data } = command;

  // Send action use to Roll20 tabs
  const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

  for (const tab of tabs) {
    try {
      await browserAPI.tabs.sendMessage(tab.id, {
        action: 'useActionFromDiscord',
        actionType: actionType,
        actionName: action_name,
        commandData: command_data
      });
    } catch (err) {
      debug.warn(`Failed to send action to tab ${tab.id}:`, err);
    }
  }

  return { success: true, message: `Used ${actionType}: ${action_name}` };
}

/**
 * Execute end turn command
 */
async function executeEndTurnCommand(command) {
  const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

  for (const tab of tabs) {
    try {
      await browserAPI.tabs.sendMessage(tab.id, {
        action: 'endTurnFromDiscord'
      });
    } catch (err) {
      debug.warn(`Failed to send end turn to tab ${tab.id}:`, err);
    }
  }

  return { success: true, message: 'Turn ended' };
}

/**
 * Execute use ability command (spell, feature, etc.)
 */
async function executeUseAbilityCommand(command) {
  const { action_name, command_data } = command;

  const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });

  for (const tab of tabs) {
    try {
      await browserAPI.tabs.sendMessage(tab.id, {
        action: 'useAbilityFromDiscord',
        abilityName: action_name,
        abilityData: command_data
      });
    } catch (err) {
      debug.warn(`Failed to send ability use to tab ${tab.id}:`, err);
    }
  }

  return { success: true, message: `Used ability: ${action_name}` };
}

/**
 * Update command status in Supabase
 */
async function updateCommandStatus(commandId, status, result = null, errorMessage = null) {
  if (!isSupabaseConfigured()) return;

  try {
    const update = {
      status: status,
      processed_at: new Date().toISOString()
    };

    if (result) {
      update.result = result;
    }

    if (errorMessage) {
      update.error_message = errorMessage;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_commands?id=eq.${commandId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(update)
      }
    );

    if (!response.ok) {
      debug.warn('Failed to update command status:', response.status);
    }
  } catch (error) {
    debug.error('Error updating command status:', error);
  }
}

/**
 * Store pairing ID for command polling
 */
async function storePairingId(pairingId) {
  await browserAPI.storage.local.set({ discordPairingId: pairingId });
  debug.log('Stored pairing ID:', pairingId);
}

// Auto-start polling when extension loads and webhook is configured
(async () => {
  try {
    const settings = await browserAPI.storage.local.get(['discordWebhookEnabled', 'discordPairingId']);
    if (settings.discordWebhookEnabled && settings.discordPairingId) {
      debug.log('Auto-starting command polling...');
      await startCommandPolling(settings.discordPairingId);
    }
  } catch (error) {
    debug.warn('Failed to auto-start command polling:', error);
  }
})();

// ============================================================================
// Turn Posting via Supabase (for Pip Bot to add buttons)
// ============================================================================

/**
 * Post turn data to Supabase for Pip Bot to pick up and post with buttons
 * This enables interactive buttons on Discord messages (webhooks can't do this)
 */
async function postTurnToSupabase(payload) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    // Fall back to webhook if Supabase not configured
    debug.log('Supabase not configured, falling back to webhook');
    return await postToDiscordWebhook(payload);
  }

  // Get pairing ID
  const settings = await browserAPI.storage.local.get(['discordPairingId']);
  if (!settings.discordPairingId) {
    debug.warn('No pairing ID, falling back to webhook');
    return await postToDiscordWebhook(payload);
  }

  const { type, characterName, round, actions, initiative } = payload;

  // Map payload type to event type
  const eventTypeMap = {
    turnStart: 'turn_start',
    turnEnd: 'turn_end',
    actionUpdate: 'action_update',
    combatStart: 'combat_start',
    roundChange: 'round_change'
  };

  const eventType = eventTypeMap[type] || type;

  try {
    // Get character data for available actions
    const characterData = await getCharacterData();
    const availableActions = characterData ? extractAvailableActions(characterData) : [];

    const turnData = {
      pairing_id: settings.discordPairingId,
      event_type: eventType,
      character_name: characterName,
      character_id: characterData?.id || null,
      round_number: round || null,
      initiative: initiative || null,
      action_available: actions ? !actions.action : true,
      bonus_available: actions ? !actions.bonus : true,
      movement_available: actions ? !actions.movement : true,
      reaction_available: actions ? !actions.reaction : true,
      available_actions: availableActions,
      status: 'pending'
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rollcloud_turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(turnData)
    });

    if (response.ok) {
      debug.log('✅ Turn posted to Supabase for Pip Bot:', eventType);
      return { success: true };
    } else {
      const error = await response.text();
      debug.warn('❌ Failed to post turn to Supabase:', error);
      // Fall back to webhook
      return await postToDiscordWebhook(payload);
    }
  } catch (error) {
    debug.error('❌ Error posting turn to Supabase:', error);
    // Fall back to webhook
    return await postToDiscordWebhook(payload);
  }
}

/**
 * Extract available actions from character data for Discord buttons
 * Returns array of { name, type, roll } objects
 */
function extractAvailableActions(characterData) {
  const actions = [];

  // Extract attacks
  if (characterData.attacks) {
    for (const attack of characterData.attacks) {
      actions.push({
        name: attack.name,
        type: 'action',
        roll: attack.attackBonus ? `1d20+${attack.attackBonus}` : '1d20',
        damage: attack.damage
      });
    }
  }

  // Extract spells (cantrips and prepared)
  if (characterData.spells) {
    for (const spell of characterData.spells) {
      if (spell.prepared || spell.level === 0) {
        actions.push({
          name: spell.name,
          type: spell.level === 0 ? 'cantrip' : 'spell',
          level: spell.level,
          actionType: spell.castingTime?.includes('bonus') ? 'bonus' : 'action'
        });
      }
    }
  }

  // Extract common actions
  actions.push(
    { name: 'Dodge', type: 'action', builtin: true },
    { name: 'Dash', type: 'action', builtin: true },
    { name: 'Disengage', type: 'action', builtin: true },
    { name: 'Help', type: 'action', builtin: true },
    { name: 'Hide', type: 'action', builtin: true, roll: '1d20+stealth' }
  );

  return actions;
}

// ============================================================================
// Native Messaging for Installer Communication
// ============================================================================

let installerPort = null;

/**
 * Connect to installer via native messaging
 */
async function connectToInstaller() {
  try {
    if (installerPort) {
      return installerPort;
    }

    // Try to connect to the installer native messaging host
    installerPort = browserAPI.runtime.connectNative('com.rollcloud.installer');
    
    installerPort.onMessage.addListener((message) => {
      debug.log('Received message from installer:', message);
      handleInstallerMessage(message);
    });
    
    installerPort.onDisconnect.addListener(() => {
      debug.log('Disconnected from installer');
      installerPort = null;
    });

    // Send a ping to test connection
    installerPort.postMessage({ type: 'ping' });
    
    debug.log('✅ Connected to installer via native messaging');
    return installerPort;
  } catch (error) {
    debug.warn('Failed to connect to installer:', error);
    return null;
  }
}

/**
 * Handle messages from installer
 */
function handleInstallerMessage(message) {
  switch (message.type) {
    case 'pong':
      debug.log('✅ Installer is available, requesting pairing code...');
      // After confirming connection, request pairing code
      if (installerPort) {
        installerPort.postMessage({ type: 'getPairingCode' });
      }
      break;

    case 'pairingCode':
      if (message.code) {
        debug.log('📥 Received pairing code from installer:', message.code);
        // Store the pairing code and start the pairing process
        handleInstallerPairingCode(message.code, message.username);
      } else {
        debug.log('No pairing code available from installer (code is null)');
      }
      break;

    default:
      debug.warn('Unknown message type from installer:', message.type);
  }
}

/**
 * Handle pairing code received from installer
 * @param {string} code - The pairing code
 * @param {string} installerUsername - Optional username from installer
 */
async function handleInstallerPairingCode(code, installerUsername = null) {
  try {
    // Store the pairing code
    await browserAPI.storage.local.set({
      installerPairingCode: code,
      pairingSource: 'installer'
    });

    // Get DiceCloud username - prefer installer-provided, fall back to local
    let diceCloudUsername = installerUsername;
    if (!diceCloudUsername) {
      const loginStatus = await checkLoginStatus();
      diceCloudUsername = loginStatus.username || 'DiceCloud User';
    }

    debug.log('📤 Creating Discord pairing with code:', code, 'username:', diceCloudUsername);

    // Create pairing in Supabase
    const result = await createDiscordPairing(code, diceCloudUsername);

    if (result.success) {
      debug.log('✅ Pairing created from installer code');

      // Notify popup that pairing is in progress
      broadcastToPopup({
        action: 'installerPairingStarted',
        code: code
      });
    } else {
      debug.error('Failed to create pairing from installer code:', result.error);
    }
  } catch (error) {
    debug.error('Error handling installer pairing code:', error);
  }
}

/**
 * Broadcast message to popup if it's open
 */
async function broadcastToPopup(message) {
  try {
    // Try to send to popup via runtime message
    await browserAPI.runtime.sendMessage(message);
  } catch (error) {
    // Popup might not be open, that's okay
    debug.log('Popup not available for broadcast');
  }
}

// Auto-connect to installer when extension loads
(async () => {
  setTimeout(async () => {
    await connectToInstaller();
  }, 2000); // Wait 2 seconds for extension to fully initialize
})();
