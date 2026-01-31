/**
 * Macro System Module
 *
 * Handles custom roll macros - creation, storage, execution, and settings UI.
 * Includes the full settings modal with tabs for macros and preferences.
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - loadCustomMacros()
 * - saveAllCustomMacros()
 * - addCustomMacro(name, formula, description)
 * - deleteCustomMacro(macroId)
 * - executeMacro(macro)
 * - updateMacrosDisplay()
 * - showSettingsModal()
 * - showAddMacroModal()
 * - updateMacrosDisplayInSettings()
 * - initCustomMacros()
 * - initSettingsButton()
 *
 * State variables exported to globalThis:
 * - customMacros
 */

(function() {
  'use strict';

  // ===== STATE =====

  // Setting to show/hide custom macro buttons on spells
  let showCustomMacroButtons = false;

  let customMacros = [];

/**
 * Load custom macros from storage
 */
async function loadCustomMacros() {
  try {
    const result = await browserAPI.storage.local.get(['customMacros']);
    customMacros = result.customMacros || [];
    debug.log(`🎲 Loaded ${customMacros.length} custom macros`);
    updateMacrosDisplay();
  } catch (error) {
    debug.error('❌ Failed to load custom macros:', error);
  }
}

/**
 * Save all custom macros to storage
 */
function saveAllCustomMacros() {
  browserAPI.storage.local.set({ customMacros });
  debug.log(`💾 Saved ${customMacros.length} custom macros`);
}

/**
 * Add a new custom macro
 */
function addCustomMacro(name, formula, description = '') {
  const macro = {
    id: Date.now().toString(),
    name,
    formula,
    description,
    createdAt: Date.now()
  };
  
  customMacros.push(macro);
  saveAllCustomMacros();
  updateMacrosDisplay();
  
  debug.log(`✅ Added custom macro: ${name} (${formula})`);
  return macro;
}

/**
 * Delete a custom macro
 */
function deleteCustomMacro(macroId) {
  customMacros = customMacros.filter(m => m.id !== macroId);
  saveAllCustomMacros();
  updateMacrosDisplay();
  debug.log(`🗑️ Deleted macro: ${macroId}`);
}

/**
 * Execute a custom macro (roll the formula)
 */
function executeMacro(macro) {
  debug.log(`🎲 Executing macro: ${macro.name} (${macro.formula})`);
  
  // Use the existing roll announcement system
  announceAction(
    macro.name,
    macro.formula,
    '',
    macro.description || `Custom macro: ${macro.formula}`
  );
}

/**
 * Update the macros display in the UI
 */
function updateMacrosDisplay() {
  const container = document.getElementById('custom-macros-container');
  if (!container) return;
  
  if (customMacros.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No custom macros yet. Click "Add Macro" to create one.</p>';
    return;
  }
  
  container.innerHTML = customMacros.map(macro => `
    <div class="macro-item" style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    ">
      <div style="flex: 1;">
        <div style="font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
          ${macro.name}
        </div>
        <div style="font-family: monospace; color: var(--accent-info); font-size: 0.9em; margin-bottom: 4px;">
          ${macro.formula}
        </div>
        ${macro.description ? `<div style="font-size: 0.85em; color: var(--text-secondary);">${macro.description}</div>` : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="macro-roll-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        ">
          🎲 Roll
        </button>
        <button class="macro-delete-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        ">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  container.querySelectorAll('.macro-roll-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro) executeMacro(macro);
    });
  });
  
  container.querySelectorAll('.macro-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro && confirm(`Delete macro "${macro.name}"?`)) {
        deleteCustomMacro(macroId);
      }
    });
  });
}

/**
 * Show settings modal with tabs
 */
function showSettingsModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('settings-modal');
  if (existingModal) {
    document.body.removeChild(existingModal);
  }
  
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <!-- Header -->
      <div style="
        padding: 20px;
        border-bottom: 2px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: var(--text-primary);">⚙️ Settings</h3>
        <button id="settings-close-btn" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">✕</button>
      </div>
      
      <!-- Tabs -->
      <div style="
        display: flex;
        border-bottom: 2px solid var(--border-color);
        background: var(--bg-tertiary);
      ">
        <button class="settings-tab active" data-tab="theme" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">🎨 Theme</button>
        <button class="settings-tab" data-tab="macros" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">🎲 Custom Macros</button>
        <button class="settings-tab" data-tab="gm" style="
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: bold;
          color: var(--text-secondary);
          transition: all 0.2s;
        ">👑 GM Integration</button>
      </div>
      
      <!-- Content -->
      <div style="
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      ">
        <!-- Theme Tab -->
        <div id="theme-tab-content" class="settings-tab-content">
          <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Choose Theme</h4>
          <div style="display: flex; gap: 15px; margin-bottom: 20px;">
            <button class="theme-option" data-theme="light" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--border-color);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">☀️</span>
              <span style="font-weight: bold; color: var(--text-primary);">Light</span>
            </button>
            <button class="theme-option" data-theme="dark" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--border-color);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">🌙</span>
              <span style="font-weight: bold; color: var(--text-primary);">Dark</span>
            </button>
            <button class="theme-option active" data-theme="system" style="
              flex: 1;
              padding: 20px;
              background: var(--bg-primary);
              border: 3px solid var(--accent-primary);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            ">
              <span style="font-size: 2em;">💻</span>
              <span style="font-weight: bold; color: var(--text-primary);">System</span>
            </button>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.9em; margin: 0;">
            System theme automatically matches your operating system's appearance settings.
          </p>
        </div>
        
        <!-- Macros Tab -->
        <div id="macros-tab-content" class="settings-tab-content" style="display: none;">
          <!-- Setting: Show gear buttons on spells -->
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="show-macro-buttons-setting" style="width: 18px; height: 18px;" ${showCustomMacroButtons ? 'checked' : ''}>
              <span style="color: var(--text-primary); font-weight: bold;">Show ⚙️ macro buttons on spells</span>
            </label>
            <p style="margin: 8px 0 0 28px; color: var(--text-secondary); font-size: 0.85em;">
              When enabled, shows a gear button on each spell to configure custom Roll20 macros.
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0; color: var(--text-primary);">Your Custom Macros</h4>
            <button id="add-macro-btn-settings" style="
              padding: 8px 16px;
              background: var(--accent-primary);
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">➕ Add Macro</button>
          </div>
          <div id="custom-macros-container-settings"></div>
        </div>
        
        <!-- GM Integration Tab -->
        <div id="gm-tab-content" class="settings-tab-content" style="display: none;">
          <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">👑 GM Integration</h4>

          <!-- DiceCloud Sync Section -->
          <div id="dicecloud-sync-section" style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px; display: none;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">🔄 DiceCloud Sync</h5>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 0.9em;">
              Manually sync all character data to DiceCloud. This updates HP, spell slots, Channel Divinity, class resources, and all other tracked values.
            </p>
            <button id="manual-sync-btn" style="
              background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 1em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              width: 100%;
            ">
              🔄 Sync to DiceCloud Now
            </button>
            <div id="sync-status" style="margin-top: 10px; padding: 8px; border-radius: 6px; font-size: 0.9em; display: none;"></div>
          </div>

          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">Share Character with GM</h5>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 0.9em;">
              Share your complete character sheet with the Game Master. This sends all your character data including abilities, skills, actions, spells, and equipment.
            </p>
            <button id="show-to-gm-btn" class="show-to-gm-btn" style="
              background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 1em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              width: 100%;
            ">
              👑 Share Character with GM
            </button>
          </div>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">How It Works</h5>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 0.9em;">
              <li>Click the button above to share your character</li>
              <li>Your character data appears in the Roll20 chat</li>
              <li>The GM receives your complete character sheet</li>
              <li>GM can view your stats, actions, and spells</li>
              <li>Helps GM track party composition and abilities</li>
            </ul>
          </div>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px;">
            <h5 style="margin: 0 0 10px 0; color: var(--text-primary);">Privacy Note</h5>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9em;">
              Only share character data when requested by your GM. The shared data includes your complete character sheet for game management purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set up tab switching
  modal.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tab buttons
      modal.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = 'var(--text-secondary)';
        t.style.background = 'transparent';
      });
      tab.classList.add('active');
      tab.style.color = 'var(--text-primary)';
      tab.style.background = 'var(--bg-secondary)';
      
      // Update content
      modal.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      modal.querySelector(`#${tabName}-tab-content`).style.display = 'block';
    });
  });
  
  // Set up theme options
  const currentTheme = ThemeManager.getCurrentTheme();
  modal.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === currentTheme) {
      option.style.borderColor = 'var(--accent-primary)';
      option.classList.add('active');
    }
    
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      ThemeManager.setTheme(theme);
      
      // Update active state
      modal.querySelectorAll('.theme-option').forEach(opt => {
        opt.style.borderColor = 'var(--border-color)';
        opt.classList.remove('active');
      });
      option.style.borderColor = 'var(--accent-primary)';
      option.classList.add('active');
    });
  });
  
  // Load macros into settings
  updateMacrosDisplayInSettings();
  
  // Initialize Show to GM button in settings
  initShowToGM();

  // Initialize manual DiceCloud sync button (experimental builds only)
  initManualSyncButton();

  // Set up add macro button
  modal.querySelector('#add-macro-btn-settings').addEventListener('click', () => {
    showAddMacroModal();
  });

  // Set up show macro buttons checkbox
  const macroButtonsCheckbox = modal.querySelector('#show-macro-buttons-setting');
  if (macroButtonsCheckbox) {
    macroButtonsCheckbox.addEventListener('change', (e) => {
      showCustomMacroButtons = e.target.checked;
      localStorage.setItem('showCustomMacroButtons', showCustomMacroButtons ? 'true' : 'false');
      debug.log(`⚙️ Custom macro buttons ${showCustomMacroButtons ? 'enabled' : 'disabled'}`);
      // Rebuild spells to show/hide gear buttons
      rebuildSpells();
    });
  }

  // Close button
  modal.querySelector('#settings-close-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Show add macro modal (simplified version for settings)
 */
function showAddMacroModal() {
  const modal = document.createElement('div');
  modal.id = 'add-macro-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  modal.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary);">🎲 Add Custom Macro</h3>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Macro Name
        </label>
        <input type="text" id="macro-name-input" placeholder="e.g., Sneak Attack" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Roll Formula
        </label>
        <input type="text" id="macro-formula-input" placeholder="e.g., 3d6" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          font-family: monospace;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
        <small style="color: var(--text-secondary); font-size: 0.85em;">
          Examples: 1d20+5, 2d6+3, 8d6, 1d20+dexterity.modifier
        </small>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--text-primary);">
          Description (optional)
        </label>
        <input type="text" id="macro-description-input" placeholder="e.g., Extra damage on hit" style="
          width: 100%;
          padding: 10px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: var(--bg-primary);
          color: var(--text-primary);
        ">
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="macro-cancel-btn" style="
          padding: 10px 20px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 2px solid var(--border-color);
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">
          Cancel
        </button>
        <button id="macro-save-btn" style="
          padding: 10px 20px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">
          Save Macro
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('macro-name-input').focus();
  
  document.getElementById('macro-cancel-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.getElementById('macro-save-btn').addEventListener('click', () => {
    const name = document.getElementById('macro-name-input').value.trim();
    const formula = document.getElementById('macro-formula-input').value.trim();
    const description = document.getElementById('macro-description-input').value.trim();
    
    if (!name || !formula) {
      alert('Please enter both a name and formula for the macro.');
      return;
    }
    
    addCustomMacro(name, formula, description);
    document.body.removeChild(modal);
    updateMacrosDisplayInSettings();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Update macros display in settings modal
 */
function updateMacrosDisplayInSettings() {
  const container = document.getElementById('custom-macros-container-settings');
  if (!container) return;
  
  if (customMacros.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No custom macros yet. Click "Add Macro" to create one.</p>';
    return;
  }
  
  container.innerHTML = customMacros.map(macro => `
    <div class="macro-item" style="
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    ">
      <div style="flex: 1;">
        <div style="font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
          ${macro.name}
        </div>
        <div style="font-family: monospace; color: var(--accent-info); font-size: 0.9em; margin-bottom: 4px;">
          ${macro.formula}
        </div>
        ${macro.description ? `<div style="font-size: 0.85em; color: var(--text-secondary);">${macro.description}</div>` : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="macro-roll-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        ">
          🎲 Roll
        </button>
        <button class="macro-delete-btn" data-macro-id="${macro.id}" style="
          background: var(--accent-danger);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        ">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.macro-roll-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro) {
        executeMacro(macro);
        // Close settings modal after rolling
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
          document.body.removeChild(settingsModal);
        }
      }
    });
  });
  
  container.querySelectorAll('.macro-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const macroId = btn.dataset.macroId;
      const macro = customMacros.find(m => m.id === macroId);
      if (macro && confirm(`Delete macro "${macro.name}"?`)) {
        deleteCustomMacro(macroId);
        updateMacrosDisplayInSettings();
      }
    });
  });
}

/**
 * Initialize custom macros system
 */
function initCustomMacros() {
  loadCustomMacros();

  // Load custom macro button setting (default: disabled)
  const savedSetting = localStorage.getItem('showCustomMacroButtons');
  showCustomMacroButtons = savedSetting === 'true';
  debug.log(`⚙️ Custom macro buttons setting: ${showCustomMacroButtons ? 'enabled' : 'disabled'}`);

  debug.log('🎲 Custom macros system initialized');
}

/**
 * Initialize settings button
 */
function initSettingsButton() {
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsModal);
    debug.log('⚙️ Settings button initialized');
  }
}

  // ===== EXPORTS =====

  // Export functions to globalThis
  globalThis.loadCustomMacros = loadCustomMacros;
  globalThis.saveAllCustomMacros = saveAllCustomMacros;
  globalThis.addCustomMacro = addCustomMacro;
  globalThis.deleteCustomMacro = deleteCustomMacro;
  globalThis.executeMacro = executeMacro;
  globalThis.updateMacrosDisplay = updateMacrosDisplay;
  globalThis.showSettingsModal = showSettingsModal;
  globalThis.showAddMacroModal = showAddMacroModal;
  globalThis.updateMacrosDisplayInSettings = updateMacrosDisplayInSettings;
  globalThis.initCustomMacros = initCustomMacros;
  globalThis.initSettingsButton = initSettingsButton;

  // Export state variables to globalThis
  globalThis.customMacros = customMacros;
  globalThis.showCustomMacroButtons = showCustomMacroButtons;

  debug.log('✅ Macro System module loaded');

})();
