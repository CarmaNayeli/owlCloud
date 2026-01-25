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

      if (isInstalled) {
        statusText.textContent = 'Extension already installed! Proceeding...';
        setTimeout(() => goToStep(3), 1000);
      } else {
        statusText.textContent = `Selected ${getBrowserName(selectedBrowser)}. Installing...`;
        setTimeout(() => goToStep(2), 500);
      }
    });
  });
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

    if ((result.message && result.message.includes('Extension policy installed')) || 
        (result.message && result.message.includes('manual installation'))) {
      progress.classList.add('hidden');
      complete.classList.remove('hidden');
      
      // Check if manual action is required
      if (result.requiresManualAction) {
        const noteElement = document.querySelector('#installComplete .note');
        
        if (result.manualInstructions.type === 'firefox_addon') {
          noteElement.innerHTML = `
            <strong>Firefox addon installation opened:</strong><br>
            Please follow these steps:<br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            <div style="margin-top: 15px;">
              <button onclick="window.api.openExternal('${result.manualInstructions.url}')" style="background: #0060df; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Reopen Addon Installation
              </button>
            </div>
          `;
        } else if (result.manualInstructions.type === 'firefox_download') {
          noteElement.innerHTML = `
            <strong>Firefox Developer Edition recommended:</strong><br>
            Firefox Developer Edition has relaxed signing requirements for unsigned extensions.<br><br>
            ${result.manualInstructions.steps.map(step => `<div style="margin: 5px 0;">${step}</div>`).join('')}
            <div style="margin-top: 15px;">
              <button onclick="installFirefoxDevEdition()" style="background: #ff9500; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Install Firefox Developer Edition
              </button>
            </div>
            <div style="margin-top: 10px;">
              <button onclick="window.location.reload()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Retry Installation
              </button>
            </div>
          `;
        } else {
          // Handle manual policy installation (fallback)
          noteElement.innerHTML = `
            <strong>Manual installation required:</strong><br>
            Please follow these steps:<br>
            1. Create the file: <code>${result.manualInstructions.file}</code><br>
            2. Copy this content into the file:<br>
            <pre style="background: #f5f5f5; padding: 10px; margin: 10px 0; font-size: 12px; overflow-x: auto;">${JSON.stringify(result.manualInstructions.content, null, 2)}</pre>
            3. Restart Firefox
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
  try {
    progress.classList.remove('hidden');
    error.classList.add('hidden');
    complete.classList.add('hidden');
    
    const noteElement = document.querySelector('#installComplete .note');
    noteElement.innerHTML = `
      <strong>Installing Firefox Developer Edition...</strong><br>
      Please wait while Firefox Developer Edition is installed from the bundled installer.<br>
      <div style="margin-top: 15px;">
        <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 10px 0;">
          <div id="installProgress">Installing from bundled installer...</div>
        </div>
      </div>
    `;
    
    const result = await window.api.installFirefoxDevEdition();
    
    if (result.success) {
      noteElement.innerHTML = `
        <strong>✅ Firefox Developer Edition installed successfully!</strong><br>
        Firefox Developer Edition has been installed with relaxed signing requirements.<br><br>
        <div style="margin-top: 15px;">
          <button onclick="window.location.reload()" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Retry RollCloud Installation
          </button>
        </div>
      `;
    } else {
      noteElement.innerHTML = `
        <strong>❌ Failed to install Firefox Developer Edition</strong><br>
        Error: ${result.error}<br><br>
        <div style="margin-top: 15px;">
          <button onclick="window.api.openExternal('https://www.mozilla.org/firefox/developer/')" style="background: #ff9500; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Download Manually
          </button>
        </div>
        <div style="margin-top: 10px;">
          <button onclick="window.location.reload()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Retry Installation
          </button>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to install Firefox Developer Edition:', error);
    noteElement.innerHTML = `
      <strong>❌ Failed to install Firefox Developer Edition</strong><br>
      Error: ${error.message}<br><br>
      <div style="margin-top: 15px;">
        <button onclick="window.api.openExternal('https://www.mozilla.org/firefox/developer/')" style="background: #ff9500; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Download Manually
        </button>
      </div>
      <div style="margin-top: 10px;">
        <button onclick="window.location.reload()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Retry Installation
        </button>
      </div>
    `;
  }
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
        // Firefox doesn't have a restart URL, so we'll close it and let user reopen
        await window.api.openExternal('about:blank');
      }
    } catch (error) {
      console.error('Failed to restart browser:', error);
      alert(`Please manually restart ${browserName} to complete the extension installation.`);
    }
  }
}
