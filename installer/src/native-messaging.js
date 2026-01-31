/**
 * Native Messaging for Installer-Extension Communication
 *
 * Architecture:
 * - The browser extension connects to a native messaging host
 * - The host is a separate process spawned by the browser
 * - The installer communicates with the host via a shared file
 *
 * Flow:
 * 1. Installer generates pairing code and writes to shared file
 * 2. Extension connects to native messaging host
 * 3. Extension requests pairing code from host
 * 4. Host reads from shared file and responds
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const electron = require('electron');

// Shared file location for IPC between installer and native host
const PAIRING_FILE_NAME = 'owlcloud-pairing.json';

/**
 * Get the path to the shared pairing file
 */
function getPairingFilePath() {
  // Use app data folder for shared file
  const appDataPath = electron.app.getPath('userData');
  return path.join(appDataPath, PAIRING_FILE_NAME);
}

/**
 * Get the path where the native host script should be installed
 */
function getNativeHostPath() {
  if (process.platform === 'win32') {
    // On Windows, use a batch file that runs the JS host
    return path.join(electron.app.getPath('userData'), 'native-host', 'owlcloud_host.bat');
  } else {
    // On Mac/Linux, use the JS file directly
    return path.join(electron.app.getPath('userData'), 'native-host', 'owlcloud_host.js');
  }
}

/**
 * Get the native messaging manifest directory for each browser
 */
function getNativeMessagingManifestPath(browser) {
  const home = os.homedir();

  if (process.platform === 'win32') {
    // Windows uses registry, but we can also use manifest files
    if (browser === 'chrome') {
      return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
    } else if (browser === 'firefox') {
      return path.join(home, 'AppData', 'Roaming', 'Mozilla', 'NativeMessagingHosts');
    }
  } else if (process.platform === 'darwin') {
    // macOS
    if (browser === 'chrome') {
      return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
    } else if (browser === 'firefox') {
      return path.join(home, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts');
    }
  } else {
    // Linux
    if (browser === 'chrome') {
      return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts');
    } else if (browser === 'firefox') {
      return path.join(home, '.mozilla', 'native-messaging-hosts');
    }
  }

  return null;
}

/**
 * Install the native messaging host script
 */
async function installNativeHost() {
  try {
    const hostDir = path.dirname(getNativeHostPath());

    // Create host directory
    if (!fs.existsSync(hostDir)) {
      fs.mkdirSync(hostDir, { recursive: true });
    }

    // Read the host script template
    const sourceHostPath = path.join(__dirname, '..', 'native-messaging', 'owlcloud_installer_host.js');
    let hostScript = fs.readFileSync(sourceHostPath, 'utf8');

    // Inject the pairing file path into the host script
    const pairingFilePath = getPairingFilePath();
    hostScript = hostScript.replace(
      "let currentPairingCode = null;",
      `let currentPairingCode = null;\nconst PAIRING_FILE = ${JSON.stringify(pairingFilePath)};`
    );

    // Add file-reading logic to the host script
    const fileReadLogic = `
// Read pairing code from shared file (set by installer)
function readPairingFromFile() {
  try {
    if (fs.existsSync(PAIRING_FILE)) {
      const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
      if (data.code && data.timestamp) {
        // Check if code is less than 10 minutes old
        const age = Date.now() - data.timestamp;
        if (age < 10 * 60 * 1000) {
          return { code: data.code, username: data.username };
        }
      }
    }
  } catch (e) {
    log('Error reading pairing file: ' + e.message);
  }
  return null;
}
`;

    // Insert file reading logic after log function
    hostScript = hostScript.replace(
      "log('Native messaging host started');",
      fileReadLogic + "\nlog('Native messaging host started');"
    );

    // Modify getPairingCode handler to read from file
    hostScript = hostScript.replace(
      `case 'getPairingCode':
      // Extension requesting the current pairing code
      sendMessage({
        type: 'pairingCode',
        code: currentPairingCode,
        username: pairingUsername,
        status: currentPairingCode ? 'ready' : 'none'
      });
      break;`,
      `case 'getPairingCode':
      // Extension requesting the current pairing code
      // First check file, then fall back to in-memory
      const fileData = readPairingFromFile();
      const code = fileData?.code || currentPairingCode;
      const username = fileData?.username || pairingUsername;
      sendMessage({
        type: 'pairingCode',
        code: code,
        username: username,
        status: code ? 'ready' : 'none'
      });
      break;`
    );

    // Write the host script
    const destHostPath = getNativeHostPath();

    if (process.platform === 'win32') {
      // On Windows, write the JS file and a batch wrapper
      const jsPath = destHostPath.replace('.bat', '.js');
      fs.writeFileSync(jsPath, hostScript, 'utf8');

      // Create batch wrapper
      const batchContent = `@echo off\nnode "${jsPath}" %*`;
      fs.writeFileSync(destHostPath, batchContent, 'utf8');
    } else {
      // On Mac/Linux, write JS file with shebang and make executable
      fs.writeFileSync(destHostPath, hostScript, { mode: 0o755 });
    }

    console.log('✅ Native messaging host installed at:', destHostPath);
    return true;
  } catch (error) {
    console.error('❌ Failed to install native host:', error);
    return false;
  }
}

/**
 * Install Chrome native messaging manifest
 */
async function installChromeNativeMessaging() {
  try {
    // First install the host script
    await installNativeHost();

    const manifestDir = getNativeMessagingManifestPath('chrome');
    if (!manifestDir) {
      console.error('❌ Could not determine Chrome manifest path for this platform');
      return false;
    }

    // Ensure directory exists
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }

    const hostPath = getNativeHostPath();

    const manifest = {
      name: 'com.owlcloud.installer',
      description: 'OwlCloud Installer Native Messaging Host',
      path: hostPath,
      type: 'stdio',
      allowed_origins: ['chrome-extension://mkckngoemfjdkhcpaomdndlecolckgdj/']
    };

    const manifestPath = path.join(manifestDir, 'com.owlcloud.installer.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // On Windows, also register in registry
    if (process.platform === 'win32') {
      await registerWindowsNativeHost('chrome', manifestPath);
    }

    console.log('✅ Chrome native messaging manifest installed at:', manifestPath);
    return true;
  } catch (error) {
    console.error('❌ Failed to install Chrome native messaging:', error);
    return false;
  }
}

/**
 * Install Firefox native messaging manifest
 */
async function installFirefoxNativeMessaging() {
  try {
    // First install the host script
    await installNativeHost();

    const manifestDir = getNativeMessagingManifestPath('firefox');
    if (!manifestDir) {
      console.error('❌ Could not determine Firefox manifest path for this platform');
      return false;
    }

    // Ensure directory exists
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }

    const hostPath = getNativeHostPath();

    const manifest = {
      name: 'com.owlcloud.installer',
      description: 'OwlCloud Installer Native Messaging Host',
      path: hostPath,
      type: 'stdio',
      allowed_extensions: ['owlcloud@dicecat.dev']
    };

    const manifestPath = path.join(manifestDir, 'com.owlcloud.installer.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('✅ Firefox native messaging manifest installed at:', manifestPath);
    return true;
  } catch (error) {
    console.error('❌ Failed to install Firefox native messaging:', error);
    return false;
  }
}

/**
 * Register native messaging host in Windows registry
 */
async function registerWindowsNativeHost(browser, manifestPath) {
  if (process.platform !== 'win32') return;

  try {
    const { execSync } = require('child_process');

    let regPath;
    if (browser === 'chrome') {
      regPath = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.owlcloud.installer';
    } else if (browser === 'firefox') {
      regPath = 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.owlcloud.installer';
    } else {
      return;
    }

    // Add registry key pointing to manifest
    execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'ignore' });
    console.log(`✅ Registered native host in Windows registry for ${browser}`);
  } catch (error) {
    console.warn(`⚠️ Could not register in Windows registry (may require admin): ${error.message}`);
  }
}

