/**
 * Extension Installer Module
 * Handles enterprise policy installation for Chrome/Firefox on Windows/macOS/Linux
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Browser-specific configuration
const BROWSER_CONFIG = {
  chrome: {
    name: 'Google Chrome',
    windows: {
      registryPath: 'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist',
      registryPath32on64: 'HKLM\\SOFTWARE\\WOW6432Node\\Policies\\Google\\Chrome\\ExtensionInstallForcelist'
    },
    mac: {
      plistPath: '/Library/Managed Preferences/com.google.Chrome.plist',
      plistKey: 'ExtensionInstallForcelist'
    },
    linux: {
      jsonPath: '/etc/opt/chrome/policies/managed/rollcloud.json',
      jsonKey: 'ExtensionInstallForcelist'
    }
  },
  firefox: {
    name: 'Mozilla Firefox',
    // Firefox uses a different mechanism - distribution folder
    windows: {
      distributionPath: null // Detected at runtime
    },
    mac: {
      distributionPath: '/Applications/Firefox.app/Contents/Resources/distribution'
    },
    linux: {
      distributionPath: '/usr/lib/firefox/distribution'
    }
  }
};

/**
 * Install extension via enterprise policy
 */
async function installExtension(browser, config) {
  const platform = process.platform;

  if (browser === 'firefox') {
    return await installFirefoxExtension(config);
  }

  // Chrome uses similar policy mechanisms
  const browserConfig = BROWSER_CONFIG[browser];
  if (!browserConfig) {
    throw new Error(`Unsupported browser: ${browser}`);
  }

  // Use browser-specific update URL
  let updateUrl;
  if (browser === 'chrome') {
    updateUrl = config.chromeUpdateUrl || config.updateManifestUrl;
  } else {
    updateUrl = config.firefoxUpdateUrl;
  }

  const policyValue = `${config.extensionId};${updateUrl}`;

  switch (platform) {
    case 'win32':
      return await installWindowsPolicy(browser, policyValue, browserConfig);
    case 'darwin':
      return await installMacPolicy(browser, policyValue, browserConfig);
    case 'linux':
      return await installLinuxPolicy(browser, policyValue, browserConfig);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Windows: Write registry key for Chrome
 */
async function installWindowsPolicy(browser, policyValue, browserConfig) {
  const regPath = browserConfig.windows.registryPath;

  // Find the next available index
  let index = 1;
  try {
    const result = execSync(`reg query "${regPath}" 2>nul`, { encoding: 'utf-8' });
    const matches = result.match(/REG_SZ/g);
    if (matches) {
      index = matches.length + 1;
    }
  } catch {
    // Key doesn't exist, will be created
  }

  // Create the registry key
  const cmd = `reg add "${regPath}" /v "${index}" /t REG_SZ /d "${policyValue}" /f`;

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // Try with elevated privileges using sudo-prompt
        const sudo = require('sudo-prompt');
        const options = { name: 'RollCloud Setup' };

        sudo.exec(cmd, options, (sudoError, sudoStdout, sudoStderr) => {
          if (sudoError) {
            reject(new Error(`Failed to write registry: ${sudoError.message}`));
          } else {
            resolve({ message: 'Extension policy installed (elevated)', requiresRestart: true });
          }
        });
      } else {
        resolve({ message: 'Extension policy installed', requiresRestart: true });
      }
    });
  });
}

/**
 * macOS: Write plist file for Chrome
 */
