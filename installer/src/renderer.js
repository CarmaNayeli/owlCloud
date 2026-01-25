/**
 * Renderer Process
 * Handles UI interactions for the setup wizard
 */

// State
let selectedBrowser = null;
let pairingCode = null;
let pairingPollInterval = null;
let countdownInterval = null;
let pairingExpiresAt = null;

// DOM Elements
const steps = {
  step1: document.getElementById('step1'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  step5: document.getElementById('step5'),
  errorState: document.getElementById('errorState')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get system info
  const systemInfo = await window.api.getSystemInfo();
  console.log('System info:', systemInfo);

  // Set up event listeners
  setupBrowserSelection();
  setupStep2();
  setupStep3();
  setupStep4();
  setupStep5();
  setupGlobalHandlers();
}

// ============================================================================
// Step 1: Browser Selection
// ============================================================================

function setupBrowserSelection() {
  const browserBtns = document.querySelectorAll('.browser-btn');
  const statusText = document.getElementById('browserStatus');

  browserBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      // Remove selection from all buttons
      browserBtns.forEach(b => b.classList.remove('selected'));

      // Select this button
      btn.classList.add('selected');
      selectedBrowser = btn.dataset.browser;

      // Check if already installed
      statusText.textContent = 'Checking installation status...';
      const isInstalled = await window.api.checkExtensionInstalled(selectedBrowser);

      if (isInstalled === 'policy_only') {
        // Policy is set but extension not yet installed
        statusText.innerHTML = `
          <div style="color: #ff9500;">🔄 Extension policy found!</div>
          <div style="font-size: 0.9em; margin-top: 5px;">Policy installed, but extension not yet active.</div>
          <div style="margin-top: 10px;">
            <button id="btnContinueFromPolicy" class="btn btn-primary">
              Continue Setup
            </button>
          </div>
          <div style="margin-top: 10px; font-size: 0.8em; color: #666;">
            The extension will be installed when you restart your browser.
          </div>
        `;
        document.getElementById('btnContinueFromPolicy').addEventListener('click', () => goToStep(3));
      } else if (isInstalled) {
        // Extension is installed, check for updates
        statusText.innerHTML = `
          <div style="color: #28a745;">✅ Extension found!</div>
          <div style="font-size: 0.9em; margin-top: 5px;">Extension is installed and ready.</div>
          <div style="margin-top: 10px;">
            <button id="btnContinueFromInstalled" class="btn btn-primary">
              Continue Setup
            </button>
            <button id="btnCheckUpdates" class="btn btn-secondary" style="margin-left: 10px;">
              Check for Updates
            </button>
          </div>
          <div style="margin-top: 10px; font-size: 0.8em; color: #666;">
            You can check for updates or continue with current version.
          </div>
        `;
        document.getElementById('btnContinueFromInstalled').addEventListener('click', () => goToStep(3));
        document.getElementById('btnCheckUpdates').addEventListener('click', () => checkForUpdatesAndProceed());
      } else {
        statusText.textContent = `Selected ${getBrowserName(selectedBrowser)}. Ready to install.`;
        statusText.innerHTML = `
          <div style="color: #22c55e;">✅ Ready to install!</div>
          <div style="font-size: 0.9em; margin-top: 5px;">Click Continue Setup to begin installation.</div>
          <div style="margin-top: 10px;">
            <button id="btnContinueToInstall" class="btn btn-primary">
              Continue Setup
            </button>
          </div>
          <div style="margin-top: 10px; font-size: 0.8em; color: #666;">
            The extension will be installed and configured automatically.
          </div>
        `;
        document.getElementById('btnContinueToInstall').addEventListener('click', () => goToStep(2));
      }
    });
  });
}

