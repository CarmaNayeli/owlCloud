/**
 * Popup UI Script
 * Handles user interactions in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup DOMContentLoaded fired');
  
  // Check if browserAPI is available
  if (typeof browserAPI === 'undefined' && typeof window.browserAPI === 'undefined') {
    console.error('❌ FATAL: browserAPI is not defined!');
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

  console.log('✅ browserAPI is available');
  debug.log('✅ browserAPI is available');

  try {
    console.log('🚀 About to call initializePopup()');
    initializePopup();
    console.log('✅ initializePopup() completed');
  } catch (error) {
    // Try to use debug if available, otherwise use console
    const logger = typeof debug !== 'undefined' ? debug : console;
    console.error('❌ Popup initialization error:', error);
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
  // Set version from manifest
  try {
    const manifest = browserAPI.runtime.getManifest();
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay && manifest.version) {
      versionDisplay.textContent = `v${manifest.version}`;
    }
  } catch (e) {
    console.log('Could not read manifest version:', e);
  }

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
  const logoutBtn = document.getElementById('logoutBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const cloudSyncBtn = document.getElementById('cloudSyncBtn');
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
  const syncCharacterToCloudBtn = document.getElementById('syncCharacterToCloudBtn');
  const howToBtn = document.getElementById('howToBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');

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

  if (howToBtn) {
    howToBtn.addEventListener('click', handleHowTo);
  }

  if (syncCharacterToCloudBtn) {
    syncCharacterToCloudBtn.addEventListener('click', handleSyncCharacterToCloud);
  }

  clearBtn.addEventListener('click', handleClear);

  // Settings dropdown event listeners
  if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener('click', toggleSettingsMenu);
    
    // Close settings menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!settingsBtn.contains(event.target) && !settingsMenu.contains(event.target)) {
        settingsMenu.classList.add('hidden');
      }
    });
  }

  // Export/Import event listeners
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);
  }
  if (cloudSyncBtn) {
    cloudSyncBtn.addEventListener('click', handleCloudSync);
  }

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
  const checkDiscordIntegrationBtn = document.getElementById('checkDiscordIntegration');
  const checkDiscordIntegrationNotConnectedBtn = document.getElementById('checkDiscordIntegrationNotConnected');
  const saveDiscordWebhookBtn = document.getElementById('saveDiscordWebhook');

  if (setupDiscordBtn) {
    // Load initial Discord state
    loadDiscordConnectionState();
    // Add event listeners
    setupDiscordBtn.addEventListener('click', handleSetupDiscord);
    if (cancelPairingBtn) cancelPairingBtn.addEventListener('click', handleCancelPairing);
    if (disconnectDiscordBtn) disconnectDiscordBtn.addEventListener('click', handleDisconnectDiscord);
    if (testDiscordWebhookBtn) testDiscordWebhookBtn.addEventListener('click', handleTestDiscordWebhook);
    if (checkDiscordIntegrationBtn) checkDiscordIntegrationBtn.addEventListener('click', handleCheckDiscordIntegration);
    if (checkDiscordIntegrationNotConnectedBtn) checkDiscordIntegrationNotConnectedBtn.addEventListener('click', handleCheckDiscordIntegration);
    if (saveDiscordWebhookBtn) saveDiscordWebhookBtn.addEventListener('click', handleSaveDiscordWebhook);
  }

  /**
   * Checks if the user is logged in and shows appropriate section
   */
  async function checkLoginStatus() {
    try {
      debug.log('🔍 Checking login status...');
      // Timeout after 3s in case the service worker is unresponsive (e.g., fresh install)
      const response = await Promise.race([
        browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker timeout')), 3000))
      ]);
      debug.log('📥 Login status response:', response);

      if (response.success && response.loggedIn) {
        showMainSection();
      } else {
        debug.log('🔄 Background script says not logged in, checking storage directly...');
        // Try alternative method - check storage directly
        try {
          const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires']);
          debug.log('📦 Direct storage check result:', result);
          if (result.diceCloudToken) {
            debug.log('✅ Found token in storage, showing main section');
            showMainSection();
          } else {
            debug.log('❌ No token found in storage, checking Supabase...');
            // Check if user explicitly logged out - don't restore from Supabase in that case
            const { explicitlyLoggedOut } = await browserAPI.storage.local.get('explicitlyLoggedOut');
            if (explicitlyLoggedOut) {
              debug.log('⏭️ Skipping Supabase restoration: user explicitly logged out');
              showLoginSection();
              return;
            }
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
                    tokenExpires: supabaseResult.tokenExpires,
                    diceCloudUserId: supabaseResult.userId,
                    authId: supabaseResult.authId || supabaseResult.userId
                  });
                  // Clear explicitly logged out flag since user is restoring session
                  await browserAPI.storage.local.remove('explicitlyLoggedOut');
                  // Restore character data from local storage
                  const localProfiles = await browserAPI.storage.local.get(['profiles']);
                  if (localProfiles.profiles) {
                    await browserAPI.storage.local.set({
                      profiles: localProfiles.profiles
                    });
                  }
                  debug.log('✅ Token and data restored from Supabase to local storage');
                  showMainSection();
                } else {
                  debug.log('ℹ️ No token found in Supabase');
                  showLoginSection();
                }
              } else {
                debug.log('❌ Supabase not available, showing login');
                showLoginSection();
              }
            } catch (error) {
              debug.error('❌ Error retrieving from Supabase:', error);
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
          showMainSection();
        } else {
          debug.log('❌ No token found in storage, checking Supabase...');
          // Check if user explicitly logged out - don't restore from Supabase in that case
          const { explicitlyLoggedOut } = await browserAPI.storage.local.get('explicitlyLoggedOut');
          if (explicitlyLoggedOut) {
            debug.log('⏭️ Skipping Supabase restoration (error fallback): user explicitly logged out');
            showLoginSection();
            return;
          }
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
                // Clear explicitly logged out flag since user is restoring session
                await browserAPI.storage.local.remove('explicitlyLoggedOut');
                showMainSection();
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
  function showMainSection() {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    loadCharacterData();
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
          // Send message to DiceCloud tab to extract token using runtime.sendMessage
          console.log('📡 About to send message to tab:', dicecloudTab.id);
          debug.log('📡 About to send message to tab:', dicecloudTab.id);
          
          const response = await new Promise((resolve) => {
            browserAPI.runtime.sendMessage({
              action: 'extractAuthToken',
              tabId: dicecloudTab.id
            }, (response) => {
              console.log('📡 Received callback response:', response);
              debug.log('📡 Received callback response:', response);
              // Extract the actual data from the background script response
              const actualResponse = response.success ? response.data : response;
              console.log('📡 Actual response object:', actualResponse);
              debug.log('📡 Actual response object:', actualResponse);
              resolve(actualResponse);
            });
          });
          
          console.log('📡 Received Promise response:', response);
          debug.log('📡 Received Promise response:', response);

          debug.log('📥 Token capture response:', response);
          console.log('📥 Token capture response (console):', response);

          if (response && response.success && response.token) {
            // Store the token with metadata - use direct storage as primary method
            try {
              debug.log('💾 Storing token directly in storage...');
              const storageData = {
                diceCloudToken: response.token,
                diceCloudUserId: response.userId,
                tokenExpires: response.tokenExpires,
                username: response.username,
                authId: response.authId
              };

              await browserAPI.storage.local.set(storageData);
              // Clear explicitly logged out flag since user is logging in
              await browserAPI.storage.local.remove('explicitlyLoggedOut');
              debug.log('✅ Token stored successfully in direct storage:', storageData);

              // Also store in Supabase for cross-session persistence
              try {
                if (typeof SupabaseTokenManager !== 'undefined') {
                  const supabaseManager = new SupabaseTokenManager();
                  const supabaseResult = await supabaseManager.storeToken({
                    token: response.token,
                    userId: response.userId,
                    tokenExpires: response.tokenExpires,
                    username: response.username, // Display username
                    authId: response.authId // Auth ID for database
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

              hideLoginError();
              showMainSection();
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
        showMainSection();
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

      // Get the active character ID (profile key) and data
      const storageResult = await browserAPI.storage.local.get(['activeCharacterId']);
      const activeCharacterId = storageResult.activeCharacterId;
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
          if (id === activeCharacterId || (activeCharacter && (char.characterId === activeCharacter.characterId || char._id === activeCharacter._id || id === (activeCharacter.characterId || activeCharacter._id)))) {
            option.selected = true;
          }
          characterSelect.appendChild(option);
        });

        // Always show character selector when characters exist
        characterSelector.classList.remove('hidden');
        
        // Show sync character button if there's an active character
        if (activeCharacter) {
          syncCharacterToCloudBtn.classList.remove('hidden');
        } else {
          syncCharacterToCloudBtn.classList.add('hidden');
        }
      } else {
        characterSelect.innerHTML = '<option value="">No characters synced</option>';
        characterSelector.classList.add('hidden');
        syncCharacterToCloudBtn.classList.add('hidden');
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
      if (!selectedId) {
        // Hide sync character button when no character is selected
        syncCharacterToCloudBtn.classList.add('hidden');
        return;
      }

      // Show sync character button when a character is selected
      syncCharacterToCloudBtn.classList.remove('hidden');

      // If this is a database character (db- prefix), copy it to local storage first
      if (selectedId.startsWith('db-')) {
        const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
        const profiles = profilesResponse.success ? profilesResponse.profiles : {};
        const dbChar = profiles[selectedId];
        if (dbChar) {
          await browserAPI.runtime.sendMessage({
            action: 'storeCharacterData',
            data: dbChar,
            slotId: selectedId
          });
        }
      }

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
   * Handles refresh characters button click - pulls data from local storage and database
   */
  async function handleSync() {
    try {
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Refreshing...';
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Refreshing characters...';

      // First, refresh from local storage
      await refreshFromLocalStorage();
      
      // Then, refresh from database/cloud
      await refreshFromDatabase();
      
      // Finally, reload character data to update UI
      await loadCharacterData();
      
      showSuccess('Characters refreshed successfully!');
    } catch (error) {
      debug.error('Error refreshing characters:', error);
      showError('Error: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Refresh Characters';
    }
  }

  /**
   * Refreshes character data from local storage
   */
  async function refreshFromLocalStorage() {
    try {
      // Get all character profiles from local storage
      const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const profiles = profilesResponse.success ? profilesResponse.profiles : {};
      
      const characterCount = Object.keys(profiles).filter(id => 
        profiles[id].type !== 'rollcloudPlayer'
      ).length;
      
      console.log(`Found ${characterCount} characters in local storage`);
      return profiles;
    } catch (error) {
      console.error('Error refreshing from local storage:', error);
      throw error;
    }
  }

  /**
   * Refreshes character data from database/cloud
   */
  async function refreshFromDatabase() {
    try {
      // Check if Supabase is available
      if (typeof SupabaseTokenManager === 'undefined') {
        console.log('Cloud sync not available, skipping database refresh');
        return;
      }

      const supabaseManager = new SupabaseTokenManager();
      
      // Get current token from storage
      const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires', 'diceCloudUserId', 'authId']);
      
      if (!result.diceCloudToken) {
        console.log('No token found, skipping database refresh');
        return;
      }

      // Refresh token in cloud
      const supabaseResult = await supabaseManager.storeToken({
        token: result.diceCloudToken,
        userId: result.diceCloudUserId,
        tokenExpires: result.tokenExpires,
        username: result.username || 'DiceCloud User',
        authId: result.authId || result.diceCloudUserId
      });

      if (supabaseResult.success) {
        console.log('Account data refreshed to cloud');
        
        // Try to pull character data from cloud
        const characterData = await supabaseManager.getCharacterData(result.diceCloudUserId);
        if (characterData.success && characterData.characters) {
          console.log(`Pulled ${Object.keys(characterData.characters).length} characters from cloud`);
          
          // Merge cloud data with local storage
          await mergeCloudDataToLocal(characterData.characters);
        }
      } else {
        console.error('Failed to refresh account to cloud:', supabaseResult.error);
      }
    } catch (error) {
      console.error('Error refreshing from database:', error);
      // Don't throw error here, allow local storage refresh to succeed
    }
  }

  /**
   * Merges cloud character data with local storage
   */
  async function mergeCloudDataToLocal(cloudCharacters) {
    try {
      // Get current local profiles
      const localResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const localProfiles = localResponse.success ? localResponse.profiles : {};
      
      // Merge cloud data with local data (local takes precedence)
      for (const [characterId, cloudData] of Object.entries(cloudCharacters)) {
        if (!localProfiles[characterId]) {
          // Only add cloud data if it doesn't exist locally
          await browserAPI.runtime.sendMessage({
            action: 'storeCharacterData',
            data: cloudData.characterData,
            slotId: characterId
          });
          console.log(`Added cloud character ${characterId} to local storage`);
        }
      }
    } catch (error) {
      console.error('Error merging cloud data:', error);
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
   * Toggle settings menu dropdown
   */
  function toggleSettingsMenu(event) {
    event.stopPropagation();
    settingsMenu.classList.toggle('hidden');
  }

  /**
   * Handles "How to Use" button click - opens welcome screen
   */
  function handleHowTo() {
    // Open the welcome screen (options page)
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      // Fallback: try to open the welcome screen directly
      const welcomeUrl = browserAPI.runtime.getURL('src/options/welcome.html');
      browserAPI.tabs.create({ url: welcomeUrl });
    }
  }

  /**
   * Handles sync character to cloud button click
   */
  async function handleSyncCharacterToCloud() {
    try {
      syncCharacterToCloudBtn.disabled = true;
      syncCharacterToCloudBtn.textContent = '⏳ Syncing...';

      // Get currently selected character ID
      const selectedId = characterSelect.value;

      if (!selectedId) {
        showError('No character selected');
        return;
      }

      // Get character data
      const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const profiles = profilesResponse.success ? profilesResponse.profiles : {};
      const characterData = profiles[selectedId];

      if (!characterData) {
        showError('Character data not found');
        return;
      }

      // Get DiceCloud user ID from login status
      const loginStatus = await browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' });
      const dicecloudUserId = loginStatus.userId; // This is the DiceCloud Meteor ID

      debug.log('🎭 Syncing character to cloud:', {
        characterId: selectedId,
        characterName: characterData.name,
        dicecloudUserId: dicecloudUserId
      });

      // Use background script's syncCharacterToCloud which has all the linking logic
      const result = await browserAPI.runtime.sendMessage({
        action: 'syncCharacterToCloud',
        characterData: {
          ...characterData,
          id: selectedId,
          dicecloudUserId: dicecloudUserId, // Include DiceCloud user ID
          userId: dicecloudUserId // Also as userId for backwards compatibility
        }
      });

      if (result.success) {
        showSuccess('Character synced to cloud!');
      } else {
        showError('Cloud sync failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      debug.error('Error syncing character to cloud:', error);
      showError('Cloud sync error: ' + error.message);
    } finally {
      syncCharacterToCloudBtn.disabled = false;
      syncCharacterToCloudBtn.textContent = '☁️ Sync Character to Cloud';
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
   * Handles export button click - exports all characters to JSON file
   */
  async function handleExport() {
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = '⏳ Exporting...';

      // Get all character profiles
      const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
      const profiles = profilesResponse.success ? profilesResponse.profiles : {};

      // Filter out non-character entries (like rollcloudPlayer)
      const characterProfiles = {};
      for (const [key, value] of Object.entries(profiles)) {
        if (!key.startsWith('rollcloudPlayer')) {
          characterProfiles[key] = value;
        }
      }

      if (Object.keys(characterProfiles).length === 0) {
        showError('No characters to export');
        return;
      }

      // Create export data
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        characters: characterProfiles
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rollcloud-characters-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess(`Exported ${Object.keys(characterProfiles).length} character(s)`);
    } catch (error) {
      debug.error('Error exporting characters:', error);
      showError('Error exporting: ' + error.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '📤 Export Characters';
    }
  }

  /**
   * Handles import file selection - imports characters from JSON file
   */
  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      importBtn.disabled = true;
      importBtn.textContent = '⏳ Importing...';

      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import data
      if (!importData.characters || typeof importData.characters !== 'object') {
        showError('Invalid import file format');
        return;
      }

      // Import each character
      let importedCount = 0;
      for (const [characterId, characterData] of Object.entries(importData.characters)) {
        await browserAPI.runtime.sendMessage({
          action: 'storeCharacterData',
          data: characterData,
          slotId: characterId
        });
        importedCount++;
      }

      // Reload character data
      await loadCharacterData();
      showSuccess(`Imported ${importedCount} character(s)`);
    } catch (error) {
      debug.error('Error importing characters:', error);
      if (error instanceof SyntaxError) {
        showError('Invalid JSON file');
      } else {
        showError('Error importing: ' + error.message);
      }
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = '📥 Import Characters';
      // Reset file input so the same file can be selected again
      event.target.value = '';
    }
  }

  /**
   * Handles cloud sync button click - manually syncs token to Supabase
   */
  async function handleCloudSync() {
    try {
      cloudSyncBtn.disabled = true;
      cloudSyncBtn.textContent = '⏳ Syncing...';

      // Get current token from storage
      const result = await browserAPI.storage.local.get(['diceCloudToken', 'username', 'tokenExpires', 'diceCloudUserId', 'authId']);

      if (!result.diceCloudToken) {
        showError('No token to sync. Please log in first.');
        return;
      }

      // Check if Supabase is available
      if (typeof SupabaseTokenManager === 'undefined') {
        showError('Cloud sync not available');
        return;
      }

      const supabaseManager = new SupabaseTokenManager();
      debug.log('🌐 Manual cloud sync - Browser ID:', supabaseManager.generateUserId());

      const supabaseResult = await supabaseManager.storeToken({
        token: result.diceCloudToken,
        userId: result.diceCloudUserId,
        tokenExpires: result.tokenExpires,
        username: result.username || 'DiceCloud User',
        authId: result.authId || result.diceCloudUserId
      });

      if (supabaseResult.success) {
        showSuccess('Token synced to cloud!');
      } else {
        showError('Cloud sync failed: ' + (supabaseResult.error || 'Unknown error'));
      }
    } catch (error) {
      debug.error('Error syncing to cloud:', error);
      showError('Cloud sync error: ' + error.message);
    } finally {
      cloudSyncBtn.disabled = false;
      cloudSyncBtn.textContent = '☁️ Sync to Cloud';
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

      // Check for installer-provided pairing code first
      let code = null;
      let installerProvided = false;

      try {
        // First, request fresh code from installer via native messaging
        debug.log('🔍 Requesting pairing code from installer...');
        await browserAPI.runtime.sendMessage({ action: 'requestPairingCodeFromInstaller' });

        // Small delay to allow native messaging response
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if installer provided a code
        const stored = await browserAPI.storage.local.get(['installerPairingCode']);
        if (stored.installerPairingCode) {
          code = stored.installerPairingCode;
          installerProvided = true;
          debug.log('📥 Using installer-provided pairing code:', code);
          // Clear the stored code so it's not reused
          await browserAPI.storage.local.remove(['installerPairingCode']);
        }
      } catch (e) {
        debug.warn('Could not check for installer pairing code:', e);
      }

      // If no installer code, generate one locally
      if (!code) {
        code = generatePairingCode();
        debug.log('🎲 Generated local pairing code:', code);
      }

      // Get DiceCloud user info
      const loginStatus = await browserAPI.runtime.sendMessage({ action: 'checkLoginStatus' });
      const diceCloudUsername = loginStatus.username || 'Unknown';
      const diceCloudUserId = loginStatus.userId; // This is the Meteor ID

      // Store in Supabase (only if we generated locally - installer code already exists)
      if (!installerProvided) {
        const storeResult = await browserAPI.runtime.sendMessage({
          action: 'createDiscordPairing',
          code: code,
          username: diceCloudUsername,
          diceCloudUserId: diceCloudUserId
        });

        if (!storeResult.success) {
          throw new Error(storeResult.error || 'Failed to create pairing');
        }
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

        debug.log('📥 Pairing check result:', {
          success: result.success,
          connected: result.connected,
          hasWebhookUrl: !!result.webhookUrl,
          webhookUrlPreview: result.webhookUrl ? `${result.webhookUrl.substring(0, 50)}...` : '(empty)',
          serverName: result.serverName,
          pairingId: result.pairingId
        });

        if (result.success && result.connected && result.webhookUrl) {
          // Connected! Save webhook and update UI
          clearInterval(pairingPollInterval);
          pairingPollInterval = null;

          debug.log('🔗 Saving Discord webhook from pairing:', {
            webhookUrl: result.webhookUrl ? `${result.webhookUrl.substring(0, 50)}...` : '(empty)',
            serverName: result.serverName,
            pairingId: result.pairingId
          });

          const setResult = await browserAPI.runtime.sendMessage({
            action: 'setDiscordWebhook',
            webhookUrl: result.webhookUrl,
            enabled: true,
            serverName: result.serverName,
            pairingId: result.pairingId, // For command polling
            discordUserId: result.discordUserId // Link to auth_tokens
          });

          debug.log('📝 setDiscordWebhook response:', setResult);

          showDiscordConnected(result.serverName);
          showDiscordStatus('Connected to Discord!', 'success');

          // Re-sync character to cloud with the new Discord user ID
          debug.log('🔄 Re-syncing character to cloud with Discord user ID');
          try {
            await handleSyncCharacterToCloud();
          } catch (e) {
            debug.warn('Could not re-sync character after Discord link:', e);
          }
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
   * Handles checking Discord integration for current character
   */
  async function handleCheckDiscordIntegration() {
    // Get the button that was clicked (could be either connected or not connected state)
    const checkBtn = document.getElementById('checkDiscordIntegration') || document.getElementById('checkDiscordIntegrationNotConnected');
    
    if (!checkBtn) {
      debug.error('Check Discord integration button not found');
      showDiscordStatus('Error: Button not found', 'error');
      return;
    }

    const originalText = checkBtn.textContent;

    try {
      checkBtn.disabled = true;
      checkBtn.textContent = '⏳ Checking...';

      // Get current character data
      const result = await browserAPI.storage.local.get(['activeCharacterId', 'characterProfiles']);
      const activeCharacterId = result.activeCharacterId;
      const characterProfiles = result.characterProfiles || {};

      if (!activeCharacterId || !characterProfiles[activeCharacterId]) {
        showDiscordStatus('No active character found', 'error');
        return;
      }

      const currentCharacter = characterProfiles[activeCharacterId];
      debug.log('🔍 Checking Discord integration for character:', currentCharacter.name);

      // Send message to background script to check Discord integration
      const response = await browserAPI.runtime.sendMessage({
        action: 'checkDiscordCharacterIntegration',
        characterName: currentCharacter.name,
        characterId: currentCharacter.id
      });

      if (response.success) {
        if (response.found) {
          showDiscordStatus(`✅ ${currentCharacter.name} is active in Discord server: ${response.serverName}`, 'success');
        } else {
          let message = `❌ ${currentCharacter.name} is not currently active in any Discord server`;
          
          if (response.message === 'Discord integration not configured') {
            message = `❌ Discord integration not configured. Please set up Discord integration first.`;
          } else if (response.availableCharacter && response.availableCharacter.name !== currentCharacter.name) {
            message = `❌ ${currentCharacter.name} is not active. Currently active: ${response.availableCharacter.name} (Level ${response.availableCharacter.level} ${response.availableCharacter.race} ${response.availableCharacter.class})`;
          }
          
          showDiscordStatus(message, 'warning');
        }
      } else {
        showDiscordStatus(`Error checking integration: ${response.error}`, 'error');
      }
    } catch (error) {
      debug.error('Check Discord integration error:', error);
      showDiscordStatus(`Error: ${error.message}`, 'error');
    } finally {
      if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = originalText;
      }
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
    // Only explicit indicators - manifest name or version suffix
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
          // Only mark as experimental if version has 4 parts ending in .1 (e.g., 1.2.2.1)
          const version = manifest && manifest.version;
          if (!version) return false;
          const parts = version.split('.');
          return parts.length === 4 && parts[3] === '1';
        } catch (e) {
          debug.log('🔍 Could not check manifest version:', e);
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
          try {
            const manifest = browserAPI.runtime.getManifest();
            versionDisplay.textContent = `v${manifest.version} - Experimental Sync`;
          } catch (e) {
            versionDisplay.textContent = 'Experimental Sync';
          }
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
