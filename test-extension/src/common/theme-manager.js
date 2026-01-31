/**
 * Theme Manager Utility
 * Handles light/dark/system theme switching with persistence
 */

const ThemeManager = {
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
  },

  currentTheme: 'system',
  systemPrefersDark: false,

  /**
   * Initialize theme manager
   */
  async init() {
    // Check system preference
    if (window.matchMedia) {
      this.systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.systemPrefersDark = e.matches;
        if (this.currentTheme === this.THEMES.SYSTEM) {
          this.applyTheme(this.THEMES.SYSTEM);
        }
      });
    }

    // Load saved theme preference
    await this.loadThemePreference();

    // Apply initial theme
    this.applyTheme(this.currentTheme);

    debug.log('🎨 Theme Manager initialized:', this.currentTheme);
  },

  /**
   * Load theme preference from storage
   */
  async loadThemePreference() {
    try {
      if (typeof browserAPI !== 'undefined' && browserAPI.storage) {
        const result = await browserAPI.storage.local.get(['theme']);
        if (result.theme) {
          this.currentTheme = result.theme;
        }
      } else if (typeof localStorage !== 'undefined') {
        // Fallback to localStorage for popup windows
        const saved = localStorage.getItem('owlcloud-theme');
        if (saved) {
          this.currentTheme = saved;
        }
      }
    } catch (error) {
      debug.error('Failed to load theme preference:', error);
    }
  },

  /**
   * Save theme preference to storage
   */
  async saveThemePreference(theme) {
    try {
      this.currentTheme = theme;

      if (typeof browserAPI !== 'undefined' && browserAPI.storage) {
        await browserAPI.storage.local.set({ theme: theme });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('owlcloud-theme', theme);
      }

      debug.log('💾 Theme preference saved:', theme);
    } catch (error) {
      debug.error('Failed to save theme preference:', error);
    }
  },

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    const effectiveTheme = this.getEffectiveTheme(theme);

    // Remove existing theme classes
    document.documentElement.classList.remove('theme-light', 'theme-dark');

    // Add new theme class
    document.documentElement.classList.add(`theme-${effectiveTheme}`);

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    debug.log('🎨 Applied theme:', effectiveTheme, '(requested:', theme, ')');
  },

  /**
   * Get the effective theme (resolves 'system' to light/dark)
   */
  getEffectiveTheme(theme) {
    if (theme === this.THEMES.SYSTEM) {
      return this.systemPrefersDark ? this.THEMES.DARK : this.THEMES.LIGHT;
    }
    return theme;
  },

  /**
   * Set theme and save preference
   */
  async setTheme(theme) {
    if (!Object.values(this.THEMES).includes(theme)) {
      debug.error('Invalid theme:', theme);
      return;
    }

    await this.saveThemePreference(theme);
    this.applyTheme(theme);

    // Notify other parts of the extension about theme change
    this.notifyThemeChange(theme);
  },

  /**
   * Notify about theme change (for communication between popup/content scripts)
   */
  notifyThemeChange(theme) {
    // Send message to background script
    if (typeof browserAPI !== 'undefined' && browserAPI.runtime) {
      browserAPI.runtime.sendMessage({
        action: 'themeChanged',
        theme: theme
      }).catch(() => {
        // Ignore errors if background script isn't listening
      });
    }

    // Dispatch custom event for same-page listeners
    window.dispatchEvent(new CustomEvent('owlcloud-theme-changed', {
      detail: { theme: theme }
    }));
  },

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  },

  /**
   * Get effective theme (with system resolved)
   */
  getEffectiveCurrentTheme() {
    return this.getEffectiveTheme(this.currentTheme);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}
