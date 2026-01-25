/**
 * Local Extension Installer
 * Extracts and installs extension ZIP files directly to browser directories
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get browser extension directories based on platform
function getBrowserDirectories() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'win32') {
    return {
      chrome: path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Extensions'),
      edge: path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Extensions'),
      firefox: path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')
    };
  } else if (platform === 'darwin') {
    return {
      chrome: path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Extensions'),
      firefox: path.join(homeDir, 'Library', 'Application Support', 'Firefox', 'Profiles')
    };
  } else {
    return {
      chrome: path.join(homeDir, '.config', 'google-chrome', 'Default', 'Extensions'),
      firefox: path.join(homeDir, '.mozilla', 'firefox')
    };
  }
}

// Find Firefox profile directory
function findFirefoxProfile(firefoxBaseDir) {
  try {
    const profiles = fs.readdirSync(firefoxBaseDir);
    for (const profile of profiles) {
      const profilePath = path.join(firefoxBaseDir, profile);
      const stats = fs.statSync(profilePath);
      if (stats.isDirectory() && (profile.includes('default') || profile.includes('release'))) {
        return profilePath;
      }
    }
    // Fallback to first directory
    const firstDir = profiles.find(p => fs.statSync(path.join(firefoxBaseDir, p)).isDirectory());
    return firstDir ? path.join(firefoxBaseDir, firstDir) : null;
  } catch (error) {
    console.error('Error finding Firefox profile:', error);
    return null;
  }
}

// Generate a random extension ID for Chrome
function generateExtensionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Extract ZIP file to target directory
async function extractZip(zipPath, targetDir) {
  try {
    // Create target directory if it doesn't exist
    fs.mkdirSync(targetDir, { recursive: true });
    
    // Use platform-appropriate extraction
    const platform = os.platform();
    if (platform === 'win32') {
      await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
    } else if (platform === 'darwin') {
      await execAsync(`unzip -o '${zipPath}' -d '${targetDir}'`);
    } else {
      await execAsync(`unzip -o '${zipPath}' -d '${targetDir}'`);
    }
    
    return true;
  } catch (error) {
    console.error('Error extracting ZIP:', error);
    return false;
  }
}

// Install Chrome extension
async function installChromeExtension(zipPath) {
  const dirs = getBrowserDirectories();
  const chromeExtDir = dirs.chrome;
  
  try {
    // Create Chrome extensions directory if it doesn't exist
    fs.mkdirSync(chromeExtDir, { recursive: true });
    
    // Generate extension ID and create directory
    const extensionId = generateExtensionId();
    const targetDir = path.join(chromeExtDir, extensionId);
    
    // Extract ZIP to extension directory
    const success = await extractZip(zipPath, targetDir);
    
    if (success) {
      console.log(`Chrome extension installed to: ${targetDir}`);
      return { success: true, extensionId, path: targetDir };
    } else {
      return { success: false, error: 'Failed to extract Chrome extension' };
    }
  } catch (error) {
    console.error('Error installing Chrome extension:', error);
    return { success: false, error: error.message };
  }
}

// Install Firefox extension
async function installFirefoxExtension(zipPath) {
  const dirs = getBrowserDirectories();
  const firefoxBaseDir = dirs.firefox;
  
  try {
    // Find Firefox profile
    const profileDir = findFirefoxProfile(firefoxBaseDir);
    if (!profileDir) {
      return { success: false, error: 'Firefox profile not found' };
    }
    
    // Create extensions directory in profile
    const extensionsDir = path.join(profileDir, 'extensions');
    fs.mkdirSync(extensionsDir, { recursive: true });
    
    // For Firefox, we need to extract to a temporary location then move
    const tempDir = path.join(os.tmpdir(), 'firefox-extension-' + Date.now());
    const success = await extractZip(zipPath, tempDir);
    
    if (success) {
      // Read manifest to get extension ID
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const extensionId = manifest.browser_specific_settings?.gecko?.id;
        
        if (extensionId) {
          const targetDir = path.join(extensionsDir, extensionId);
          // Move extracted files to final location
          fs.renameSync(tempDir, targetDir);
          console.log(`Firefox extension installed to: ${targetDir}`);
          return { success: true, extensionId, path: targetDir };
        }
      }
      
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { success: false, error: 'Extension ID not found in manifest' };
    } else {
      return { success: false, error: 'Failed to extract Firefox extension' };
    }
  } catch (error) {
    console.error('Error installing Firefox extension:', error);
    return { success: false, error: error.message };
  }
}

// Main installation function
async function installExtensions() {
  const resourcesPath = process.resourcesPath || path.join(__dirname, '../resources');
  const extensionDir = path.join(resourcesPath, 'extension');
  
  const chromeZip = path.join(extensionDir, 'rollcloud-chrome.zip');
  const firefoxZip = path.join(extensionDir, 'rollcloud-firefox.zip');
  
  const results = {
    chrome: { success: false, error: null },
    firefox: { success: false, error: null }
  };
  
  // Install Chrome extension
  if (fs.existsSync(chromeZip)) {
    results.chrome = await installChromeExtension(chromeZip);
  } else {
    results.chrome.error = 'Chrome extension ZIP not found';
  }
  
  // Install Firefox extension
  if (fs.existsSync(firefoxZip)) {
    results.firefox = await installFirefoxExtension(firefoxZip);
  } else {
    results.firefox.error = 'Firefox extension ZIP not found';
  }
  
  return results;
}

module.exports = {
  installExtensions,
  installChromeExtension,
  installFirefoxExtension,
  getBrowserDirectories
};