/**
 * Write pairing code to shared file for native host to read
 */
function writePairingCodeToFile(code, username = null) {
  try {
    const pairingFilePath = getPairingFilePath();
    const pairingDir = path.dirname(pairingFilePath);

    if (!fs.existsSync(pairingDir)) {
      fs.mkdirSync(pairingDir, { recursive: true });
    }

    const data = {
      code: code,
      username: username,
      timestamp: Date.now()
    };

    fs.writeFileSync(pairingFilePath, JSON.stringify(data, null, 2));
    console.log('📝 Pairing code written to file:', pairingFilePath);
    return true;
  } catch (error) {
    console.error('❌ Failed to write pairing code to file:', error);
    return false;
  }
}

/**
 * Clear the pairing code file
 */
function clearPairingCodeFile() {
  try {
    const pairingFilePath = getPairingFilePath();
    if (fs.existsSync(pairingFilePath)) {
      fs.unlinkSync(pairingFilePath);
      console.log('🗑️ Pairing code file cleared');
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to clear pairing code file:', error);
    return false;
  }
}

/**
 * Send pairing code to extension via native messaging
 * This writes to a shared file that the native host reads
 */
async function sendPairingCodeToExtension(browser, code, username = null) {
  try {
    console.log(`📤 Setting pairing code for ${browser} extension:`, code);

    // Write pairing code to shared file
    const success = writePairingCodeToFile(code, username);

    if (success) {
      console.log('✅ Pairing code ready for extension to retrieve via native messaging');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to send pairing code to extension:', error);
    return false;
  }
}

/**
 * Uninstall native messaging (for cleanup)
 */
async function uninstallNativeMessaging(browser) {
  try {
    const manifestDir = getNativeMessagingManifestPath(browser);
    if (manifestDir) {
      const manifestPath = path.join(manifestDir, 'com.owlcloud.installer.json');
      if (fs.existsSync(manifestPath)) {
        fs.unlinkSync(manifestPath);
        console.log(`✅ Removed ${browser} native messaging manifest`);
      }
    }

    // Clear pairing file
    clearPairingCodeFile();

    return true;
  } catch (error) {
    console.error(`❌ Failed to uninstall ${browser} native messaging:`, error);
    return false;
  }
}

module.exports = {
  installChromeNativeMessaging,
  installFirefoxNativeMessaging,
  sendPairingCodeToExtension,
  writePairingCodeToFile,
  clearPairingCodeFile,
  uninstallNativeMessaging,
  getNativeHostPath,
  getPairingFilePath
};