async function installMacPolicy(browser, policyValue, browserConfig) {
  const plistPath = browserConfig.mac.plistPath;
  const plistKey = browserConfig.mac.plistKey;

  // Create the directory if it doesn't exist
  const dir = path.dirname(plistPath);

  // Read existing plist or create new one
  let plistContent = {};
  if (fs.existsSync(plistPath)) {
    try {
      const result = execSync(`plutil -convert json -o - "${plistPath}"`, { encoding: 'utf-8' });
      plistContent = JSON.parse(result);
    } catch {
      // Plist might be binary or invalid, start fresh
    }
  }

  // Add our extension to the forcelist
  if (!plistContent[plistKey]) {
    plistContent[plistKey] = [];
  }
  if (!plistContent[plistKey].includes(policyValue)) {
    plistContent[plistKey].push(policyValue);
  }

  // Write the plist
  const tempFile = path.join(os.tmpdir(), 'rollcloud-policy.json');
  fs.writeFileSync(tempFile, JSON.stringify(plistContent, null, 2));

  const commands = [
    `mkdir -p "${dir}"`,
    `plutil -convert xml1 "${tempFile}" -o "${plistPath}"`,
    `rm "${tempFile}"`
  ].join(' && ');

  return new Promise((resolve, reject) => {
    const sudo = require('sudo-prompt');
    const options = { name: 'RollCloud Setup' };

    sudo.exec(commands, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to write plist: ${error.message}`));
      } else {
        resolve({ message: 'Extension policy installed', requiresRestart: true });
      }
    });
  });
}

/**
 * Linux: Write JSON policy file for Chrome
 */
async function installLinuxPolicy(browser, policyValue, browserConfig) {
  const jsonPath = browserConfig.linux.jsonPath;
  const jsonKey = browserConfig.linux.jsonKey;
  const dir = path.dirname(jsonPath);

  // Read existing policy or create new one
  let policyContent = {};
  if (fs.existsSync(jsonPath)) {
    try {
      policyContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch {
      // Invalid JSON, start fresh
    }
  }

  // Add our extension to the forcelist
  if (!policyContent[jsonKey]) {
    policyContent[jsonKey] = [];
  }
  if (!policyContent[jsonKey].includes(policyValue)) {
    policyContent[jsonKey].push(policyValue);
  }

  // Write to temp file first
  const tempFile = path.join(os.tmpdir(), 'rollcloud-policy.json');
  fs.writeFileSync(tempFile, JSON.stringify(policyContent, null, 2));

  const commands = [
    `mkdir -p "${dir}"`,
    `cp "${tempFile}" "${jsonPath}"`,
    `chmod 644 "${jsonPath}"`,
    `rm "${tempFile}"`
  ].join(' && ');

  return new Promise((resolve, reject) => {
    exec(`sudo ${commands}`, (error, stdout, stderr) => {
      if (error) {
        // Try with sudo-prompt for GUI prompt
        const sudo = require('sudo-prompt');
        const options = { name: 'RollCloud Setup' };

        sudo.exec(commands, options, (sudoError, sudoStdout, sudoStderr) => {
          if (sudoError) {
            reject(new Error(`Failed to write policy: ${sudoError.message}`));
          } else {
            resolve({ message: 'Extension policy installed', requiresRestart: true });
          }
        });
      } else {
        resolve({ message: 'Extension policy installed', requiresRestart: true });
      }
    });
  });
}

/**
 * Check if Firefox Developer Edition is installed
 * Returns the path to firefox.exe if found, null otherwise
 */
function findFirefoxDeveloperEdition() {
  const platform = process.platform;

  if (platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const paths = [
      path.join(programFiles, 'Firefox Developer Edition', 'firefox.exe'),
      path.join(programFiles86, 'Firefox Developer Edition', 'firefox.exe')
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log(`   ✅ Found Firefox Developer Edition: ${p}`);
        return p;
      }
    }
  } else if (platform === 'darwin') {
    const devPath = '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox';
    if (fs.existsSync(devPath)) {
      return devPath;
    }
  } else {
    // Linux - check for firefox-developer-edition or firefox-devedition
    try {
      execSync('which firefox-developer-edition', { stdio: 'pipe' });
      return 'firefox-developer-edition';
    } catch {
      try {
        execSync('which firefox-devedition', { stdio: 'pipe' });
        return 'firefox-devedition';
      } catch {
        // Not found
      }
    }
  }

  return null;
}

/**
 * Check if Firefox is currently running
 */
function isFirefoxRunning() {
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      const result = execSync('tasklist /FI "IMAGENAME eq firefox.exe" /NH', { encoding: 'utf-8', stdio: 'pipe' });
      return result.toLowerCase().includes('firefox.exe');
    } else if (platform === 'darwin') {
      const result = execSync('pgrep -x firefox', { encoding: 'utf-8', stdio: 'pipe' });
      return result.trim().length > 0;
    } else {
      const result = execSync('pgrep -x firefox', { encoding: 'utf-8', stdio: 'pipe' });
      return result.trim().length > 0;
    }
  } catch {
    return false;
  }
}

/**
 * Launch Firefox with an optional URL/file
 */
function launchFirefox(firefoxPath, fileToOpen = null) {
  const platform = process.platform;

  try {
    let command;
    if (platform === 'win32') {
      command = fileToOpen
        ? `start "" "${firefoxPath}" "${fileToOpen}"`
        : `start "" "${firefoxPath}"`;
    } else if (platform === 'darwin') {
      command = fileToOpen
        ? `open -a "Firefox Developer Edition" "${fileToOpen}"`
        : `open -a "Firefox Developer Edition"`;
    } else {
      command = fileToOpen
        ? `${firefoxPath} "${fileToOpen}" &`
        : `${firefoxPath} &`;
    }

    exec(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('   Failed to launch Firefox:', error.message);
    return false;
  }
}

/**
 * Install Firefox Developer Edition from bundled stub installer
 */
async function installFirefoxDeveloperEdition() {
  try {
    console.log('   Installing Firefox Developer Edition from stub installer...');

    // Path to the bundled installer - check both dev and production paths
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev') || !process.resourcesPath;
    let installerPath;

    if (isDev) {
      // Development: installer is in assets folder
      installerPath = path.join(__dirname, '..', 'assets', 'FirefoxDeveloperEdition.exe');
    } else {
      // Production: installer is in extraResources
      installerPath = path.join(process.resourcesPath, 'installers', 'FirefoxDeveloperEdition.exe');
    }

    console.log(`   Looking for installer at: ${installerPath}`);

    if (!fs.existsSync(installerPath)) {
      // Fallback: try the other path
      const fallbackPath = isDev
        ? path.join(process.resourcesPath || '', 'installers', 'FirefoxDeveloperEdition.exe')
        : path.join(__dirname, '..', 'assets', 'FirefoxDeveloperEdition.exe');

      console.log(`   Trying fallback path: ${fallbackPath}`);

      if (fs.existsSync(fallbackPath)) {
        installerPath = fallbackPath;
      } else {
        // Open download page as last resort
        const { shell } = require('electron');
        await shell.openExternal('https://www.mozilla.org/firefox/developer/');
        return {
          success: false,
          openedDownloadPage: true,
          downloadUrl: 'https://www.mozilla.org/firefox/developer/',
          message: 'Installer not found. Download page opened instead.'
        };
      }
    }

    console.log(`   Using stub installer: ${installerPath}`);

    // Run the stub installer - it will download and install Firefox Developer Edition
    // Using spawn for better handling of the installer process
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const installer = spawn(installerPath, [], {
        detached: true,
        stdio: 'ignore'
      });

      installer.unref();

      // The stub installer runs and downloads Firefox in the background
      // We return immediately and let the user wait
      console.log('   Stub installer launched - it will download Firefox Developer Edition');

      resolve({
        success: true,
        installing: true,
        message: 'Firefox Developer Edition installer launched. Please wait for installation to complete, then click Retry.'
      });
    });

  } catch (error) {
    console.error('   Failed to install Firefox Developer Edition:', error);

    // Fallback: open download page
    try {
      const { shell } = require('electron');
      await shell.openExternal('https://www.mozilla.org/firefox/developer/');
    } catch (e) {
      // Ignore
    }

    return {
      success: false,
      error: error.message,
      openedDownloadPage: true,
      downloadUrl: 'https://www.mozilla.org/firefox/developer/',
      message: `Installation failed: ${error.message}. Download page opened.`
    };
  }
}
/**
 * Install Firefox Extension with proper flow:
 * 1. Check if Firefox Developer Edition is installed
 * 2. If not, install it
 * 3. Check if Firefox is running
 * 4. If not, open it
 * 5. Send the extension to Firefox for installation
 */
async function installFirefoxExtension(config) {
  try {
    const crypto = require('crypto');
    const platform = process.platform;

    console.log('\n🦊 Starting Firefox extension installation...');
    console.log(`   Platform: ${platform}`);

    // ========================================================================
    // Step 1: Check if Firefox Developer Edition is installed
    // ========================================================================
    console.log('\n   Step 1: Checking for Firefox Developer Edition...');
    let firefoxPath = findFirefoxDeveloperEdition();

    // ========================================================================
    // Step 2: If not installed, prompt user to download Firefox Developer Edition
    // ========================================================================
    if (!firefoxPath) {
      console.log('   Firefox Developer Edition not found.');
      console.log('\n   Step 2: Firefox Developer Edition required...');

      // Return instructions to download - all platforms use the same approach
      return {
        message: 'Firefox Developer Edition is required but not installed.',
        requiresRestart: false,
        requiresManualAction: true,
        manualInstructions: {
          type: 'firefox_download',
          steps: [
            '1. Firefox Developer Edition is required for this extension',
            '2. Click "Download Firefox Developer Edition" below',
            '3. Install Firefox Developer Edition',
            '4. Click "Retry Installation" to continue'
          ],
          downloadUrl: 'https://www.mozilla.org/firefox/developer/',
          autoInstall: false
        }
      };
    } else {
      console.log('   ✅ Firefox Developer Edition already installed');
    }

    // ========================================================================
    // Step 3: Locate the XPI file
    // ========================================================================
    console.log('\n   Step 3: Locating extension XPI file...');

    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    let localXpiPath;

    if (isDev) {
      localXpiPath = path.join(__dirname, '..', '..', '..', 'dist', 'rollcloud-firefox-signed.xpi');
    } else {
      localXpiPath = path.join(process.resourcesPath, 'extension', 'rollcloud-firefox.xpi');
    }

    if (!fs.existsSync(localXpiPath)) {
      throw new Error(`Firefox XPI file not found at: ${localXpiPath}`);
    }

    // Verify file integrity
    const stats = fs.statSync(localXpiPath);
    console.log(`   XPI file size: ${stats.size} bytes`);

    if (stats.size < 1000) {
      throw new Error(`XPI file appears to be too small (${stats.size} bytes)`);
    }

    // Check for valid ZIP header
    const fileBuffer = fs.readFileSync(localXpiPath);
    const header = fileBuffer.toString('ascii', 0, 2);
    if (header !== 'PK') {
      throw new Error('XPI file is corrupted - invalid ZIP header');
    }

    console.log('   ✅ XPI file validated');

    // ========================================================================
    // Step 4: Configure Firefox for unsigned extensions
    // ========================================================================
    console.log('\n   Step 4: Configuring Firefox for unsigned extensions...');

    if (platform === 'win32') {
      const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming');
      const firefoxProfileDir = path.join(appData, 'Mozilla', 'Firefox', 'Profiles');

      if (fs.existsSync(firefoxProfileDir)) {
        const profiles = fs.readdirSync(firefoxProfileDir).filter(f => {
          const fullPath = path.join(firefoxProfileDir, f);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const profile of profiles) {
          const prefsPath = path.join(firefoxProfileDir, profile, 'prefs.js');
          try {
            let prefsContent = '';
            if (fs.existsSync(prefsPath)) {
              prefsContent = fs.readFileSync(prefsPath, 'utf8');
            }

            if (!prefsContent.includes('xpinstall.signatures.required')) {
              prefsContent += '\n// Allow unsigned extensions for RollCloud\n';
              prefsContent += 'user_pref("xpinstall.signatures.required", false);\n';
              prefsContent += 'user_pref("extensions.langpacks.signatures.required", false);\n';
              fs.writeFileSync(prefsPath, prefsContent);
              console.log(`   ✅ Configured profile: ${profile}`);
            }
          } catch (prefsError) {
            console.log(`   ⚠️ Could not configure profile ${profile}: ${prefsError.message}`);
          }
        }
      }
    }

    // ========================================================================
    // Step 5: Check if Firefox is running
    // ========================================================================
    console.log('\n   Step 5: Checking if Firefox is running...');
    const wasRunning = isFirefoxRunning();

    if (wasRunning) {
      console.log('   ✅ Firefox is already running');
    } else {
      console.log('   Firefox is not running, will launch it');
    }

    // ========================================================================
    // Step 6: Open Firefox with the XPI file for installation
    // ========================================================================
    console.log('\n   Step 6: Opening Firefox with extension...');

    // Launch Firefox with the XPI file to trigger installation dialog
    const launched = launchFirefox(firefoxPath, localXpiPath);

    if (launched) {
      console.log('   ✅ Firefox launched with extension file');

      // Give Firefox a moment to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        message: 'Extension policy installed - Firefox opened with extension',
        requiresRestart: false,
        requiresManualAction: true,
        manualInstructions: {
          type: 'firefox_addon',
          steps: [
            '1. Firefox should now show an installation prompt',
            '2. Click "Add" to install the RollCloud extension',
            '3. Grant any requested permissions',
            '4. The extension icon should appear in the toolbar'
          ],
          xpiPath: localXpiPath
        }
      };
    } else {
      // Fallback: provide manual instructions
      return {
        message: 'Could not launch Firefox automatically.',
        requiresRestart: true,
        requiresManualAction: true,
        manualInstructions: {
          type: 'firefox_addon_manual',
          steps: [
            '1. Open Firefox Developer Edition manually',
            '2. Press Ctrl+O (or Cmd+O on Mac) to open a file',
            `3. Navigate to: ${localXpiPath}`,
            '4. Click "Add" to install the extension',
            '5. Grant any requested permissions'
          ],
          xpiPath: localXpiPath
        }
      };
    }

  } catch (error) {
    console.error('   Firefox installation error:', error);
    throw new Error(`Failed to install Firefox extension: ${error.message}`);
  }
}

// Extension IDs for different browsers
const EXTENSION_IDS = {
  chrome: 'mkckngoemfjdkhcpaomdndlecolckgdj', // Actual Chrome extension ID
  firefox: 'rollcloud@dicecat.dev' // Firefox extension ID
};

/**
 * Get Chrome extension ID from the signing key
 */
function getChromeExtensionId() {
  const keysDir = path.join(__dirname, '..', '..', 'keys');
  const idFile = path.join(__dirname, '..', '..', 'dist', 'rollcloud-chrome-signed.id');

  // Try to read pre-generated ID
  if (fs.existsSync(idFile)) {
    return fs.readFileSync(idFile, 'utf8').trim();
  }

  // Fallback: generate from public key if available
  const publicKeyDer = path.join(keysDir, 'public.der');
  if (fs.existsSync(publicKeyDer)) {
    const crypto = require('crypto');
    const keyData = fs.readFileSync(publicKeyDer);
    const hash = crypto.createHash('sha256').update(keyData).digest();
    let result = '';
    for (let i = 0; i < 16; i++) {
      const byte = hash[i];
      result += String.fromCharCode(97 + ((byte >> 4) & 0x0F));
      result += String.fromCharCode(97 + (byte & 0x0F));
    }
    return result.substring(0, 32);
  }

  return null;
}

/**
 * Get browser profile directories where extensions are installed
 */
function getBrowserProfileDirs(browser) {
  const platform = process.platform;
  const home = os.homedir();
  const dirs = [];

  switch (browser) {
    case 'chrome':
      if (platform === 'win32') {
        dirs.push(path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'));
      } else if (platform === 'darwin') {
        dirs.push(path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'));
      } else {
        dirs.push(path.join(home, '.config', 'google-chrome'));
        dirs.push(path.join(home, '.config', 'chromium'));
      }
      break;

    case 'firefox':
      if (platform === 'win32') {
        dirs.push(path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'));
      } else if (platform === 'darwin') {
        dirs.push(path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles'));
      } else {
        dirs.push(path.join(home, '.mozilla', 'firefox'));
      }
      break;
  }

  return dirs.filter(d => fs.existsSync(d));
}

/**
 * Check if extension is actually installed in browser profile
 */
function checkActualInstallation(browser, extensionId) {
  if (!extensionId) {
    console.log(`  No extension ID available for ${browser}`);
    return false;
  }

  const profileDirs = getBrowserProfileDirs(browser);
  console.log(`  Checking ${browser} profile dirs:`, profileDirs);

  for (const profileDir of profileDirs) {
    if (browser === 'firefox') {
      // Firefox stores extensions in profile/extensions/ as .xpi files or folders
      try {
        const profiles = fs.readdirSync(profileDir).filter(f => {
          const fullPath = path.join(profileDir, f);
          return fs.statSync(fullPath).isDirectory() && f.includes('.default');
        });

        for (const profile of profiles) {
          const extDir = path.join(profileDir, profile, 'extensions');
          if (fs.existsSync(extDir)) {
            // Check for extension folder or xpi file
            const extPath = path.join(extDir, extensionId);
            const xpiPath = path.join(extDir, `${extensionId}.xpi`);
            if (fs.existsSync(extPath) || fs.existsSync(xpiPath)) {
              console.log(`  ✅ Found Firefox extension at: ${fs.existsSync(extPath) ? extPath : xpiPath}`);
              return true;
            }
          }

          // Also check extensions.json for enabled extensions
          const extJsonPath = path.join(profileDir, profile, 'extensions.json');
          if (fs.existsSync(extJsonPath)) {
            try {
              const extJson = JSON.parse(fs.readFileSync(extJsonPath, 'utf8'));
              const found = extJson.addons?.some(addon =>
                addon.id === extensionId && addon.active && !addon.userDisabled
              );
              if (found) {
                console.log(`  ✅ Found active Firefox extension in extensions.json`);
                return true;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        console.log(`  Error checking Firefox profiles:`, e.message);
      }
    } else {
      // Chrome stores extensions in Default/Extensions/<extension_id>/
      const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
      for (const profile of profiles) {
        const extDir = path.join(profileDir, profile, 'Extensions', extensionId);
        if (fs.existsSync(extDir)) {
          // Check if there's at least one version folder
          try {
            const versions = fs.readdirSync(extDir);
            if (versions.length > 0) {
              console.log(`  ✅ Found ${browser} extension at: ${extDir}`);
              return true;
            }
          } catch (e) {
            // Ignore read errors
          }
        }

        // Also check Preferences/Secure Preferences for extension state
        const prefsPath = path.join(profileDir, profile, 'Preferences');
        if (fs.existsSync(prefsPath)) {
          try {
            const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
            if (prefs.extensions?.settings?.[extensionId]?.state === 1) {
              console.log(`  ✅ Found enabled ${browser} extension in Preferences`);
              return true;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if extension policy is installed (enterprise deployment)
 */
function checkPolicyInstallation(browser) {
  const platform = process.platform;
  const browserConfig = BROWSER_CONFIG[browser];

  if (!browserConfig) return false;

  try {
    if (browser === 'firefox') {
      // Firefox uses policies.json with ExtensionSettings
      let policiesPath;
      if (platform === 'win32') {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        policiesPath = path.join(programFiles, 'Mozilla Firefox', 'distribution', 'policies.json');
      } else if (platform === 'darwin') {
        policiesPath = path.join(browserConfig.mac.distributionPath, 'policies.json');
      } else {
        policiesPath = path.join(browserConfig.linux.distributionPath, 'policies.json');
      }

      if (fs.existsSync(policiesPath)) {
        const policies = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
        // Correct structure: policies.policies.ExtensionSettings
        const extSettings = policies.policies?.ExtensionSettings;
        if (extSettings && extSettings[EXTENSION_IDS.firefox]) {
          console.log(`  ✅ Found Firefox policy for RollCloud`);
          return true;
        }
      }
      return false;
    }

    // Chrome uses registry on Windows, plist on macOS, JSON on Linux
    if (platform === 'win32') {
      const registryPath = browserConfig.windows.registryPath;
      try {
        const result = execSync(`reg query "${registryPath}" 2>nul`, { encoding: 'utf8' });
        // Forcelist entries are strings like "extensionId;updateUrl"
        const extensionId = EXTENSION_IDS.chrome;
        if (extensionId && result.includes(extensionId)) {
          console.log(`  ✅ Found ${browser} registry policy for RollCloud`);
          return true;
        }
      } catch (e) {
        // Registry key doesn't exist
      }
    } else if (platform === 'darwin') {
      const plistPath = browserConfig.mac.plistPath;
      if (fs.existsSync(plistPath)) {
        try {
          const result = execSync(`plutil -convert json -o - "${plistPath}"`, { encoding: 'utf8' });
          const plist = JSON.parse(result);
          const extensionId = EXTENSION_IDS.chrome;
          // Forcelist is array of strings like "extensionId;updateUrl"
          if (extensionId && plist.ExtensionInstallForcelist?.some(e => e.startsWith(extensionId))) {
            console.log(`  ✅ Found ${browser} plist policy for RollCloud`);
            return true;
          }
        } catch (e) {
          // Plist parse error
        }
      }
    } else {
      const jsonPath = browserConfig.linux.jsonPath;
      if (fs.existsSync(jsonPath)) {
        try {
          const policies = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          const extensionId = EXTENSION_IDS.chrome;
          // Forcelist is array of strings
          if (extensionId && policies.ExtensionInstallForcelist?.some(e => e.startsWith(extensionId))) {
            console.log(`  ✅ Found ${browser} policy for RollCloud`);
            return true;
          }
        } catch (e) {
          // JSON parse error
        }
      }
    }

    return false;
  } catch (error) {
    console.log(`  Error checking policy:`, error.message);
    return false;
  }
}

/**
 * Check if extension is installed - checks both actual installation and policies
 */
async function isExtensionInstalled(browser) {
  console.log(`\n🔍 Checking if RollCloud is installed in ${browser}...`);

  const browserConfig = BROWSER_CONFIG[browser];
  if (!browserConfig) {
    console.log(`  ❌ Unsupported browser: ${browser}`);
    return false;
  }

  // Get the appropriate extension ID
  const extensionId = browser === 'firefox'
    ? EXTENSION_IDS.firefox
    : EXTENSION_IDS.chrome; // Use actual Chrome extension ID

  console.log(`  Extension ID: ${extensionId || 'unknown'}`);

  // Check actual browser profile for installed extension
  const actuallyInstalled = checkActualInstallation(browser, extensionId);
  if (actuallyInstalled) {
    console.log(`  ✅ Extension is ACTUALLY INSTALLED in ${browser}`);
    return true;
  }

  // Check if policy is set (pending installation)
  const policySet = checkPolicyInstallation(browser);
  if (policySet) {
    console.log(`  ⚠️ Policy is set but extension not yet installed (browser restart may be needed)`);
    return 'policy_only';
  }

  console.log(`  ❌ Extension is NOT installed in ${browser}`);
  return false;
}

/**
 * Uninstall extension (remove policy)
 */
async function uninstallExtension(browser) {
  // Implementation for cleanup - similar structure but removes entries
  // For now, just log that this would remove the policy
  console.log(`Would uninstall ${browser} extension policy`);
  return { success: true };
}

module.exports = {
  installExtension,
  uninstallExtension,
  isExtensionInstalled,
  installFirefoxDeveloperEdition,
  findFirefoxDeveloperEdition,
  isFirefoxRunning
};
