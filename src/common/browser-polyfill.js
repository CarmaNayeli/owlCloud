/**
 * Browser API Compatibility Layer
 *
 * This polyfill provides a unified API that works across Chrome and Firefox.
 * It detects which browser is being used and provides appropriate API wrappers.
 */

// Detect browser and get the appropriate API object
const isFirefox = typeof browser !== 'undefined' && browser.runtime;
const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

// Use the appropriate browser API
const browserAPI = isFirefox ? browser : chrome;

/**
 * Unified Browser API
 * All methods return Promises for consistency
 */

// Firefox already has Promise-based APIs, Chrome needs wrapping
if (isFirefox) {
  // Firefox: Use native Promise-based browser API directly
  window.browserAPI = {
    runtime: {
      sendMessage: (message) => browserAPI.runtime.sendMessage(message),
      onMessage: browserAPI.runtime.onMessage,
      getURL: (path) => browserAPI.runtime.getURL(path),
      getManifest: () => browserAPI.runtime.getManifest(),
      onInstalled: browserAPI.runtime.onInstalled,
      get lastError() { return browserAPI.runtime.lastError; }
    },
    storage: {
      local: {
        get: (keys) => browserAPI.storage.local.get(keys),
        set: (items) => browserAPI.storage.local.set(items),
        remove: (keys) => browserAPI.storage.local.remove(keys),
        clear: () => browserAPI.storage.local.clear()
      }
    },
    tabs: {
      query: (queryInfo) => browserAPI.tabs.query(queryInfo),
      sendMessage: (tabId, message) => browserAPI.tabs.sendMessage(tabId, message),
      get: (tabId) => browserAPI.tabs.get(tabId)
    }
  };
} else {
  // Chrome: Wrap callback-based APIs with Promises
  window.browserAPI = {
    runtime: {
      sendMessage: function(message) {
        return new Promise((resolve, reject) => {
          browserAPI.runtime.sendMessage(message, (response) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      },

      onMessage: {
        addListener: function(callback) {
          browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // Handle both sync and async callbacks
            const result = callback(request, sender, sendResponse);

            // If callback returns a Promise, handle it
            if (result && typeof result.then === 'function') {
              result.then(sendResponse).catch(err => {
                console.error('Message handler error:', err);
                sendResponse({ error: err.message });
              });
              return true; // Keep channel open for async response
            }

            return result;
          });
        }
      },

      getURL: function(path) {
        return browserAPI.runtime.getURL(path);
      },

      getManifest: function() {
        return browserAPI.runtime.getManifest();
      },

      onInstalled: {
        addListener: function(callback) {
          browserAPI.runtime.onInstalled.addListener(callback);
        }
      },

      get lastError() {
        return browserAPI.runtime.lastError;
      }
    },

    storage: {
      local: {
        get: function(keys) {
          return new Promise((resolve, reject) => {
            browserAPI.storage.local.get(keys, (result) => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          });
        },

        set: function(items) {
          return new Promise((resolve, reject) => {
            browserAPI.storage.local.set(items, () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        },

        remove: function(keys) {
          return new Promise((resolve, reject) => {
            browserAPI.storage.local.remove(keys, () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        },

        clear: function() {
          return new Promise((resolve, reject) => {
            browserAPI.storage.local.clear(() => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      }
    },

    tabs: {
      query: function(queryInfo) {
        return new Promise((resolve, reject) => {
          browserAPI.tabs.query(queryInfo, (tabs) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(tabs);
            }
          });
        });
      },

      sendMessage: function(tabId, message) {
        return new Promise((resolve, reject) => {
          browserAPI.tabs.sendMessage(tabId, message, (response) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      },

      get: function(tabId) {
        return new Promise((resolve, reject) => {
          browserAPI.tabs.get(tabId, (tab) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(tab);
            }
          });
        });
      }
    }
  };
}

// Export info about current browser
window.browserAPI.info = {
  isFirefox,
  isChrome,
  name: isFirefox ? 'firefox' : 'chrome'
};

console.log(`🌐 Browser API polyfill loaded for: ${window.browserAPI.info.name}`);
