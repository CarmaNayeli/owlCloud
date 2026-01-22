/**
 * Popup UI Script
 * Handles user interactions in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
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
  // DOM Elements - Sections
  const loginSection = document.getElementById('loginSection');
  const mainSection = document.getElementById('mainSection');

  // DOM Elements - Login
  const autoConnectBtn = document.getElementById('autoConnectBtn');
  const usernameLoginForm = document.getElementById('usernameLoginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const usernameLoginBtn = document.getElementById('usernameLoginBtn');
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

  // Enable button for testing
  if (showSheetBtn) {
    showSheetBtn.disabled = false;

    // Add basic styling to make it visible
    showSheetBtn.style.display = 'inline-block';
    showSheetBtn.style.width = 'auto';
    showSheetBtn.style.height = 'auto';
    showSheetBtn.style.padding = '8px 16px';
    showSheetBtn.style.margin = '5px';
    showSheetBtn.style.visibility = 'visible';
  }

  // Initialize
  checkLoginStatus();

  // Event Listeners - Login
  autoConnectBtn.addEventListener('click', handleAutoConnect);
  usernameLoginForm.addEventListener('submit', handleUsernameLogin);

  // Event Listeners - Main Interface
  logoutBtn.addEventListener('click', handleLogout);
  characterSelect.addEventListener('change', handleCharacterChange);
  syncBtn.addEventListener('click', handleSync);

  if (showSheetBtn) {
    showSheetBtn.addEventListener('click', handleShowSheet);
  } else {
    debug.error('❌ showSheetBtn not found!');
  }

  clearBtn.addEventListener('click', handleClear);

  // Modal event listeners
  document.getElementById('closeSlotModal').addEventListener('click', closeSlotModal);

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
   * Handles auto-connect - opens DiceCloud and captures token
   */
  async function handleAutoConnect() {
    try {
      autoConnectBtn.disabled = true;
      autoConnectBtn.textContent = '⏳ Opening DiceCloud...';
      hideLoginError();

      // Open DiceCloud in a new tab
      const dicecloudTab = await browserAPI.tabs.create({
        url: 'https://dicecloud.com',
        active: true
      });

      // Update button text
      autoConnectBtn.textContent = '⏳ Waiting for login...';

      // Show instructions
      showLoginError('Please log in to DiceCloud in the new tab, then click "Capture Token" below');

      // Add a "Capture Token" button
      let captureBtn = document.getElementById('captureTokenBtn');
      if (!captureBtn) {
        captureBtn = document.createElement('button');
        captureBtn.id = 'captureTokenBtn';
        captureBtn.className = 'btn btn-primary';
        captureBtn.style.width = '100%';
        captureBtn.style.marginTop = '10px';
        captureBtn.textContent = '✓ Capture Token (Click after logging in)';
        autoConnectBtn.parentElement.appendChild(captureBtn);

        captureBtn.addEventListener('click', async () => {
          try {
            captureBtn.disabled = true;
            captureBtn.textContent = '⏳ Capturing token...';

            // Send message to DiceCloud tab to extract token
            const response = await browserAPI.tabs.sendMessage(dicecloudTab.id, {
              action: 'extractAuthToken'
            });

            if (response && response.success && response.token) {
              // Store the token with metadata
              await browserAPI.runtime.sendMessage({
                action: 'setApiToken',
                token: response.token,
                userId: response.userId,
                tokenExpires: response.tokenExpires,
                username: response.username
              });

              // Close DiceCloud tab
              await browserAPI.tabs.remove(dicecloudTab.id);

              // Remove capture button
              captureBtn.remove();

              // Show success and load data
              hideLoginError();
              showMainSection(response.username || 'DiceCloud User');
              loadCharacterData();
            } else {
              showLoginError('Failed to capture token. Make sure you are logged in to DiceCloud.');
              captureBtn.disabled = false;
              captureBtn.textContent = '✓ Capture Token (Click after logging in)';
            }
          } catch (error) {
            debug.error('Error capturing token:', error);
            showLoginError('Error: ' + error.message);
            captureBtn.disabled = false;
            captureBtn.textContent = '✓ Capture Token (Click after logging in)';
          }
        });
      }
    } catch (error) {
      debug.error('Auto-connect error:', error);
      showLoginError('Error: ' + error.message);
    } finally {
      autoConnectBtn.disabled = false;
      autoConnectBtn.textContent = '🔐 Connect with DiceCloud';
    }
  }

  /**
   * Handles username/password login
   */
  async function handleUsernameLogin(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showLoginError('Please enter both username and password');
      return;
    }

    try {
      usernameLoginBtn.disabled = true;
      usernameLoginBtn.textContent = '⏳ Logging in...';
      hideLoginError();

      const response = await browserAPI.runtime.sendMessage({
        action: 'loginToDiceCloud',
        username: username,
        password: password
      });

      if (response.success) {
        usernameLoginForm.reset();
        showMainSection(username);
        loadCharacterData();
      } else {
        showLoginError(response.error || 'Login failed');
      }
    } catch (error) {
      debug.error('Login error:', error);
      showLoginError('Login failed: ' + error.message);
    } finally {
      usernameLoginBtn.disabled = false;
      usernameLoginBtn.textContent = '🔐 Login to DiceCloud';
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

      // Populate character dropdown (exclude GM player data)
      const characterIds = Object.keys(profiles).filter(id =>
        profiles[id].type !== 'rollcloudPlayer'
      );
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

        // Always show character selector when characters exist
        characterSelector.classList.remove('hidden');
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
      debug.error('Error changing character:', error);
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
    // Keep showSheetBtn enabled for testing
    showSheetBtn.disabled = false;
    clearBtn.disabled = false;
  }

  /**
   * Handles sync button click - opens slot selection modal
   */
  async function handleSync() {
    try {
      // Get current tab
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Dice Cloud
      if (!tab.url || !(tab.url.includes('dicecloud.com'))) {
        showError('Please navigate to a Dice Cloud character sheet first');
        return;
      }

      // Open slot selection modal
      await showSlotSelectionModal(tab);
    } catch (error) {
      debug.error('Error opening slot selection:', error);
      showError('Error: ' + error.message);
    }
  }

  /**
   * Shows the slot selection modal
   */
  async function showSlotSelectionModal(tab) {
    const modal = document.getElementById('slotModal');
    const slotGrid = document.getElementById('slotGrid');

    // Get all character profiles
    const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
    const profiles = profilesResponse.success ? profilesResponse.profiles : {};

    // Create 10 slots
    slotGrid.innerHTML = '';
    const MAX_SLOTS = 10;

    for (let i = 1; i <= MAX_SLOTS; i++) {
      const slotId = `slot-${i}`;
      const existingChar = profiles[slotId];

      const slotCard = document.createElement('div');
      slotCard.className = existingChar ? 'slot-card' : 'slot-card empty';
      slotCard.dataset.slotId = slotId;

      if (existingChar) {
        slotCard.innerHTML = `
          <div class="slot-header">
            <span class="slot-number">Slot ${i}</span>
            <span class="slot-badge occupied">Occupied</span>
          </div>
          <div class="slot-info">
            <strong>${existingChar.name || 'Unknown'}</strong>
          </div>
          <div class="slot-details">
            ${existingChar.class || 'No Class'} ${existingChar.level || '?'} • ${existingChar.race || 'Unknown Race'}
          </div>
        `;
      } else {
        slotCard.innerHTML = `
          <div class="slot-header">
            <span class="slot-number">Slot ${i}</span>
            <span class="slot-badge empty">Empty</span>
          </div>
          <div class="slot-info empty-text">
            Click to save character here
          </div>
        `;
      }

      // Add click handler
      slotCard.addEventListener('click', () => handleSlotSelection(slotId, tab));

      slotGrid.appendChild(slotCard);
    }

    // Show modal
    modal.classList.remove('hidden');
  }

  /**
   * Closes the slot selection modal
   */
  function closeSlotModal() {
    const modal = document.getElementById('slotModal');
    modal.classList.add('hidden');
  }

  /**
   * Handles slot selection and performs sync
   */
  async function handleSlotSelection(slotId, tab) {
    try {
      // Close modal
      closeSlotModal();

      // Show syncing status
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Syncing...';
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Syncing from Dice Cloud...';

      // Send message to content script to sync data with slot ID
      const response = await browserAPI.tabs.sendMessage(tab.id, {
        action: 'syncCharacter',
        slotId: slotId
      });

      if (response && response.success) {
        // Reload character data to display
        await loadCharacterData();
        showSuccess(`Character synced to ${slotId.replace('slot-', 'Slot ')}!`);
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

      // Check if there's any synced character data (excluding GM player data)
      const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const profiles = profilesResponse.success ? profilesResponse.profiles : {};
      // Only count actual character slots, not rollcloudPlayer entries
      const hasCharacters = Object.keys(profiles).some(key =>
        profiles[key].type !== 'rollcloudPlayer'
      );

      if (!hasCharacters) {
        // No character data - ask if user wants to go to GM mode
        const userConfirmed = confirm('No character data found.\n\nWould you like to open GM mode instead?');

        if (!userConfirmed) {
          showSheetBtn.disabled = false;
          showSheetBtn.textContent = '📋 Show Character Sheet';
          return;
        }
      }

      // Send message to Roll20 content script to show sheet
      const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'showCharacterSheet' });

      if (response && response.success) {
        showSuccess('Character sheet opened!');
      } else if (!hasCharacters) {
        // If no characters, the GM mode was opened
        showSuccess('GM mode opened!');
      } else {
        debug.error('Failed to open character sheet:', response);
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
