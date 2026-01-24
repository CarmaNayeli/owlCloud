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

/**
 * Check if extension is already installed via policy
 */
async function isExtensionInstalled(browser) {
  const platform = process.platform;
  const browserConfig = BROWSER_CONFIG[browser];

  if (!browserConfig) {
    return false;
  }

  try {
    switch (platform) {
      case 'win32':
        if (browser === 'firefox') {
          // Check Firefox distribution folder
          const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
          const policiesPath = path.join(programFiles, 'Mozilla Firefox', 'distribution', 'policies.json');
          return fs.existsSync(policiesPath);
        }
        // Check registry for Chrome/Edge
        const result = execSync(`reg query "${browserConfig.windows.registryPath}" 2>nul`, { encoding: 'utf-8' });
        return result.includes('rollcloud');
      case 'darwin':
        if (browser === 'firefox') {
          return fs.existsSync(path.join(browserConfig.mac.distributionPath, 'policies.json'));
        }
        return fs.existsSync(browserConfig.mac.plistPath);
      case 'linux':
        if (browser === 'firefox') {
          return fs.existsSync(path.join(browserConfig.linux.distributionPath, 'policies.json'));
        }
        return fs.existsSync(browserConfig.linux.jsonPath);
      default:
        return false;
    }
  } catch {
    return false;
  }
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
