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
    edge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox'
  };
  return names[browser] || browser;
}

// ============================================================================
// Step 2: Install Extension
// ============================================================================

function setupStep2() {
  const continueBtn = document.getElementById('continueToStep3');
  const retryBtn = document.getElementById('retryInstall');

  continueBtn.addEventListener('click', () => goToStep(3));
  retryBtn.addEventListener('click', () => installExtension());
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
    const result = await window.api.installExtension(selectedBrowser);

    if (result.success) {
      progress.classList.add('hidden');
      complete.classList.remove('hidden');
    } else {
      throw new Error(result.error || 'Installation failed');
    }
  } catch (err) {
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
  const continueBtn = document.getElementById('continueToStep4');
  const botAddedDiv = document.getElementById('botAdded');

  addBotBtn.addEventListener('click', async () => {
    await window.api.openDiscordInvite();
    // Show continue button after opening Discord
    setTimeout(() => {
      botAddedDiv.classList.remove('hidden');
    }, 1000);
  });

  continueBtn.addEventListener('click', () => goToStep(4));
}

// ============================================================================
// Step 4: Connect
// ============================================================================

function setupStep4() {
  const copyBtn = document.getElementById('copyCode');

  copyBtn.addEventListener('click', () => {
    if (pairingCode) {
      navigator.clipboard.writeText(`/rollcloud ${pairingCode}`);
      copyBtn.textContent = '[copied]';
      setTimeout(() => {
        copyBtn.textContent = '[copy]';
      }, 2000);
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
