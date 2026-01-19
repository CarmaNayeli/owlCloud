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
  // Chrome - wrap callback-based API to be consistent
  console.log('🌐 Detected Chrome');
  browserAPI = chrome;
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
