/**
 * Popup UI Script
 * Handles user interactions in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
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
  syncBtn.addEventListener('click', handleSync);
  showSheetBtn.addEventListener('click', handleShowSheet);
  clearBtn.addEventListener('click', handleClear);

  /**
   * Checks if the user is logged in and shows appropriate section
   */
  async function checkLoginStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkLoginStatus' });

      if (response.success && response.loggedIn) {
        showMainSection(response.username);
        loadCharacterData();
      } else {
        showLoginSection();
      }
    } catch (error) {
      console.error('Error checking login status:', error);
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

      const response = await chrome.runtime.sendMessage({
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
      console.error('Login error:', error);
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
      await chrome.runtime.sendMessage({ action: 'logout' });
      showLoginSection();
      clearCharacterDisplay();
    } catch (error) {
      console.error('Logout error:', error);
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
   * Loads character data from storage and updates UI
   */
  async function loadCharacterData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCharacterData' });
      if (response.success && response.data) {
        displayCharacterData(response.data);
      } else {
        clearCharacterDisplay();
      }
    } catch (error) {
      console.error('Error loading character data:', error);
      clearCharacterDisplay();
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Dice Cloud
      if (!tab.url || !(tab.url.includes('dicecloud.com'))) {
        showError('Please navigate to a Dice Cloud character sheet first');
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync from Dice Cloud';
        return;
      }

      // Send message to content script to sync data
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'syncCharacter' });

      if (response && response.success) {
        // Reload character data to display
        await loadCharacterData();
        showSuccess('Character synced successfully!');
      } else {
        showError(response?.error || 'Failed to sync character data');
      }
    } catch (error) {
      console.error('Error syncing character:', error);
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Roll20
      if (!tab.url || !tab.url.includes('roll20.net')) {
        showError('Please navigate to Roll20 first');
        showSheetBtn.disabled = false;
        showSheetBtn.textContent = '📋 Show Character Sheet';
        return;
      }

      // Send message to Roll20 content script to show sheet
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'showCharacterSheet' });

      if (response && response.success) {
        showSuccess('Character sheet opened!');
      } else {
        showError('Failed to open character sheet');
      }
    } catch (error) {
      console.error('Error showing character sheet:', error);
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
      await chrome.runtime.sendMessage({ action: 'clearCharacterData' });
      clearCharacterDisplay();
      showSuccess('Character data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
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
});
