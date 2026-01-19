/**
 * Browser API Compatibility Layer - Chrome & Firefox Support
 *
 * This provides a consistent browserAPI interface across Chrome and Firefox.
 * Firefox uses the 'browser' namespace (Promise-based), while Chrome uses 'chrome' (callback-based).
 */

console.log('🌐 Loading browser polyfill...');

// Use 'self' for service workers, 'window' for content scripts/popups
const globalScope = typeof window !== 'undefined' ? window : self;

// Detect browser and use appropriate API
let browserAPI;

if (typeof browser !== 'undefined' && browser.runtime) {
  // Firefox - uses native Promise-based API
  console.log('🦊 Detected Firefox');
  browserAPI = browser;
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Chrome - wrap callback-based API to be consistent with Firefox
  console.log('🌐 Detected Chrome');
  browserAPI = {
    runtime: {
      sendMessage: (...args) => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(...args, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      },
      onMessage: chrome.runtime.onMessage,
      getURL: chrome.runtime.getURL,
      id: chrome.runtime.id,
      lastError: chrome.runtime.lastError
    },
    storage: {
      local: {
        get: (keys) => {
          return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
        },
        set: (items) => {
          return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        },
        remove: (keys) => {
          return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        },
        clear: () => {
          return new Promise((resolve, reject) => {
            chrome.storage.local.clear(() => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        }
      }
    },
    tabs: {
      query: (queryInfo) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(tabs);
            }
          });
        });
      },
      sendMessage: (tabId, message) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      },
      create: (createProperties) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.create(createProperties, (tab) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(tab);
            }
          });
        });
      }
    }
  };
} else {
  console.error('❌ FATAL: No browser API available!');
  throw new Error('No browser API available');
}

// Expose as browserAPI for consistent naming
globalScope.browserAPI = browserAPI;

// Verify API is available
if (!globalScope.browserAPI || !globalScope.browserAPI.runtime) {
  console.error('❌ FATAL: Browser API not available!');
  throw new Error('Browser API not available');
}

console.log('✅ Browser API ready:', (typeof browser !== 'undefined' && browserAPI === browser) ? 'Firefox' : 'Chrome');
