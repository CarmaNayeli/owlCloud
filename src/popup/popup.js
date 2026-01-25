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
    // Try to use debug if available, otherwise use console
    const logger = typeof debug !== 'undefined' ? debug : console;
    logger.error('❌ Popup initialization error:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-family: Arial;">
        <h2>Initialization Error</h2>
        <p>${error.message}</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error.stack}</pre>
      </div>
    `;
  }

function initializePopup() {
  // Check if this is an experimental build
  checkExperimentalBuild();
  
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

  // DOM Elements - Experimental Features
  const autoBackwardsSyncToggle = document.getElementById('autoBackwardsSyncToggle');

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
  
  // Debug: Check if Supabase is available
  debug.log('🔍 Supabase availability check:', typeof SupabaseTokenManager !== 'undefined' ? 'Available' : 'Not available');
  if (typeof SupabaseTokenManager !== 'undefined') {
    const testManager = new SupabaseTokenManager();
    debug.log('🔍 Generated user ID:', testManager.generateUserId());
  }
  
  // Listen for data sync notifications from content scripts
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'dataSynced') {
      debug.log('📥 Received data sync notification:', message);
      // Refresh character data to show the newly synced character
      loadCharacterData();
      showSuccess(`${message.characterName} synced successfully!`);
    }
  });
  
  // Fallback: Periodically check for new character data every 5 seconds
  // This helps when background script communication is failing
  let lastCharacterCount = 0;
  setInterval(async () => {
    try {
      const result = await browserAPI.storage.local.get(['characterProfiles']);
      const profiles = result.characterProfiles || {};
      const currentCount = Object.keys(profiles).filter(id => profiles[id].type !== 'rollcloudPlayer').length;
      
      if (currentCount > lastCharacterCount) {
        debug.log('🔄 Detected new character data via polling');
        loadCharacterData();
        showSuccess('New character data detected!');
      }
      lastCharacterCount = currentCount;
    } catch (error) {
      // Silently ignore polling errors
    }
  }, 5000);

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

  // Experimental features event listeners
  if (autoBackwardsSyncToggle) {
    // Load initial state
    loadAutoBackwardsSyncState();
    // Add change listener
    autoBackwardsSyncToggle.addEventListener('change', handleAutoBackwardsSyncToggle);
  }

  // Discord integration event listeners
  const setupDiscordBtn = document.getElementById('setupDiscordBtn');
  const cancelPairingBtn = document.getElementById('cancelPairingBtn');
  const disconnectDiscordBtn = document.getElementById('disconnectDiscordBtn');
  const testDiscordWebhookBtn = document.getElementById('testDiscordWebhook');
  const saveDiscordWebhookBtn = document.getElementById('saveDiscordWebhook');

  if (setupDiscordBtn) {
    // Load initial Discord state
    loadDiscordConnectionState();
    // Add event listeners
    setupDiscordBtn.addEventListener('click', handleSetupDiscord);
    if (cancelPairingBtn) cancelPairingBtn.addEventListener('click', handleCancelPairing);
    if (disconnectDiscordBtn) disconnectDiscordBtn.addEventListener('click', handleDisconnectDiscord);
    if (testDiscordWebhookBtn) testDiscordWebhookBtn.addEventListener('click', handleTestDiscordWebhook);
    if (saveDiscordWebhookBtn) saveDiscordWebhookBtn.addEventListener('click', handleSaveDiscordWebhook);
  }

  /**
   * Checks if the user is logged in and shows appropriate section
   */
  async function checkLoginStatus() {
    try {
      debug.log('🔍 Checking login status...');
      const response = await browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' });
      debug.log('📥 Login status response:', response);

      if (response.success && response.loggedIn) {
        showMainSection(response.username);
      } else {
        debug.log('🔄 Background script says not logged in, checking storage directly...');
        // Try alternative method - check storage directly
        try {
          const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires']);
          debug.log('📦 Direct storage check result:', result);
          if (result.diceCloudToken) {
            debug.log('✅ Found token in storage, showing main section');
            showMainSection(result.username || 'DiceCloud User');
          } else {
            debug.log('❌ No token found in storage, checking Supabase...');
            // Try Supabase for cross-session persistence
            try {
              if (typeof SupabaseTokenManager !== 'undefined') {
                debug.log('🌐 Attempting to retrieve token from Supabase...');
                const supabaseManager = new SupabaseTokenManager();
                const userId = supabaseManager.generateUserId();
                debug.log('🔍 Using user ID for Supabase lookup:', userId);
                
                const supabaseResult = await supabaseManager.retrieveToken();
                debug.log('📥 Supabase retrieval result:', supabaseResult);
                
                if (supabaseResult.success) {
                  debug.log('✅ Found token in Supabase, restoring to local storage...');
                  // Store token locally for faster access
                  await browserAPI.storage.local.set({
                    diceCloudToken: supabaseResult.token,
                    username: supabaseResult.username,
                    tokenExpires: supabaseResult.tokenExpires
                  });
                  showMainSection(supabaseResult.username || 'DiceCloud User');
                } else {
                  debug.log('❌ No token found in Supabase, showing login. Error:', supabaseResult.error);
                  showLoginSection();
                }
              } else {
                debug.log('❌ Supabase not available, showing login');
                showLoginSection();
              }
            } catch (supabaseError) {
              debug.error('❌ Supabase check failed:', supabaseError);
              showLoginSection();
            }
          }
        } catch (storageError) {
          debug.error('❌ Storage check failed:', storageError);
          showLoginSection();
        }
      }
    } catch (error) {
      debug.error('❌ Error checking login status:', error);
      // Try alternative method - check storage directly
      try {
        const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires']);
        debug.log('📦 Direct storage check result (error fallback):', result);
        if (result.diceCloudToken) {
          debug.log('✅ Found token in storage, showing main section');
          showMainSection(result.username || 'DiceCloud User');
        } else {
          debug.log('❌ No token found in storage, checking Supabase...');
          // Try Supabase for cross-session persistence
          try {
            if (typeof SupabaseTokenManager !== 'undefined') {
              const supabaseManager = new SupabaseTokenManager();
              const supabaseResult = await supabaseManager.retrieveToken();
              
              if (supabaseResult.success) {
                debug.log('✅ Found token in Supabase (error fallback), restoring to local storage...');
                // Store token locally for faster access
                await browserAPI.storage.local.set({
                  diceCloudToken: supabaseResult.token,
                  username: supabaseResult.username,
                  tokenExpires: supabaseResult.tokenExpires
                });
                showMainSection(supabaseResult.username || 'DiceCloud User');
              } else {
                debug.log('❌ No token found in Supabase, showing login');
                showLoginSection();
              }
            } else {
              debug.log('❌ Supabase not available, showing login');
              showLoginSection();
            }
          } catch (supabaseError) {
            debug.error('❌ Supabase check failed:', supabaseError);
            showLoginSection();
          }
        }
      } catch (storageError) {
        debug.error('❌ Storage check failed:', storageError);
        showLoginSection();
      }
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
   * Handles auto-connect - checks for DiceCloud tab or opens one
   */
  async function handleAutoConnect() {
    try {
      autoConnectBtn.disabled = true;
      autoConnectBtn.textContent = '⏳ Checking...';
      hideLoginError();

      // First, check if the current active tab is DiceCloud
      const [activeTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      let dicecloudTab = null;

      if (activeTab && activeTab.url && activeTab.url.includes('dicecloud.com')) {
        // User is currently on DiceCloud - use this tab
        dicecloudTab = activeTab;
        debug.log('Using current active DiceCloud tab');
      } else {
        // Check if any other tab has DiceCloud open
        const tabs = await browserAPI.tabs.query({ url: 'https://dicecloud.com/*' });
        if (tabs.length > 0) {
          dicecloudTab = tabs[0];
          debug.log('Found DiceCloud tab:', dicecloudTab.id);
        }
      }

      if (dicecloudTab) {
        // DiceCloud is open - try to capture token
        autoConnectBtn.textContent = '⏳ Capturing token...';

        try {
          // Send message to DiceCloud tab to extract token
          const response = await browserAPI.tabs.sendMessage(dicecloudTab.id, {
            action: 'extractAuthToken'
          });

          debug.log('📥 Token capture response:', response);

          if (response && response.success && response.token) {
            // Store the token with metadata - use direct storage as primary method
            try {
              debug.log('💾 Storing token directly in storage...');
              const storageData = {
                diceCloudToken: response.token,
                diceCloudUserId: response.userId,
                tokenExpires: response.tokenExpires,
                username: response.username
              };

              await browserAPI.storage.local.set(storageData);
              debug.log('✅ Token stored successfully in direct storage:', storageData);

              // Also store in Supabase for cross-session persistence
              try {
                if (typeof SupabaseTokenManager !== 'undefined') {
                  const supabaseManager = new SupabaseTokenManager();
                  const supabaseResult = await supabaseManager.storeToken({
                    token: response.token,
                    userId: response.userId,
                    tokenExpires: response.tokenExpires,
                    username: response.username
                  });

                  if (supabaseResult.success) {
                    debug.log('✅ Token also stored in Supabase for cross-session persistence');
                  } else {
                    debug.log('⚠️ Supabase storage failed (non-critical):', supabaseResult.error);
                  }
                }
              } catch (supabaseError) {
                debug.log('⚠️ Supabase not available (non-critical):', supabaseError);
              }

              // Also try background script as backup
              try {
                await browserAPI.runtime.sendMessage({
                  action: 'setApiToken',
                  token: response.token,
                  userId: response.userId,
                  tokenExpires: response.tokenExpires,
                  username: response.username
                });
                debug.log('✅ Also stored via background script');
              } catch (bgError) {
                debug.log('⚠️ Background storage failed (non-critical):', bgError);
              }

              hideLoginError();
              showMainSection(response.username || 'DiceCloud User');
              loadCharacterData();
            } catch (storageError) {
              debug.error('❌ Direct storage failed:', storageError);
              showLoginError('Failed to save login. Please try again.');
              return;
            }
          } else {
            // Not logged in - show error and keep DiceCloud tab open
            showLoginError('Please log in to DiceCloud, then click the button again.');
            // Focus the DiceCloud tab
            await browserAPI.tabs.update(dicecloudTab.id, { active: true });
          }
        } catch (error) {
          debug.error('Error capturing token:', error);
          showLoginError('Error: ' + error.message);
        }
      } else {
        // No DiceCloud tab - open one
        autoConnectBtn.textContent = '⏳ Opening DiceCloud...';

        await browserAPI.tabs.create({
          url: 'https://dicecloud.com',
          active: true
        });

        showLoginError('DiceCloud opened in new tab. Log in, then click this button again.');
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
      // Delete from Supabase
      try {
        if (typeof SupabaseTokenManager !== 'undefined') {
          const supabaseManager = new SupabaseTokenManager();
          const supabaseResult = await supabaseManager.deleteToken();
          
          if (supabaseResult.success) {
            debug.log('✅ Token deleted from Supabase');
          } else {
            debug.log('⚠️ Supabase deletion failed (non-critical):', supabaseResult.error);
          }
        }
      } catch (supabaseError) {
        debug.log('⚠️ Supabase not available for logout (non-critical):', supabaseError);
      }

      // Logout from background script
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

  /**
   * Loads the auto backwards sync state from storage
   */
  async function loadAutoBackwardsSyncState() {
    try {
      const result = await browserAPI.storage.local.get(['autoBackwardsSync']);
      const isEnabled = result.autoBackwardsSync !== false; // Default to true

      if (autoBackwardsSyncToggle) {
        autoBackwardsSyncToggle.checked = isEnabled;
      }

      debug.log('Auto backwards sync state loaded:', isEnabled);
    } catch (error) {
      debug.error('Error loading auto backwards sync state:', error);
    }
  }

  /**
   * Handles auto backwards sync toggle change
   */
  async function handleAutoBackwardsSyncToggle() {
    try {
      const isEnabled = autoBackwardsSyncToggle.checked;

      // Save to storage
      await browserAPI.storage.local.set({ autoBackwardsSync: isEnabled });

      // Notify Roll20 content script to enable/disable sync
      const tabs = await browserAPI.tabs.query({ url: '*://app.roll20.net/*' });
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.sendMessage(tab.id, {
            action: 'setAutoBackwardsSync',
            enabled: isEnabled
          });
          debug.log('Sent auto backwards sync state to Roll20 tab:', tab.id, isEnabled);
        } catch (error) {
          debug.log('Could not send message to tab:', tab.id, error.message);
        }
      }

      debug.log('Auto backwards sync toggled:', isEnabled);

      // Show feedback
      const previousText = statusText.textContent;
      const previousIcon = statusIcon.textContent;
      statusIcon.textContent = '✅';
      statusText.textContent = `Auto backwards sync ${isEnabled ? 'enabled' : 'disabled'}`;
      setTimeout(() => {
        statusIcon.textContent = previousIcon;
        statusText.textContent = previousText;
      }, 2000);
    } catch (error) {
      debug.error('Error toggling auto backwards sync:', error);
      showError('Failed to toggle auto backwards sync');
    }
  }

  // ============================================================================
  // Discord Integration (Pip Bot Pairing)
  // ============================================================================

  const SUPABASE_URL = 'https://your-project.supabase.co'; // TODO: Replace with actual URL
  const SUPABASE_ANON_KEY = 'your-anon-key'; // TODO: Replace with actual key
  const PIP_BOT_INVITE_URL = 'https://discord.com/api/oauth2/authorize?client_id=1464771468452827380&permissions=536870912&scope=bot%20applications.commands';

  let pairingPollInterval = null;
  let pairingExpiresAt = null;

  /**
   * Load Discord connection state on popup open
   */
  async function loadDiscordConnectionState() {
    try {
      const response = await browserAPI.runtime.sendMessage({ action: 'getDiscordWebhook' });
      if (response.success && response.webhookUrl) {
        // Already connected
        showDiscordConnected(response.serverName || 'Discord Server');
      } else {
        // Not connected
        showDiscordNotConnected();
      }
    } catch (error) {
      debug.error('Error loading Discord state:', error);
      showDiscordNotConnected();
    }
  }

  /**
   * Show the "not connected" state
   */
  function showDiscordNotConnected() {
    document.getElementById('discordNotConnected').style.display = 'block';
    document.getElementById('discordPairing').style.display = 'none';
    document.getElementById('discordConnected').style.display = 'none';
  }

  /**
   * Show the "pairing in progress" state
   */
  function showDiscordPairing(code) {
    document.getElementById('discordNotConnected').style.display = 'none';
    document.getElementById('discordPairing').style.display = 'block';
    document.getElementById('discordConnected').style.display = 'none';
    document.getElementById('pairingCode').textContent = code;
  }

  /**
   * Show the "connected" state
   */
  function showDiscordConnected(serverName) {
    document.getElementById('discordNotConnected').style.display = 'none';
    document.getElementById('discordPairing').style.display = 'none';
    document.getElementById('discordConnected').style.display = 'block';
    document.getElementById('discordServerName').textContent = serverName || 'Discord Server';
  }

  /**
   * Generate a random 6-character pairing code
   */
  function generatePairingCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Handle "Setup Discord" button click
   */
  async function handleSetupDiscord() {
    try {
      const setupBtn = document.getElementById('setupDiscordBtn');
      setupBtn.disabled = true;
      setupBtn.textContent = '⏳ Setting up...';

      // Generate pairing code
      const code = generatePairingCode();

      // Get DiceCloud user info
      const loginStatus = await browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' });
      const diceCloudUsername = loginStatus.username || 'Unknown';

      // Store in Supabase
      const storeResult = await browserAPI.runtime.sendMessage({
        action: 'createDiscordPairing',
        code: code,
        username: diceCloudUsername
      });

      if (!storeResult.success) {
        throw new Error(storeResult.error || 'Failed to create pairing');
      }

      // Show pairing state
      showDiscordPairing(code);

      // Open Pip Bot invite in new tab
      await browserAPI.tabs.create({ url: PIP_BOT_INVITE_URL, active: true });

      // Start polling for connection
      pairingExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
      startPairingPoll(code);

    } catch (error) {
      debug.error('Discord setup error:', error);
      showDiscordStatus(`Setup failed: ${error.message}`, 'error');
      showDiscordNotConnected();
    } finally {
      const setupBtn = document.getElementById('setupDiscordBtn');
      if (setupBtn) {
        setupBtn.disabled = false;
        setupBtn.textContent = '🎮 Setup Discord';
      }
    }
  }

  /**
   * Start polling Supabase for pairing completion
   */
  function startPairingPoll(code) {
    // Update countdown display
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((pairingExpiresAt - Date.now()) / 1000));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const countdownEl = document.getElementById('pairingCountdown');
      if (countdownEl) {
        countdownEl.textContent = `(${mins}:${secs.toString().padStart(2, '0')})`;
      }
      if (remaining <= 0) {
        handleCancelPairing();
        showDiscordStatus('Pairing expired. Please try again.', 'error');
      }
    };

    // Poll every 3 seconds
    pairingPollInterval = setInterval(async () => {
      updateCountdown();

      try {
        const result = await browserAPI.runtime.sendMessage({
          action: 'checkDiscordPairing',
          code: code
        });

        if (result.success && result.connected && result.webhookUrl) {
          // Connected! Save webhook and update UI
          clearInterval(pairingPollInterval);
          pairingPollInterval = null;

          await browserAPI.runtime.sendMessage({
            action: 'setDiscordWebhook',
            webhookUrl: result.webhookUrl,
            enabled: true,
            serverName: result.serverName
          });

          showDiscordConnected(result.serverName);
          showDiscordStatus('Connected to Discord!', 'success');
        }
      } catch (error) {
        debug.error('Pairing poll error:', error);
      }
    }, 3000);

    // Initial countdown update
    updateCountdown();
  }

  /**
   * Handle cancel pairing button
   */
  function handleCancelPairing() {
    if (pairingPollInterval) {
      clearInterval(pairingPollInterval);
      pairingPollInterval = null;
    }
    showDiscordNotConnected();
  }

  /**
   * Handle disconnect Discord button
   */
  async function handleDisconnectDiscord() {
    try {
      await browserAPI.runtime.sendMessage({
        action: 'setDiscordWebhook',
        webhookUrl: '',
        enabled: false
      });
      showDiscordNotConnected();
      showDiscordStatus('Disconnected from Discord', 'success');
    } catch (error) {
      debug.error('Disconnect error:', error);
      showDiscordStatus(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Handles testing the Discord webhook
   */
  async function handleTestDiscordWebhook() {
    const testBtn = document.getElementById('testDiscordWebhook');

    try {
      testBtn.disabled = true;
      testBtn.textContent = '⏳ Testing...';

      const response = await browserAPI.runtime.sendMessage({
        action: 'testDiscordWebhook'
      });

      if (response.success) {
        showDiscordStatus('Test sent! Check Discord.', 'success');
      } else {
        showDiscordStatus(`Test failed: ${response.error}`, 'error');
      }
    } catch (error) {
      debug.error('Discord test error:', error);
      showDiscordStatus(`Error: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '🧪 Test';
    }
  }

  /**
   * Handles saving manual webhook URL
   */
  async function handleSaveDiscordWebhook() {
    const webhookUrl = document.getElementById('discordWebhookUrl').value.trim();
    const saveBtn = document.getElementById('saveDiscordWebhook');

    if (!webhookUrl) {
      showDiscordStatus('Please enter a webhook URL', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';

      await browserAPI.runtime.sendMessage({
        action: 'setDiscordWebhook',
        webhookUrl: webhookUrl,
        enabled: true
      });

      showDiscordConnected('Manual Webhook');
      showDiscordStatus('Webhook saved!', 'success');
    } catch (error) {
      debug.error('Save webhook error:', error);
      showDiscordStatus(`Error: ${error.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Webhook URL';
    }
  }

  /**
   * Shows Discord status message
   */
  function showDiscordStatus(message, type) {
    const statusDiv = document.getElementById('discordStatus');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.textContent = message;
      statusDiv.style.color = type === 'success' ? '#27ae60' : '#e74c3c';

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Checks if this is an experimental build and updates UI accordingly
   */
  function checkExperimentalBuild() {
    // Check for experimental build indicators
    const experimentalIndicators = [
      () => {
        try {
          const manifest = browserAPI.runtime.getManifest();
          return manifest && manifest.name && manifest.name.includes('Experimental');
        } catch (e) {
          debug.log('🔍 Could not check manifest name:', e);
          return false;
        }
      },
      () => {
        try {
          const manifest = browserAPI.runtime.getManifest();
          return manifest && manifest.version && manifest.version.endsWith('.1');
        } catch (e) {
          debug.log('🔍 Could not check manifest version:', e);
          return false;
        }
      },
      async () => {
        try {
          const url = browserAPI.runtime.getURL('src/lib/meteor-ddp-client.js');
          const response = await fetch(url);
          return response.ok;
        } catch (e) {
          debug.log('🔍 Experimental files not found:', e);
          return false;
        }
      }
    ];

    // Check if any indicator returns true (using Promise.all for compatibility)
    Promise.all(experimentalIndicators.map(check => 
      Promise.resolve(check()).catch(() => false)
    )).then(results => {
      const isExperimental = results.some(result => result === true);
      
      if (isExperimental) {
        const experimentalNotice = document.getElementById('experimentalNotice');
        const versionDisplay = document.getElementById('versionDisplay');
        const experimentalInstructions = document.getElementById('experimentalInstructions');
        
        if (experimentalNotice) {
          experimentalNotice.classList.remove('hidden');
        }
        
        if (versionDisplay) {
          versionDisplay.textContent = 'v1.1.2.1 - Experimental Sync';
        }
        
        if (experimentalInstructions) {
          experimentalInstructions.classList.remove('hidden');
        }
        
        debug.log('🧪 Experimental build detected');
      } else {
        debug.log('📦 Standard build detected');
      }
    }).catch(error => {
      debug.log('🔍 Error checking experimental build:', error);
      debug.log('📦 Assuming standard build');
    });
  }
} // End initializePopup
}); // End DOMContentLoaded
