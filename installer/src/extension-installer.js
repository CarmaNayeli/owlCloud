/**
 * Extension Installer Module
 * Handles enterprise policy installation for Chrome/Firefox/Edge on Windows/macOS/Linux
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
  edge: {
    name: 'Microsoft Edge',
    windows: {
      registryPath: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist',
      registryPath32on64: 'HKLM\\SOFTWARE\\WOW6432Node\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist'
    },
    mac: {
      plistPath: '/Library/Managed Preferences/com.microsoft.Edge.plist',
      plistKey: 'ExtensionInstallForcelist'
    },
    linux: {
      jsonPath: '/etc/opt/edge/policies/managed/rollcloud.json',
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

  // Chrome/Edge use similar policy mechanisms
  const browserConfig = BROWSER_CONFIG[browser];
  if (!browserConfig) {
    throw new Error(`Unsupported browser: ${browser}`);
  }

  const policyValue = `${config.extensionId};${config.updateManifestUrl}`;

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
 * Windows: Write registry key for Chrome/Edge
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
 * macOS: Write plist file for Chrome/Edge
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
 * Linux: Write JSON policy file for Chrome/Edge
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
 * Firefox: Use distribution folder method
 */
async function installFirefoxExtension(config) {
  const platform = process.platform;
  let distributionPath;

  switch (platform) {
    case 'win32':
      // Find Firefox installation
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      if (fs.existsSync(path.join(programFiles, 'Mozilla Firefox'))) {
        distributionPath = path.join(programFiles, 'Mozilla Firefox', 'distribution');
      } else if (fs.existsSync(path.join(programFiles86, 'Mozilla Firefox'))) {
        distributionPath = path.join(programFiles86, 'Mozilla Firefox', 'distribution');
      } else {
        throw new Error('Firefox installation not found');
      }
      break;
    case 'darwin':
      distributionPath = BROWSER_CONFIG.firefox.mac.distributionPath;
      break;
    case 'linux':
      distributionPath = BROWSER_CONFIG.firefox.linux.distributionPath;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  // Create policies.json for Firefox
  const policiesPath = path.join(distributionPath, 'policies.json');
  const extensionsDir = path.join(distributionPath, 'extensions');

  let policies = { policies: {} };
  if (fs.existsSync(policiesPath)) {
    try {
      policies = JSON.parse(fs.readFileSync(policiesPath, 'utf-8'));
    } catch {
      // Invalid JSON, start fresh
    }
  }

  // Add extension install policy
  if (!policies.policies.ExtensionSettings) {
    policies.policies.ExtensionSettings = {};
  }

  policies.policies.ExtensionSettings[config.extensionId] = {
    installation_mode: 'force_installed',
    install_url: config.updateManifestUrl.replace('update_manifest.xml', 'rollcloud-firefox.xpi')
  };

  // Write policies
  const tempFile = path.join(os.tmpdir(), 'firefox-policies.json');
  fs.writeFileSync(tempFile, JSON.stringify(policies, null, 2));

  const commands = [
    `mkdir -p "${distributionPath}"`,
    `cp "${tempFile}" "${policiesPath}"`,
    `rm "${tempFile}"`
  ].join(' && ');

  return new Promise((resolve, reject) => {
    const sudo = require('sudo-prompt');
    const options = { name: 'RollCloud Setup' };

    sudo.exec(commands, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to install Firefox extension: ${error.message}`));
      } else {
        resolve({ message: 'Firefox extension policy installed', requiresRestart: true });
      }
    });
  });
}

// Extension IDs for different browsers
const EXTENSION_IDS = {
  chrome: null, // Will be read from keys/public.der or generated
  edge: null,   // Same as Chrome (Chromium-based)
  firefox: 'rollcloud@dicecat.dev'
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

    case 'edge':
      if (platform === 'win32') {
        dirs.push(path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'));
      } else if (platform === 'darwin') {
        dirs.push(path.join(home, 'Library', 'Application Support', 'Microsoft Edge'));
      } else {
        dirs.push(path.join(home, '.config', 'microsoft-edge'));
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
      // Chrome/Edge store extensions in Default/Extensions/<extension_id>/
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

    // Chrome/Edge use registry on Windows, plist on macOS, JSON on Linux
    if (platform === 'win32') {
      const registryPath = browserConfig.windows.registryPath;
      try {
        const result = execSync(`reg query "${registryPath}" 2>nul`, { encoding: 'utf8' });
        // Forcelist entries are strings like "extensionId;updateUrl"
        const extensionId = getChromeExtensionId();
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
          const extensionId = getChromeExtensionId();
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
          const extensionId = getChromeExtensionId();
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
    : getChromeExtensionId();

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
