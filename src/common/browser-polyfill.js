/**
 * Browser API Compatibility Layer - Chrome Only (Simplified)
 *
 * For Chrome, we just expose the native chrome API as browserAPI.
 * This provides a consistent API name across all our code.
 */

console.log('🌐 Loading browser polyfill for Chrome...');

// Use 'self' for service workers, 'window' for content scripts/popups
const globalScope = typeof window !== 'undefined' ? window : self;

// Expose chrome API as browserAPI for consistent naming
globalScope.browserAPI = chrome;

// Verify API is available
if (!globalScope.browserAPI || !globalScope.browserAPI.runtime) {
  console.error('❌ FATAL: Chrome API not available!');
  throw new Error('Chrome API not available');
}

console.log('✅ Browser API ready (Chrome)');
