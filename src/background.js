/**
 * Background Service Worker
 * Handles data storage and communication between Dice Cloud and Roll20
 */

console.log('Dice Cloud to Roll20 Importer: Background service worker initialized');

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      return true; // Keep channel open for async response

    case 'clearCharacterData':
      clearCharacterData()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error clearing character data:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Stores character data in chrome.storage
 */
async function storeCharacterData(characterData) {
  try {
    await chrome.storage.local.set({
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
 * Retrieves character data from chrome.storage
 */
async function getCharacterData() {
  try {
    const result = await chrome.storage.local.get(['characterData', 'timestamp']);
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
    await chrome.storage.local.remove(['characterData', 'timestamp']);
    console.log('Character data cleared successfully');
  } catch (error) {
    console.error('Failed to clear character data:', error);
    throw error;
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open welcome page or setup instructions
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});
