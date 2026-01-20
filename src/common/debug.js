/**
 * Debug Logging Utility
 *
 * Centralized logging system that can be enabled/disabled.
 * In production, debug logs are suppressed to improve performance.
 * Errors are always logged regardless of debug mode.
 */

// Debug mode can be controlled by:
// 1. Build process (set DEBUG = false for production)
// 2. Extension storage (allow users to enable debug mode)
// 3. URL parameter (for testing)
const DEBUG = true; // TODO: Set to false for production builds

/**
 * Debug logger instance
 * Provides methods for different log levels
 */
const debug = {
  /**
   * General debug information
   * Only logged when DEBUG = true
   */
  log: (...args) => {
    if (DEBUG) {
      console.log(...args);
    }
  },

  /**
   * Warning messages
   * Only logged when DEBUG = true
   */
  warn: (...args) => {
    if (DEBUG) {
      console.warn(...args);
    }
  },

  /**
   * Error messages
   * ALWAYS logged, regardless of DEBUG mode
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Info messages (less noisy than log)
   * Only logged when DEBUG = true
   */
  info: (...args) => {
    if (DEBUG) {
      console.info(...args);
    }
  },

  /**
   * Group logs together for better readability
   * Only when DEBUG = true
   */
  group: (label, ...args) => {
    if (DEBUG) {
      console.group(label, ...args);
    }
  },

  groupEnd: () => {
    if (DEBUG) {
      console.groupEnd();
    }
  },

  /**
   * Table output for structured data
   * Only when DEBUG = true
   */
  table: (data) => {
    if (DEBUG) {
      console.table(data);
    }
  },

  /**
   * Performance timing
   * Only when DEBUG = true
   */
  time: (label) => {
    if (DEBUG) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (DEBUG) {
      console.timeEnd(label);
    }
  },

  /**
   * Check if debug mode is enabled
   */
  isEnabled: () => DEBUG
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = debug;
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.debug = debug;
}

// Make available for service workers
if (typeof self !== 'undefined' && !self.window) {
  self.debug = debug;
}
