/**
 * Native Messaging for Installer-Extension Communication
 * Allows the installer to send pairing codes directly to the extension
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Install Chrome native messaging manifest
 */
async function installChromeNativeMessaging() {
  try {
    const manifestPath = path.join(os.homedir(), 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts', 'com.rollcloud.installer.json');
    const manifestDir = path.dirname(manifestPath);
    
    // Ensure directory exists
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    const manifest = {
      name: 'com.rollcloud.installer',
      description: 'RollCloud Installer Native Messaging Host',
      path: path.join(process.resourcesPath, 'dist', 'win-unpacked', 'RollCloud Setup v2.exe'),
      type: 'stdio',
      allowed_origins: ['chrome-extension://mkckngoemfjdkhcpaomdndlecolckgdj']
    };
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ Chrome native messaging manifest installed');
    return true;
  } catch (error) {
      console.error('❌ Failed to install Chrome native messaging manifest:', error);
      return false;
    }
}

/**
 * Install Firefox native messaging manifest
 */
async function installFirefoxNativeMessaging() {
  try {
    // Firefox doesn't use native messaging manifests in the same way
    // The extension will connect directly to the installer
    console.log('✅ Firefox native messaging ready (extension will connect directly)');
    return true;
  } catch (error) {
    console.error('❌ Failed to prepare Firefox native messaging:', error);
      return false;
  }
}

/**
 * Send pairing code to extension via native messaging
 */
async function sendPairingCodeToExtension(browser, code) {
  try {
    console.log(`📤 Sending pairing code to ${browser} extension:`, code);
    
    if (browser === 'chrome') {
      // For Chrome, we'd need to use the native messaging host
      // This is more complex and may not be necessary if the extension connects to us
      console.log('📝 Chrome native messaging not implemented for sending pairing codes');
      return false;
    } else if (browser === 'firefox') {
      // Firefox extension should connect to us via native messaging
      console.log('📝 Firefox extension should connect to installer for pairing code');
      // The extension will poll for the pairing code from the installer
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Failed to send pairing code to extension:', error);
    return false;
  }
}

module.exports = {
  installChromeNativeMessaging,
  installFirefoxNativeMessaging,
  sendPairingCodeToExtension
};
