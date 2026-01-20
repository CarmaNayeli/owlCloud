/**
 * Popup UI Script
 * Handles user interactions in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
  debug.log('🚀 Popup DOMContentLoaded fired');
  debug.log('🔍 browserAPI check:', typeof browserAPI);
  debug.log('🔍 window.browserAPI check:', typeof window.browserAPI);
  debug.log('🔍 chrome check:', typeof chrome);

  // Check if browserAPI is available
  if (typeof browserAPI === 'undefined' && typeof window.browserAPI === 'undefined') {
    debug.error('❌ FATAL: browserAPI is not defined!');
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-family: Arial;">
        <h2>Error: Browser API Not Loaded</h2>
        <p>The browser polyfill failed to load.</p>
        <p><strong>Steps to fix:</strong></p>
        <ol>
          <li>Go to chrome://extensions/</li>
          <li>Click "Remove" on RollCloud</li>
          <li>Reload the extension fresh</li>
        </ol>
        <p style="font-size: 12px; color: #666;">
          Check the console (F12) for more details.
        </p>
      </div>
    `;
    return;
  }

  try {
    initializePopup();
  } catch (error) {
    debug.error('❌ Popup initialization error:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-family: Arial;">
        <h2>Initialization Error</h2>
        <p>${error.message}</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error.stack}</pre>
      </div>
    `;
  }
});

function initializePopup() {
  debug.log('📋 Initializing popup UI...');

  // DOM Elements - Sections
  const loginSection = document.getElementById('loginSection');
  const mainSection = document.getElementById('mainSection');

  // DOM Elements - Login
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  // DOM Elements - Main Interface
  const usernameDisplay = document.getElementById('usernameDisplay');
  const logoutBtn = document.getElementById('logoutBtn');
  const characterSelector = document.getElementById('characterSelector');
  const characterSelect = document.getElementById('characterSelect');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const characterInfo = document.getElementById('characterInfo');
  const charName = document.getElementById('charName');
  const charLevel = document.getElementById('charLevel');
  const charClass = document.getElementById('charClass');
  const charRace = document.getElementById('charRace');
  const syncBtn = document.getElementById('syncBtn');
  const showSheetBtn = document.getElementById('showSheetBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Initialize
  checkLoginStatus();

  // Event Listeners - Login
  loginForm.addEventListener('submit', handleLogin);

  // Event Listeners - Main Interface
  logoutBtn.addEventListener('click', handleLogout);
  characterSelect.addEventListener('change', handleCharacterChange);
  syncBtn.addEventListener('click', handleSync);
  showSheetBtn.addEventListener('click', handleShowSheet);
  clearBtn.addEventListener('click', handleClear);

  /**
   * Checks if the user is logged in and shows appropriate section
   */
  async function checkLoginStatus() {
    try {
      const response = await browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' });

      if (response.success && response.loggedIn) {
        showMainSection(response.username);
        loadCharacterData();
      } else {
        showLoginSection();
      }
    } catch (error) {
      debug.error('Error checking login status:', error);
      showLoginSection();
    }
  }

  /**
   * Shows the login section
   */
  function showLoginSection() {
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
  }

  /**
   * Shows the main section
   */
  function showMainSection(username) {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    usernameDisplay.textContent = username || 'User';
  }

  /**
   * Handles login form submission
   */
  async function handleLogin(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showLoginError('Please enter both username and password');
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.textContent = '⏳ Logging in...';
      hideLoginError();

      const response = await browserAPI.runtime.sendMessage({
        action: 'loginToDiceCloud',
        username: username,
        password: password
      });

      if (response.success) {
        loginForm.reset();
        showMainSection(username);
        loadCharacterData();
      } else {
        showLoginError(response.error || 'Login failed');
      }
    } catch (error) {
      debug.error('Login error:', error);
      showLoginError('Login failed: ' + error.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '🔐 Login to DiceCloud';
    }
  }

  /**
   * Handles logout
   */
  async function handleLogout() {
    try {
      await browserAPI.runtime.sendMessage({ action: 'logout' });
      showLoginSection();
      clearCharacterDisplay();
    } catch (error) {
      debug.error('Logout error:', error);
    }
  }

  /**
   * Shows login error message
   */
  function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }

  /**
   * Hides login error message
   */
  function hideLoginError() {
    loginError.classList.add('hidden');
    loginError.textContent = '';
  }

  /**
   * Loads all character profiles and populates dropdown
   */
  async function loadCharacterData() {
    try {
      // Get all character profiles
      const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const profiles = profilesResponse.success ? profilesResponse.profiles : {};

      // Get the active character
      const activeResponse = await browserAPI.runtime.sendMessage({ action: 'getCharacterData' });
      const activeCharacter = activeResponse.success ? activeResponse.data : null;

      // Populate character dropdown
      const characterIds = Object.keys(profiles);
      if (characterIds.length > 0) {
        characterSelect.innerHTML = '';
        characterIds.forEach(id => {
          const char = profiles[id];
          const option = document.createElement('option');
          option.value = id;
          option.textContent = `${char.name || 'Unknown'} (${char.class || 'No Class'} ${char.level || '?'})`;
          if (activeCharacter && (char.characterId === activeCharacter.characterId || char._id === activeCharacter._id || id === (activeCharacter.characterId || activeCharacter._id))) {
            option.selected = true;
          }
          characterSelect.appendChild(option);
        });

        // Show character selector if there are multiple characters
        if (characterIds.length > 1) {
          characterSelector.classList.remove('hidden');
        } else {
          characterSelector.classList.add('hidden');
        }
      } else {
        characterSelect.innerHTML = '<option value="">No characters synced</option>';
        characterSelector.classList.add('hidden');
      }

      // Display active character data
      if (activeCharacter) {
        displayCharacterData(activeCharacter);
      } else {
        clearCharacterDisplay();
      }
    } catch (error) {
      debug.error('Error loading character data:', error);
      clearCharacterDisplay();
    }
  }

  /**
   * Handles character selection change
   */
  async function handleCharacterChange() {
    try {
      const selectedId = characterSelect.value;
      if (!selectedId) return;

      // Set this character as active
      await browserAPI.runtime.sendMessage({
        action: 'setActiveCharacter',
        characterId: selectedId
      });

      // Reload character data
      await loadCharacterData();
      showSuccess('Switched to selected character');
    } catch (error) {
      console.error('Error changing character:', error);
      showError('Failed to switch character');
    }
  }

  /**
   * Displays character data in the popup
   */
  function displayCharacterData(data) {
    statusIcon.textContent = '✅';
    statusText.textContent = 'Character data synced';
    characterInfo.classList.remove('hidden');
    charName.textContent = data.name || '-';
    charLevel.textContent = data.level || '-';
    charClass.textContent = data.class || '-';
    charRace.textContent = data.race || '-';
    showSheetBtn.disabled = false;
    clearBtn.disabled = false;
  }

  /**
   * Clears character display
   */
  function clearCharacterDisplay() {
    statusIcon.textContent = '⏳';
    statusText.textContent = 'No character data synced';
    characterInfo.classList.add('hidden');
    charName.textContent = '-';
    charLevel.textContent = '-';
    charClass.textContent = '-';
    charRace.textContent = '-';
    showSheetBtn.disabled = true;
    clearBtn.disabled = false;
  }

  /**
   * Handles sync button click
   */
  async function handleSync() {
    try {
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Syncing...';
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Syncing from Dice Cloud...';

      // Get current tab
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Dice Cloud
      if (!tab.url || !(tab.url.includes('dicecloud.com'))) {
        showError('Please navigate to a Dice Cloud character sheet first');
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync from Dice Cloud';
        return;
      }

      // Send message to content script to sync data
      const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'syncCharacter' });

      if (response && response.success) {
        // Reload character data to display
        await loadCharacterData();
        showSuccess('Character synced successfully!');
      } else {
        showError(response?.error || 'Failed to sync character data');
      }
    } catch (error) {
      debug.error('Error syncing character:', error);
      showError('Error: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sync from Dice Cloud';
    }
  }

  /**
   * Handles show sheet button click
   */
  async function handleShowSheet() {
    try {
      showSheetBtn.disabled = true;
      showSheetBtn.textContent = '⏳ Opening...';

      // Get current tab
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Roll20
      if (!tab.url || !tab.url.includes('roll20.net')) {
        showError('Please navigate to Roll20 first');
        showSheetBtn.disabled = false;
        showSheetBtn.textContent = '📋 Show Character Sheet';
        return;
      }

      // Send message to Roll20 content script to show sheet
      const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'showCharacterSheet' });

      if (response && response.success) {
        showSuccess('Character sheet opened!');
      } else {
        showError('Failed to open character sheet');
      }
    } catch (error) {
      debug.error('Error showing character sheet:', error);
      showError('Error: ' + error.message);
    } finally {
      showSheetBtn.disabled = false;
      showSheetBtn.textContent = '📋 Show Character Sheet';
    }
  }

  /**
   * Handles clear button click
   */
  async function handleClear() {
    try {
      clearBtn.disabled = true;

      // Get currently selected character ID
      const selectedId = characterSelect.value;

      if (selectedId) {
        // Clear specific character
        await browserAPI.runtime.sendMessage({
          action: 'clearCharacterData',
          characterId: selectedId
        });
        showSuccess('Character data cleared');
      } else {
        // Clear all if no character is selected
        await browserAPI.runtime.sendMessage({ action: 'clearCharacterData' });
        showSuccess('All character data cleared');
      }

      // Reload to update UI
      await loadCharacterData();
    } catch (error) {
      debug.error('Error clearing data:', error);
      showError('Error clearing data');
    } finally {
      clearBtn.disabled = false;
    }
  }

  /**
   * Shows success message
   */
  function showSuccess(message) {
    statusIcon.textContent = '✅';
    statusText.textContent = message;
    setTimeout(() => {
      loadCharacterData();
    }, 2000);
  }

  /**
   * Shows error message
   */
  function showError(message) {
    statusIcon.textContent = '❌';
    statusText.textContent = message;
    setTimeout(() => {
      loadCharacterData();
    }, 3000);
  }
} // End initializePopup