async function checkForUpdatesAndProceed() {
  const statusText = document.getElementById('browserStatus');
  
  try {
    const updateCheck = await window.api.checkForUpdates(selectedBrowser);
    
    if (updateCheck.success && updateCheck.updateAvailable) {
      // Update available
      statusText.innerHTML = `
        <div style="color: #ff9500;">🔄 Update available!</div>
        <div style="font-size: 0.9em; margin-top: 5px;">
          Current: v${updateCheck.currentVersion} → Latest: v${updateCheck.latestVersion}
        </div>
        <div style="margin-top: 10px;">
          <button id="btnUpdateExtension" class="btn btn-primary" style="background: #ff9500;">
            Update Extension
          </button>
          <button id="btnSkipUpdate" class="btn btn-secondary" style="margin-left: 10px;">
            Skip Update
          </button>
        </div>
      `;
      
      // Add event listeners
      document.getElementById('btnUpdateExtension').addEventListener('click', async () => {
        statusText.textContent = 'Updating extension...';
        try {
          const updateResult = await window.api.updateExtension(selectedBrowser);
          if (updateResult.success) {
            statusText.innerHTML = `
              <div style="color: #28a745;">✅ Update initiated!</div>
              <div style="font-size: 0.9em; margin-top: 5px;">${updateResult.message}</div>
              <div style="margin-top: 10px;">
                <button id="btnContinueAfterUpdate" class="btn btn-primary">
                  Continue Setup
                </button>
              </div>
            `;
            document.getElementById('btnContinueAfterUpdate').addEventListener('click', () => goToStep(3));
          } else {
            statusText.innerHTML = `
              <div style="color: #dc3545;">❌ Update failed</div>
              <div style="font-size: 0.9em; margin-top: 5px;">${updateResult.error}</div>
              <div style="margin-top: 10px;">
                <button id="btnRetryUpdate" class="btn btn-primary">Retry</button>
                <button id="btnSkipFailedUpdate" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
              </div>
            `;
            document.getElementById('btnRetryUpdate').addEventListener('click', () => checkForUpdatesAndProceed());
            document.getElementById('btnSkipFailedUpdate').addEventListener('click', () => goToStep(3));
          }
        } catch (error) {
          statusText.innerHTML = `
            <div style="color: #dc3545;">❌ Update failed</div>
            <div style="font-size: 0.9em; margin-top: 5px;">${error.message}</div>
            <div style="margin-top: 10px;">
              <button id="btnRetryUpdateError" class="btn btn-primary">Retry</button>
              <button id="btnSkipErrorUpdate" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
            </div>
          `;
          document.getElementById('btnRetryUpdateError').addEventListener('click', () => checkForUpdatesAndProceed());
          document.getElementById('btnSkipErrorUpdate').addEventListener('click', () => goToStep(3));
        }
      });
      
      document.getElementById('btnSkipUpdate').addEventListener('click', () => goToStep(3));
      
    } else if (updateCheck.success && !updateCheck.updateAvailable) {
      // Up to date
      statusText.innerHTML = `
        <div style="color: #28a745;">✅ Extension is up to date!</div>
        <div style="font-size: 0.9em; margin-top: 5px;">Version ${updateCheck.currentVersion}</div>
        <div style="margin-top: 10px;">
          <button id="btnContinueUpToDate" class="btn btn-primary">
            Continue Setup
          </button>
          <button id="btnReinstallAnyway" class="btn btn-secondary" style="margin-left: 10px;">
            🔄 Reinstall Anyway
          </button>
          <button id="btnUninstallExtension" class="btn btn-danger" style="margin-left: 10px;">
            🗑️ Uninstall Extension
          </button>
        </div>
        <div style="margin-top: 10px; font-size: 0.8em; color: #666;">
          Use reinstall if you're experiencing issues with the extension
        </div>
      `;
      document.getElementById('btnContinueUpToDate').addEventListener('click', () => goToStep(3));
      document.getElementById('btnReinstallAnyway').addEventListener('click', async () => {
        statusText.textContent = 'Force reinstalling extension...';
        try {
          const result = await window.api.forceReinstallExtension(selectedBrowser);
          if (result.success) {
            statusText.innerHTML = `
              <div style="color: #28a745;">✅ Extension force reinstalled!</div>
              <div style="font-size: 0.9em; margin-top: 5px;">${result.message}</div>
              <div style="margin-top: 10px;">
                <button id="btnContinueAfterReinstall" class="btn btn-primary">
                  Continue Setup
                </button>
              </div>
            `;
            document.getElementById('btnContinueAfterReinstall').addEventListener('click', () => goToStep(3));
          } else {
            statusText.innerHTML = `
              <div style="color: #dc3545;">❌ Force reinstall failed</div>
              <div style="font-size: 0.9em; margin-top: 5px;">${result.error}</div>
              <div style="margin-top: 10px;">
                <button id="btnRetryForceReinstall" class="btn btn-primary">Retry</button>
                <button id="btnSkipForceReinstall" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
              </div>
            `;
            document.getElementById('btnRetryForceReinstall').addEventListener('click', () => {
              statusText.textContent = 'Force reinstalling extension...';
              window.api.forceReinstallExtension(selectedBrowser);
            });
            document.getElementById('btnSkipForceReinstall').addEventListener('click', () => goToStep(3));
          }
        } catch (error) {
          statusText.innerHTML = `
            <div style="color: #dc3545;">❌ Force reinstall error</div>
            <div style="font-size: 0.9em; margin-top: 5px;">${error.message}</div>
            <div style="margin-top: 10px;">
              <button id="btnRetryForceReinstallError" class="btn btn-primary">Retry</button>
              <button id="btnSkipForceReinstallError" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
            </div>
          `;
          document.getElementById('btnRetryForceReinstallError').addEventListener('click', () => {
            statusText.textContent = 'Force reinstalling extension...';
            window.api.forceReinstallExtension(selectedBrowser);
          });
          document.getElementById('btnSkipForceReinstallError').addEventListener('click', () => goToStep(3));
        }
      });
      
      document.getElementById('btnUninstallExtension').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to uninstall the RollCloud extension from ${selectedBrowser}? This will remove the extension and all its data.`)) {
          statusText.textContent = 'Uninstalling extension...';
          try {
            const result = await window.api.uninstallExtension(selectedBrowser);
            if (result.success) {
              statusText.innerHTML = `
                <div style="color: #28a745;">✅ Extension uninstalled!</div>
                <div style="font-size: 0.9em; margin-top: 5px;">${result.message}</div>
                <div style="margin-top: 10px;">
                  <button id="btnContinueAfterUninstall" class="btn btn-primary">
                    Continue Setup
                  </button>
                </div>
              `;
              document.getElementById('btnContinueAfterUninstall').addEventListener('click', () => goToStep(3));
            } else {
              statusText.innerHTML = `
                <div style="color: #dc3545;">❌ Uninstall failed</div>
                <div style="font-size: 0.9em; margin-top: 5px;">${result.error}</div>
                ${result.manual ? '<div style="margin-top: 5px; font-size: 0.8em; color: #666;">Please remove manually via browser Add-ons Manager.</div>' : ''}
                <div style="margin-top: 10px;">
                  <button id="btnRetryUninstall" class="btn btn-primary">Retry</button>
                  <button id="btnSkipUninstall" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
                </div>
              `;
              document.getElementById('btnRetryUninstall').addEventListener('click', () => {
                statusText.textContent = 'Uninstalling extension...';
                window.api.uninstallExtension(selectedBrowser);
              });
              document.getElementById('btnSkipUninstall').addEventListener('click', () => goToStep(3));
            }
          } catch (error) {
            statusText.innerHTML = `
              <div style="color: #dc3545;">❌ Uninstall error</div>
              <div style="font-size: 0.9em; margin-top: 5px;">${error.message}</div>
              <div style="margin-top: 10px;">
                <button id="btnRetryUninstall" class="btn btn-primary">Retry</button>
                <button id="btnSkipUninstall" class="btn btn-secondary" style="margin-left: 10px;">Skip</button>
              </div>
            `;
            document.getElementById('btnRetryUninstall').addEventListener('click', () => {
              statusText.textContent = 'Uninstalling extension...';
              window.api.uninstallExtension(selectedBrowser);
            });
            document.getElementById('btnSkipUninstall').addEventListener('click', () => goToStep(3));
          }
        }
      });
      
    } else {
      // Error checking for updates
      statusText.innerHTML = `
        <div style="color: #ffc107;">⚠️ Could not check for updates</div>
        <div style="font-size: 0.9em; margin-top: 5px;">${updateCheck.error}</div>
        <div style="margin-top: 10px;">
          <button id="btnContinueAnyway" class="btn btn-primary">
            Continue Setup
          </button>
        </div>
      `;
      document.getElementById('btnContinueAnyway').addEventListener('click', () => goToStep(3));
    }
  } catch (error) {
    console.error('Update check failed:', error);
    statusText.innerHTML = `
      <div style="color: #dc3545;">❌ Error checking updates</div>
      <div style="font-size: 0.9em; margin-top: 5px;">${error.message}</div>
      <div style="margin-top: 10px;">
        <button id="btnContinueAfterError" class="btn btn-primary">
          Continue Setup
        </button>
      </div>
    `;
    document.getElementById('btnContinueAfterError').addEventListener('click', () => goToStep(3));
  }
}

function getBrowserName(browser) {
  const names = {
    chrome: 'Google Chrome',
    firefox: 'Mozilla Firefox'
  };
  return names[browser] || browser;
}

// ============================================================================
// Step 2: Install Extension
// ============================================================================

function setupStep2() {
  const continueBtn = document.getElementById('continueToStep3');
  const restartBtn = document.getElementById('restartBrowser');
  const retryBtn = document.getElementById('retryInstall');
  const backBtn = document.getElementById('backToStep1');
  const backBtnFromError = document.getElementById('backToStep1FromError');

  continueBtn.addEventListener('click', () => goToStep(3));
  restartBtn.addEventListener('click', () => restartBrowser(selectedBrowser));
  retryBtn.addEventListener('click', () => installExtension());

  // Back button from error screen
  if (backBtnFromError) {
    backBtnFromError.addEventListener('click', () => {
      selectedBrowser = null;
      document.querySelectorAll('.browser-btn').forEach(btn => btn.classList.remove('selected'));
      document.getElementById('browserStatus').textContent = '';
      goToStep(1);
    });
  }

  // Back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      selectedBrowser = null;
      document.querySelectorAll('.browser-btn').forEach(btn => btn.classList.remove('selected'));
      document.getElementById('browserStatus').textContent = '';
      goToStep(1);
    });
  }
}

async function installExtension() {
  const progress = document.getElementById('installProgress');
  const complete = document.getElementById('installComplete');
  const error = document.getElementById('installError');
  const statusText = document.getElementById('installStatus');
  const browserName = document.getElementById('selectedBrowserName');

  // Reset UI
  progress.classList.remove('hidden');
  complete.classList.add('hidden');
  error.classList.add('hidden');

  browserName.textContent = getBrowserName(selectedBrowser);
  statusText.textContent = 'Installing extension...';

  try {
    console.log('🔧 Installing extension for:', selectedBrowser);
    console.log('🔧 CONFIG:', {
      extensionId: 'mkckngoemfjdkhcpaomdndlecolckgdj',
      chromeUpdateUrl: 'https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/updates/update_manifest.xml',
      firefoxUpdateUrl: 'https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi'
    });
    
    const result = await window.api.installExtension(selectedBrowser);

    console.log('🔧 Install result:', result);

    // Check for success or manual action required
    const isSuccess = (result.message && result.message.includes('Extension policy installed')) ||
                      (result.message && result.message.includes('manual installation')) ||
                      result.requiresManualAction === true;

    if (isSuccess) {
      progress.classList.add('hidden');
      complete.classList.remove('hidden');

      // Check if manual action is required
      if (result.requiresManualAction && result.manualInstructions) {
        const noteElement = document.querySelector('#installComplete .note');

        if (result.manualInstructions.type === 'firefox_addon') {
          noteElement.innerHTML = `
            <strong>Firefox extension installation started:</strong><br>
            Please follow these steps:<br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
          `;
        } else if (result.manualInstructions.type === 'firefox_download') {
          noteElement.innerHTML = `
            <strong>Firefox Developer Edition Required</strong><br>
            Firefox Developer Edition is needed for this extension.<br><br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            <div style="margin-top: 15px;">
              <button id="btnDownloadFirefoxDev" class="action-btn" data-url="${result.manualInstructions.downloadUrl || 'https://www.firefox.com/en-US/channel/desktop/developer/?redirect_source=mozilla-org'}" style="background: #ff9500; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Download Firefox Developer Edition
              </button>
            </div>
            <div style="margin-top: 10px;">
              <button id="btnRetryInstall" class="action-btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Retry Installation
              </button>
            </div>
          `;
          // Attach event listeners
          document.getElementById('btnDownloadFirefoxDev')?.addEventListener('click', (e) => {
            window.api.openExternal(e.target.dataset.url);
          });
          document.getElementById('btnRetryInstall')?.addEventListener('click', () => window.location.reload());
        } else if (result.manualInstructions.type === 'firefox_installation') {
          noteElement.innerHTML = `
            <strong>🔧 Installing Firefox Developer Edition</strong><br>
            The bundled installer is now running.<br><br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; color: #333; border-radius: 4px;">
              <strong>⏳ Please complete the Firefox Developer Edition installation wizard</strong><br>
              The installer should have opened automatically.<br>
              <div id="installProgress" style="margin-top: 10px; font-size: 0.9em;">
                Waiting for installation to complete...
              </div>
            </div>
            <div style="margin-top: 15px;">
              <button id="btnRetryAfterInstall" class="action-btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Installation Complete - Retry
              </button>
              <button id="btnSkipFirefoxInstall" class="action-btn" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                Skip & Continue
              </button>
            </div>
          `;
          document.getElementById('btnRetryAfterInstall')?.addEventListener('click', () => window.location.reload());
          document.getElementById('btnSkipFirefoxInstall')?.addEventListener('click', () => goToStep(3));
        } else if (result.manualInstructions.type === 'firefox_addon_manual') {
          noteElement.innerHTML = `
            <strong>Manual Firefox Installation:</strong><br>
            Please follow these steps to install the extension:<br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            ${result.manualInstructions.xpiPath ? `<div style="margin: 10px 0; padding: 10px; background: #f5f5f5; color: #333; border-radius: 4px; word-break: break-all;"><strong>XPI Location:</strong><br>${result.manualInstructions.xpiPath}</div>` : ''}
            <div style="margin-top: 15px;">
              <button id="btnRetryManual" class="action-btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Retry Installation
              </button>
            </div>
          `;
          document.getElementById('btnRetryManual')?.addEventListener('click', () => window.location.reload());
        } else {
          // Handle other manual installation types (fallback)
          const steps = result.manualInstructions.steps || [];
          noteElement.innerHTML = `
            <strong>Manual installation required:</strong><br>
            Please follow these steps:<br>
            ${steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            ${result.manualInstructions.xpiPath ? `<div style="margin: 10px 0; padding: 10px; background: #f5f5f5; color: #333; border-radius: 4px; word-break: break-all;"><strong>File Location:</strong><br>${result.manualInstructions.xpiPath}</div>` : ''}
          `;
        }
      }
    } else {
      console.error('🔧 Install failed:', result);
      throw new Error(result.message || 'Installation failed');
    }
  } catch (err) {
    console.error('🔧 Install error:', err);
    progress.classList.add('hidden');
    error.classList.remove('hidden');
    document.getElementById('installErrorText').textContent = err.message;
  }
}

// ============================================================================
// Step 3: Add Pip 2
// ============================================================================

function setupStep3() {
  const addBotBtn = document.getElementById('addPipBot');
  const skipBotBtn = document.getElementById('skipPipBot');
  const continueBtn = document.getElementById('continueToStep4');
  const botAddedDiv = document.getElementById('botAdded');
  const backBtn = document.getElementById('backToStep2');
  const backBtnNav = document.getElementById('backToStep2Nav');

  addBotBtn.addEventListener('click', async () => {
    await window.api.openDiscordInvite();
    // Show continue button after opening Discord
    setTimeout(() => {
      botAddedDiv.classList.remove('hidden');
    }, 1000);
  });

  skipBotBtn.addEventListener('click', () => {
    // Skip directly to step 4
    goToStep(4);
  });

  continueBtn.addEventListener('click', () => goToStep(4));

  // Back buttons
  const goBackToStep2 = () => {
    botAddedDiv.classList.add('hidden');
    goToStep(2);
  };

  backBtn.addEventListener('click', goBackToStep2);
  backBtnNav.addEventListener('click', goBackToStep2);
}

// ============================================================================
// Step 4: Connect
// ============================================================================

function setupStep4() {
  const copyBtn = document.getElementById('copyCode');
  const regenerateBtn = document.getElementById('regenerateCode');
  const backBtn = document.getElementById('backToStep3');

  // Back button - stop polling and go back
  backBtn.addEventListener('click', () => {
    stopPairing();
    goToStep(3);
  });

  copyBtn.addEventListener('click', () => {
    if (pairingCode) {
      navigator.clipboard.writeText(`/rollcloud ${pairingCode}`);
      copyBtn.textContent = '[copied]';
      setTimeout(() => {
        copyBtn.textContent = '[copy]';
      }, 2000);
    }
  });

  regenerateBtn.addEventListener('click', async () => {
    // Disable button temporarily
    regenerateBtn.disabled = true;
    regenerateBtn.textContent = '🔄 Generating...';

    try {
      // Generate new pairing code
      const codeResult = await window.api.generatePairingCode();
      pairingCode = codeResult.code;

      // Update the display
      const codeDisplay = document.getElementById('pairingCode');
      codeDisplay.textContent = pairingCode;

      // Create new pairing in Supabase
      await window.api.createPairing(pairingCode);

      // Reset connection status
      const waitingDiv = document.getElementById('waitingForConnection');
      const completeDiv = document.getElementById('connectionComplete');
      waitingDiv.classList.add('hidden');
      completeDiv.classList.add('hidden');

      // Re-enable button
      regenerateBtn.disabled = false;
      regenerateBtn.textContent = '🔄 Generate New Code';

      // Show success feedback
      regenerateBtn.style.backgroundColor = '#4ECDC4';
      setTimeout(() => {
        regenerateBtn.style.backgroundColor = '';
      }, 1000);

    } catch (error) {
      console.error('Failed to regenerate code:', error);
      regenerateBtn.disabled = false;
      regenerateBtn.textContent = '🔄 Generate New Code';
      
      // Show error feedback
      regenerateBtn.style.backgroundColor = '#E74C3C';
      setTimeout(() => {
        regenerateBtn.style.backgroundColor = '';
      }, 1000);
    }
  });
}

async function startPairing() {
  const codeDisplay = document.getElementById('pairingCode');
  const waitingDiv = document.getElementById('waitingForConnection');
  const completeDiv = document.getElementById('connectionComplete');
  const countdownSpan = document.getElementById('countdown');

  // Generate pairing code
  const codeResult = await window.api.generatePairingCode();
  pairingCode = codeResult.code;
  codeDisplay.textContent = pairingCode;

  // Create pairing in Supabase
  try {
    await window.api.createPairing(pairingCode);
  } catch (err) {
    console.error('Failed to create pairing:', err);
    showError('Failed to create pairing code. Please check your internet connection.');
    return;
  }

  // Start countdown (30 minutes)
  pairingExpiresAt = Date.now() + 30 * 60 * 1000;

  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, Math.floor((pairingExpiresAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    countdownSpan.textContent = `(${mins}:${secs.toString().padStart(2, '0')})`;

    if (remaining <= 0) {
      stopPairing();
      showError('Pairing code expired. Please restart setup.');
    }
  }, 1000);

  // Poll for connection every 3 seconds
  pairingPollInterval = setInterval(async () => {
    try {
      const result = await window.api.checkPairing(pairingCode);

      if (result.success && result.connected) {
        // Connected!
        stopPairing();
        waitingDiv.classList.add('hidden');
        completeDiv.classList.remove('hidden');
        document.getElementById('connectedServer').textContent = result.serverName || 'Discord Server';
        document.getElementById('connectedChannel').textContent = `#${result.channelName || 'channel'}`;

        // Move to final step after brief delay
        setTimeout(() => goToStep(5), 2000);
      }
    } catch (err) {
      console.error('Pairing check error:', err);
    }
  }, 3000);
}

