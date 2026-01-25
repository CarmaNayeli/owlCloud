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
 * Install Firefox Developer Edition from bundled installer
 */
async function installFirefoxDeveloperEdition() {
  try {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    console.log('   Installing Firefox Developer Edition from bundled installer...');
    
    // Path to the bundled installer
    const installerPath = path.join(__dirname, '..', 'assets', 'FirefoxDeveloperEdition.exe');
    
    if (!fs.existsSync(installerPath)) {
      throw new Error('Firefox Developer Edition installer not found in assets');
    }
    
    console.log(`   Using bundled installer: ${installerPath}`);
    
    // Run the installer silently
    execSync(`"${installerPath}" /S`, { stdio: 'pipe', timeout: 60000 });
    
    console.log('   Firefox Developer Edition installed successfully!');
    return { success: true };
    
  } catch (error) {
    console.error('   Failed to install Firefox Developer Edition:', error);
    throw new Error(`Failed to install Firefox Developer Edition: ${error.message}`);
  }
}
async function installFirefoxExtension(config) {
  // Use Firefox's about:addons page for manual installation
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { execSync } = require('child_process');
    const crypto = require('crypto');
    
    // Use the packaged XPI file from installer resources
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    let localXpiPath;
    let distXpiPath;
    
    if (isDev) {
      // Development: use the dist directory
      localXpiPath = path.join(__dirname, '..', '..', '..', 'dist', 'rollcloud-firefox-signed.xpi');
      distXpiPath = localXpiPath; // Same path in dev
    } else {
      // Production: use the packaged resources
      localXpiPath = path.join(process.resourcesPath, 'extension', 'rollcloud-firefox.xpi');
      distXpiPath = path.join(__dirname, '..', '..', '..', 'dist', 'rollcloud-firefox-signed.xpi');
    }
    
    // Check if both XPI files exist
    if (!fs.existsSync(localXpiPath)) {
      throw new Error(`Firefox XPI file not found at: ${localXpiPath}`);
    }
    
    if (!fs.existsSync(distXpiPath)) {
      console.log('   Warning: Dist XPI file not found, only installer XPI available');
    }
    
    // Compare checksums if both files exist
    if (fs.existsSync(distXpiPath)) {
      const distHash = crypto.createHash('sha256').update(fs.readFileSync(distXpiPath)).digest('hex');
      const localHash = crypto.createHash('sha256').update(fs.readFileSync(localXpiPath)).digest('hex');
      
      console.log(`   Dist XPI checksum: ${distHash}`);
      console.log(`   Installer XPI checksum: ${localHash}`);
      
      if (distHash !== localHash) {
        console.log('   ❌ XPI files do not match! Packaging corruption detected.');
        console.log('   Using dist XPI file directly...');
        localXpiPath = distXpiPath;
      } else {
        console.log('   ✅ XPI files match - packaging is good');
      }
    }
    
    // Verify file integrity by checking file size and basic structure
    const stats = fs.statSync(localXpiPath);
    console.log(`   XPI file size: ${stats.size} bytes`);
    
    if (stats.size < 1000) {
      throw new Error(`XPI file appears to be too small (${stats.size} bytes)`);
    }
    
    // Read first few bytes to verify it's a valid ZIP/XPI file
    const fileBuffer = fs.readFileSync(localXpiPath, { start: 0, end: 30 });
    const header = fileBuffer.toString('ascii', 0, Math.min(30, fileBuffer.length));
    console.log(`   XPI file header: ${header}`);
    
    // XPI files are ZIP files, should start with PK (0x50 0x4b)
    if (!header.startsWith('PK')) {
      console.log('   ❌ XPI file does not start with PK header - file is corrupted!');
      throw new Error('XPI file is corrupted - PK header missing');
    }
    
    console.log('   Configuring Firefox for unsigned extensions...');
    
    // Configure Firefox to allow unsigned extensions
    const platform = process.platform;
    let firefoxPath;
    let prefsPath;
    
    console.log(`   Platform detected: ${platform}`);
    
    if (platform === 'win32') {
      // Windows: Find Firefox installation and preferences
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      
      console.log(`   Checking Program Files: ${programFiles}`);
      console.log(`   Checking Program Files (x86): ${programFiles86}`);
      
      const firefoxPath1 = path.join(programFiles, 'Mozilla Firefox', 'firefox.exe');
      const firefoxPath2 = path.join(programFiles86, 'Mozilla Firefox', 'firefox.exe');
      
      console.log(`   Checking path 1: ${firefoxPath1}`);
      console.log(`   Path 1 exists: ${fs.existsSync(firefoxPath1)}`);
      console.log(`   Checking path 2: ${firefoxPath2}`);
      console.log(`   Path 2 exists: ${fs.existsSync(firefoxPath2)}`);
      
      // Check for Firefox Developer Edition first (better for unsigned extensions)
      const devFirefoxPath1 = path.join(programFiles, 'Firefox Developer Edition', 'firefox.exe');
      const devFirefoxPath2 = path.join(programFiles86, 'Firefox Developer Edition', 'firefox.exe');
      
      console.log(`   Checking Dev Firefox path 1: ${devFirefoxPath1}`);
      console.log(`   Dev Firefox path 1 exists: ${fs.existsSync(devFirefoxPath1)}`);
      console.log(`   Checking Dev Firefox path 2: ${devFirefoxPath2}`);
      console.log(`   Dev Firefox path 2 exists: ${fs.existsSync(devFirefoxPath2)}`);
      
      // Prioritize Developer Edition
      if (fs.existsSync(devFirefoxPath1)) {
        firefoxPath = devFirefoxPath1;
        console.log(`   ✅ Using Firefox Developer Edition: ${firefoxPath}`);
      } else if (fs.existsSync(devFirefoxPath2)) {
        firefoxPath = devFirefoxPath2;
        console.log(`   ✅ Using Firefox Developer Edition: ${firefoxPath}`);
      } else if (fs.existsSync(firefoxPath1)) {
        firefoxPath = firefoxPath1;
        console.log(`   Using regular Firefox: ${firefoxPath}`);
      } else if (fs.existsSync(firefoxPath2)) {
        firefoxPath = firefoxPath2;
        console.log(`   Using regular Firefox: ${firefoxPath}`);
      } else {
        console.log('   ❌ Firefox installation not found');
        
        // Offer to download and install Firefox Developer Edition
        return { 
          message: 'Firefox not found. Firefox Developer Edition is recommended for unsigned extensions.', 
          requiresRestart: false,
          requiresManualAction: true,
          manualInstructions: {
            type: 'firefox_download',
            steps: [
              '1. Firefox Developer Edition is recommended for unsigned extensions',
              '2. Would you like to automatically download and install Firefox Developer Edition?',
              '3. Click "Install Firefox Developer Edition" to proceed',
              '4. Firefox Developer Edition has relaxed signing requirements',
              '5. After installation, run this installer again to install RollCloud extension'
            ],
            downloadUrl: 'https://download.mozilla.org/?product=firefox-devedition-latest-ssl&os=win64&lang=en-US',
            autoInstall: true
          }
        };
      }
      
      // Find Firefox profile directory
      const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming');
      const firefoxProfileDir = path.join(appData, 'Mozilla', 'Firefox', 'Profiles');
      
      if (fs.existsSync(firefoxProfileDir)) {
        const profiles = fs.readdirSync(firefoxProfileDir);
        if (profiles.length > 0) {
          const profilePath = path.join(firefoxProfileDir, profiles[0]);
          prefsPath = path.join(profilePath, 'prefs.js');
          
          // Add preference to allow unsigned extensions
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
              console.log('   ✅ Firefox configured to allow unsigned extensions');
            }
          } catch (prefsError) {
            console.log('   ⚠️ Could not configure Firefox preferences');
          }
        }
      }
      
      // Use explicit firefox.exe command
      const firefoxCommand = `"${firefoxPath}" "${localXpiPath}"`;
      
    } else if (platform === 'darwin') {
      // macOS: Use Firefox application
      firefoxCommand = `open -a Firefox "${localXpiPath}"`;
      
    } else {
      // Linux: Use firefox command
      firefoxCommand = `firefox "${localXpiPath}"`;
    }
    
    try {
      console.log(`   Executing: ${firefoxCommand}`);
      console.log(`   Firefox path: ${firefoxPath}`);
      console.log(`   XPI path: ${localXpiPath}`);
      
      // Instead of trying to install directly, just open Firefox and provide manual instructions
      const openCommand = `"${firefoxPath}"`;
      console.log(`   Opening Firefox with: ${openCommand}`);
      
      const result = execSync(openCommand, { stdio: 'pipe', timeout: 5000 });
      console.log(`   Firefox opened successfully`);
      
      return { 
        message: 'Firefox opened. Please install the extension manually.', 
        requiresRestart: true,
        requiresManualAction: true,
        manualInstructions: {
          type: 'firefox_addon_manual',
          steps: [
            '1. Firefox should now be open',
            '2. Go to about:addons (Ctrl+Shift+A)',
            '3. Click "Install Add-on from File"',
            '4. Navigate to and select the RollCloud XPI file',
            '5. Click "Install" and grant permissions',
            '6. Restart Firefox after installation'
          ],
          xpiPath: localXpiPath
        }
      };
      
    } catch (error) {
      console.log('   Firefox command failed with error:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error signal:', error.signal);
      console.log('   Trying manual installation...');
      
      // Fallback: Manual installation instructions
      return { 
        message: 'Firefox command failed. Please install manually.', 
        requiresRestart: true,
        requiresManualAction: true,
        manualInstructions: {
          type: 'firefox_addon_manual',
          steps: [
            '1. Open Firefox manually',
            '2. Go to about:addons (Ctrl+Shift+A)',
            '3. Click "Install Add-on from File"',
            '4. Navigate to and select the RollCloud XPI file',
            '5. Click "Install" and grant permissions',
            '6. Restart Firefox after installation'
          ],
          xpiPath: localXpiPath
        }
      };
    }
    
  } catch (error) {
    console.error('   Firefox installation error:', error);
    throw new Error(`Failed to prepare Firefox addon installation: ${error.message}`);
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
  isExtensionInstalled
};