function stopPairing() {
  if (pairingPollInterval) {
    clearInterval(pairingPollInterval);
    pairingPollInterval = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ============================================================================
// Step 5: Done
// ============================================================================

function setupStep5() {
  const finishBtn = document.getElementById('finishSetup');

  finishBtn.addEventListener('click', async () => {
    await window.api.quitApp();
  });
}

// ============================================================================
// Navigation
// ============================================================================

function goToStep(stepNum) {
  // Hide all steps
  Object.values(steps).forEach(step => {
    step.classList.remove('active');
  });

  // Show target step
  const targetStep = steps[`step${stepNum}`];
  if (targetStep) {
    targetStep.classList.add('active');

    // Trigger step-specific actions
    if (stepNum === 2) {
      installExtension();
    } else if (stepNum === 4) {
      startPairing();
    }
  }
}

function showError(message) {
  stopPairing();
  Object.values(steps).forEach(step => step.classList.remove('active'));
  steps.errorState.classList.add('active');
  steps.errorState.classList.remove('hidden');
  document.getElementById('globalErrorText').textContent = message;
}

// ============================================================================
// Global Handlers
// ============================================================================

function setupGlobalHandlers() {
  // Restart button
  document.getElementById('restartSetup').addEventListener('click', () => {
    selectedBrowser = null;
    pairingCode = null;
    stopPairing();

    // Reset all UI
    document.querySelectorAll('.browser-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('browserStatus').textContent = '';
    document.getElementById('botAdded').classList.add('hidden');

    // Go back to step 1
    steps.errorState.classList.remove('active');
    steps.errorState.classList.add('hidden');
    goToStep(1);
    steps.step1.classList.add('active');
  });

  // Help link
  document.getElementById('helpLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await window.api.openExternal('https://github.com/CarmaNayeli/rollCloud/issues');
  });
}

// Install Firefox Developer Edition
async function installFirefoxDevEdition() {
  const progress = document.getElementById('installProgress');
  const complete = document.getElementById('installComplete');
  const noteElement = document.querySelector('#installComplete .note');

  try {
    progress.classList.remove('hidden');
    complete.classList.add('hidden');

    noteElement.innerHTML = `
      <strong>Installing Firefox Developer Edition...</strong><br>
      The installer will download and install Firefox Developer Edition.<br>
      <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; color: #333; border-radius: 4px;">
        Please wait for the Firefox installer to complete...
      </div>
    `;

    const result = await window.api.installFirefoxDevEdition();

    progress.classList.add('hidden');
    complete.classList.remove('hidden');

    if (result.success || result.installing) {
      noteElement.innerHTML = `
        <strong style="color: #ff9500;">📥 Firefox Installer Launched</strong><br>
        The Firefox Developer Edition installer is running.<br><br>
        <strong>Please:</strong>
        <div style="margin: 10px 0;">1. Complete the Firefox installation wizard</div>
        <div style="margin: 10px 0;">2. Click the button below when done</div>
        <div style="margin-top: 15px;">
          <button id="btnRetryAfterInstall" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            I've installed Firefox Dev - Continue
          </button>
        </div>
      `;
      document.getElementById('btnRetryAfterInstall')?.addEventListener('click', () => window.location.reload());
    } else if (result.openedDownloadPage) {
      noteElement.innerHTML = `
        <strong style="color: #ff9500;">📥 Download page opened</strong><br>
        Please download and install Firefox Developer Edition from the page that just opened.<br><br>
        <div style="margin-top: 15px;">
          <button id="btnRetryAfterDownload" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            I've installed Firefox Dev - Continue
          </button>
        </div>
        <div style="margin-top: 10px;">
          <button id="btnOpenDownloadAgain" style="background: #0060df; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Open Download Page Again
          </button>
        </div>
      `;
      document.getElementById('btnRetryAfterDownload')?.addEventListener('click', () => window.location.reload());
      document.getElementById('btnOpenDownloadAgain')?.addEventListener('click', () => {
        window.api.openExternal(result.downloadUrl || 'https://www.mozilla.org/firefox/developer/');
      });
    } else {
      showFirefoxInstallError(result.message || result.error || 'Installation failed', noteElement);
    }

  } catch (err) {
    console.error('Failed to install Firefox Developer Edition:', err);
    progress.classList.add('hidden');
    complete.classList.remove('hidden');
    showFirefoxInstallError(err.message, noteElement);
  }
}

// Helper to show Firefox install error with buttons
function showFirefoxInstallError(errorMsg, noteElement) {
  noteElement.innerHTML = `
    <strong style="color: #dc3545;">❌ Firefox Developer Edition installation failed</strong><br>
    Error: ${errorMsg}<br><br>
    <div style="margin-top: 15px;">
      <button id="btnDownloadFirefox" style="background: #ff9500; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Download Manually
      </button>
    </div>
    <div style="margin-top: 10px;">
      <button id="btnRetryFirefox" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Retry Installation
      </button>
    </div>
  `;
  document.getElementById('btnDownloadFirefox')?.addEventListener('click', () => {
    window.api.openExternal('https://www.mozilla.org/firefox/developer/');
  });
  document.getElementById('btnRetryFirefox')?.addEventListener('click', () => window.location.reload());
}

// Restart browser function
async function restartBrowser(browser) {
  const browserName = getBrowserName(browser);
  
  // Show confirmation dialog
  const confirmed = confirm(`The ${browserName} extension policy has been installed.\n\nYou must restart ${browserName} for the extension to be installed.\n\nWould you like to restart ${browserName} now?`);
  
  if (confirmed) {
    try {
      if (browser === 'chrome') {
        await window.api.openExternal('chrome://restart');
      } else if (browser === 'firefox') {
        // Firefox doesn't have a restart URL, so prompt user to restart manually
        alert(`Please close and reopen Firefox to complete the extension installation.\n\nThe RollCloud extension will be installed automatically when Firefox restarts.`);
      }
    } catch (error) {
      console.error('Failed to restart browser:', error);
      alert(`Please manually restart ${browserName} to complete the extension installation.\n\nError: ${error.message}`);
    }
  } else {
    // User cancelled - don't do anything
    console.log('User cancelled browser restart');
  }
}
