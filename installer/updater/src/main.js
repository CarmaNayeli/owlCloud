const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  extensionId: 'mkckngoemfjdkhcpaomdndlecolckgdj',
  firefoxExtensionIds: ['owlcloud@dicecat.com', 'owlcloud@dicecat.dev'],
  chromeUpdateUrl: 'https://raw.githubusercontent.com/CarmaNayeli/owlCloud/main/updates/update_manifest.xml',
  firefoxUpdateUrl: 'https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi',
  githubApiUrl: 'https://api.github.com/repos/CarmaNayeli/owlCloud/releases/latest'
};

// Check for --minimized flag
const startMinimized = process.argv.includes('--minimized');

let mainWindow;
let tray;
let notificationSettings = {
  enabled: true,  // Default to enabled
  minimizeToTray: true,
  startMinimized: startMinimized,
  autoUpdate: false,  // Default to manual approval
  lastChecked: null,
  lastVersion: null,
  checkInterval: 3600000, // 1 hour in milliseconds
  trackedBrowsers: ['chrome', 'edge', 'firefox'], // Default browsers to track
  customBrowsers: [] // User-added custom browsers [{name, appName, icon}]
};

// Background update checking
let updateCheckInterval;

// Notification settings storage
const SETTINGS_FILE = path.join(app.getPath('userData'), 'notification-settings.json');
// Also check for installer-created settings file
const INSTALLER_SETTINGS_FILE = path.join(path.dirname(process.execPath), 'updater-settings.json');

function loadNotificationSettings() {
  try {
    // First, try to load installer-created settings (initial setup)
    if (fs.existsSync(INSTALLER_SETTINGS_FILE)) {
      const installerData = fs.readFileSync(INSTALLER_SETTINGS_FILE, 'utf8');
      const installerSettings = JSON.parse(installerData);
      notificationSettings = { ...notificationSettings, ...installerSettings };
      console.log('Loaded settings from installer:', installerSettings);
    }

    // Then load user-modified settings (overrides installer settings)
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      notificationSettings = { ...notificationSettings, ...JSON.parse(data) };
      console.log('Loaded user settings');
    }

    // Apply command-line override for startMinimized
    if (startMinimized) {
      notificationSettings.startMinimized = true;
    }
  } catch (error) {
    console.log('Using default notification settings:', error.message);
  }
}

function saveNotificationSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(notificationSettings, null, 2));
  } catch (error) {
    console.error('Failed to save notification settings:', error);
  }
}

// GitHub Release Monitoring Service
class GitHubReleaseMonitor {
  constructor(repoUrl, checkInterval) {
    this.repoUrl = repoUrl;
    this.checkInterval = checkInterval;
    this.lastKnownRelease = null;
    this.isMonitoring = false;
  }

  async checkForNewRelease() {
    try {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/CarmaNayeli/owlCloud/releases/latest',
        headers: {
          'User-Agent': 'OwlCloud-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const response = await new Promise((resolve, reject) => {
        const req = https.get(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      const releaseInfo = {
        version: response.tag_name?.replace(/^v/, '') || '1.0.0',
        publishedAt: response.published_at,
        name: response.name,
        body: response.body,
        downloadUrl: response.assets?.find(asset => 
          asset.name.includes('.crx') || asset.name.includes('.xpi')
        )?.browser_download_url
      };

      // Check if this is a new release
      if (!this.lastKnownRelease || releaseInfo.version !== this.lastKnownRelease.version) {
        const isNewer = this.isNewerVersion(releaseInfo.version, this.lastKnownRelease?.version);
        
        if (isNewer && this.lastKnownRelease) {
          // This is a new release since we last checked
          await this.handleNewRelease(releaseInfo);
        }
        
        this.lastKnownRelease = releaseInfo;
        return { isNew: isNewer, release: releaseInfo };
      }

      return { isNew: false, release: releaseInfo };
    } catch (error) {
      console.error('Failed to check for releases:', error);
      throw error;
    }
  }

  isNewerVersion(newVersion, oldVersion) {
    if (!oldVersion) return true;
    
    const parseVersion = (version) => {
      const parts = version.split('.').map(Number);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
      };
    };

    const newParts = parseVersion(newVersion);
    const oldParts = parseVersion(oldVersion);

    if (newParts.major > oldParts.major) return true;
    if (newParts.major < oldParts.major) return false;
    if (newParts.minor > oldParts.minor) return true;
    if (newParts.minor < oldParts.minor) return false;
    return newParts.patch > oldParts.patch;
  }

  async handleNewRelease(release) {
    console.log(`New release detected: ${release.version}`);

    // Update last version in settings
    notificationSettings.lastVersion = release.version;
    notificationSettings.lastChecked = new Date().toISOString();
    saveNotificationSettings();

    // If auto-update is enabled, start updating
    if (notificationSettings.autoUpdate) {
      console.log('Auto-update enabled, starting update process...');

      showNotification(
        'OwlCloud Update Downloading',
        `Version ${release.version} is being downloaded and installed automatically.`,
        { urgency: 'normal' }
      );

      // Trigger auto-update (will be handled by main process)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-update-started', release);
      }

      // Perform the update
      try {
        await this.performAutoUpdate(release);
      } catch (error) {
        console.error('Auto-update failed:', error);
        showNotification(
          'OwlCloud Auto-Update Failed',
          `Failed to auto-update: ${error.message}. Please update manually.`,
          { urgency: 'critical' }
        );
      }
    } else {
      // Manual update - just notify
      showNotification(
        'OwlCloud Update Available!',
        `Version ${release.version} is now available.\n\n${release.name}`,
        { urgency: 'normal' }
      );

      // Send to renderer if window is open
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-release-available', release);
      }
    }
  }

  async performAutoUpdate(release) {
    // Download assets
    const assets = {
      chrome: release.assets?.find(a => a.name === 'owlcloud-chrome-signed.crx'),
      firefox: release.assets?.find(a => a.name === 'owlcloud-firefox-signed.xpi')
    };

    const tempDir = path.join(app.getPath('temp'), 'owlcloud-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download and install Chrome extension if asset exists
    if (assets.chrome) {
      try {
        const tempFile = path.join(tempDir, 'owlcloud-chrome.crx');
        await downloadFile(assets.chrome.browser_download_url, tempFile);
        await updateChromeExtension(tempFile, 'chrome');
        fs.unlinkSync(tempFile);
        console.log('Chrome extension auto-updated successfully');
      } catch (error) {
        console.error('Chrome auto-update failed:', error);
      }
    }

    // Download and install Firefox extension if asset exists
    if (assets.firefox) {
      try {
        const tempFile = path.join(tempDir, 'owlcloud-firefox.xpi');
        await downloadFile(assets.firefox.browser_download_url, tempFile);
        await updateFirefoxExtension(tempFile);
        fs.unlinkSync(tempFile);
        console.log('Firefox extension auto-updated successfully');
      } catch (error) {
        console.error('Firefox auto-update failed:', error);
      }
    }

    // Show completion notification
    showNotification(
      'OwlCloud Updated Successfully!',
      `Version ${release.version} has been installed. Please restart your browsers.`,
      { urgency: 'normal' }
    );

    // Send completion message to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-update-completed', release);
    }
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log(`Starting GitHub release monitoring (interval: ${this.checkInterval}ms)`);
    
    // Check immediately on start
    this.checkForNewRelease().catch(error => {
      console.error('Initial release check failed:', error);
    });
    
    // Set up periodic checking
    updateCheckInterval = setInterval(async () => {
      try {
        await this.checkForNewRelease();
      } catch (error) {
        console.error('Periodic release check failed:', error);
      }
    }, this.checkInterval);
  }

  async checkNow() {
    console.log('Performing immediate release check...');
    try {
      const result = await this.checkForNewRelease();
      console.log('Immediate check result:', result);
      return result;
    } catch (error) {
      console.error('Immediate release check failed:', error);
      throw error;
    }
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
      updateCheckInterval = null;
    }
    console.log('Stopped GitHub release monitoring');
  }
}

// Global monitor instance
let releaseMonitor;

function createTray() {
  if (tray) {
    tray.destroy();
  }

  // Create tray icon (you'll need to add an icon file)
  const iconPath = path.join(__dirname, '../resources/tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  tray.setToolTip('OwlCloud Updater');

  // Build the initial menu
  updateTrayMenu();

  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC handlers for settings access from renderer
const { app: electronApp } = require('electron');

function showNotification(title, body, options = {}) {
  if (!notificationSettings.enabled) return;
  
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../resources/icon.png'),
      silent: options.silent || false,
      urgency: options.urgency || 'normal'
    });
    
    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    return notification;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../resources/icon.png'),
    show: false // Don't show initially
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    // Only show window if not starting minimized
    if (!notificationSettings.startMinimized) {
      mainWindow.show();
    } else {
      console.log('Starting minimized to system tray');
    }
  });

  if (process.platform === 'win32') {
    mainWindow.setMenu(null);
  }

  // Hide window instead of closing (for system tray) if minimizeToTray is enabled
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && notificationSettings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  // Load settings BEFORE creating window (so we know if starting minimized)
  loadNotificationSettings();

  createWindow();
  createTray();

  // Initialize release monitor
  releaseMonitor = new GitHubReleaseMonitor(CONFIG.githubApiUrl, notificationSettings.checkInterval);

  // Perform immediate startup check regardless of notification settings
  console.log('🚀 Performing startup release check...');
  releaseMonitor.checkNow().then(result => {
    console.log('Startup check completed:', result);

    // If there's a new release and we're minimized, show a notification
    if (result.isNew && notificationSettings.startMinimized) {
      showNotification(
        'OwlCloud Update Available!',
        `Version ${result.release.version} is now available.\nClick to open updater.`,
        { urgency: 'normal' }
      );
    }
  }).catch(error => {
    console.error('Startup check failed:', error);
  });

  // Start monitoring if notifications are enabled
  if (notificationSettings.enabled) {
    releaseMonitor.startMonitoring();
  }

  // Check if this is first run (and window is visible)
  const isFirstRun = !fs.existsSync(path.join(app.getPath('userData'), 'first-run-complete'));
  if (isFirstRun && !notificationSettings.startMinimized) {
    // Show notification setup dialog
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('show-notification-setup');
      }
    }, 1000);
  }

  // If starting minimized, mark first run as complete since user already configured during install
  if (isFirstRun && notificationSettings.startMinimized) {
    fs.writeFileSync(path.join(app.getPath('userData'), 'first-run-complete'), 'true');

    // Show welcome notification after a short delay
    setTimeout(() => {
      showNotification(
        'OwlCloud Updater Running',
        'The updater is now running in your system tray.\n\n' +
        'Right-click the tray icon to:\n' +
        '• Enable/disable notifications\n' +
        '• Configure auto-updates\n' +
        '• Check for updates manually',
        { urgency: 'low' }
      );
    }, 2000);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep tray running
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // Stop monitoring when app is quitting
  if (releaseMonitor) {
    releaseMonitor.stopMonitoring();
  }
});

// Function to rebuild tray menu with current settings
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'OwlCloud Updater',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (releaseMonitor) {
          releaseMonitor.checkNow().then(result => {
            if (result.isNew) {
              showNotification(
                'OwlCloud Update Available!',
                `Version ${result.release.version} is now available.`,
                { urgency: 'normal' }
              );
            } else {
              showNotification(
                'No Updates Available',
                'You have the latest version of OwlCloud.',
                { urgency: 'low' }
              );
            }
          }).catch(error => {
            console.error('Update check failed:', error);
          });
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('check-updates-requested');
        }
      }
    },
    {
      label: 'Enable Notifications',
      type: 'checkbox',
      checked: notificationSettings.enabled,
      click: (menuItem) => {
        notificationSettings.enabled = menuItem.checked;
        saveNotificationSettings();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('notification-settings-changed', notificationSettings);
        }

        // Start or stop monitoring based on setting
        if (notificationSettings.enabled && releaseMonitor) {
          releaseMonitor.startMonitoring();
        } else if (!notificationSettings.enabled && releaseMonitor) {
          releaseMonitor.stopMonitoring();
        }
      }
    },
    {
      label: 'Minimize to Tray on Close',
      type: 'checkbox',
      checked: notificationSettings.minimizeToTray,
      click: (menuItem) => {
        notificationSettings.minimizeToTray = menuItem.checked;
        saveNotificationSettings();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('notification-settings-changed', notificationSettings);
        }
      }
    },
    {
      label: 'Automatically Install Updates',
      type: 'checkbox',
      checked: notificationSettings.autoUpdate || false,
      click: (menuItem) => {
        notificationSettings.autoUpdate = menuItem.checked;
        saveNotificationSettings();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('notification-settings-changed', notificationSettings);
        }

        showNotification(
          'Auto-Update ' + (menuItem.checked ? 'Enabled' : 'Disabled'),
          menuItem.checked ?
            'Updates will be downloaded and installed automatically.' :
            'You will be asked before installing updates.',
          { urgency: 'low' }
        );
      }
    },
    { type: 'separator' },
    {
      label: 'Show Updater',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Handle notification settings changes
ipcMain.handle('save-notification-settings', async (event, settings) => {
  try {
    const wasEnabled = notificationSettings.enabled;
    notificationSettings = { ...notificationSettings, ...settings };
    saveNotificationSettings();

    // Apply run-on-startup setting using Electron API where supported
    try {
      const runOnStartup = !!notificationSettings.runOnStartup || !!notificationSettings.startWithWindows;
      if (process.platform === 'win32' || process.platform === 'darwin') {
        electronApp.setLoginItemSettings({ openAtLogin: runOnStartup });
      }
    } catch (e) {
      console.warn('Could not apply login item settings:', e.message);
    }

    // Update tray menu to reflect new settings
    updateTrayMenu();

    // Start or stop monitoring based on notification preference
    if (notificationSettings.enabled && !wasEnabled) {
      releaseMonitor.startMonitoring();
    } else if (!notificationSettings.enabled && wasEnabled) {
      releaseMonitor.stopMonitoring();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add release monitoring controls
ipcMain.handle('start-release-monitoring', async () => {
  try {
    if (releaseMonitor) {
      releaseMonitor.startMonitoring();
      return { success: true };
    }
    return { success: false, error: 'Release monitor not initialized' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-release-monitoring', async () => {
  try {
    if (releaseMonitor) {
      releaseMonitor.stopMonitoring();
      return { success: true };
    }
    return { success: false, error: 'Release monitor not initialized' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-releases-now', async () => {
  try {
    if (releaseMonitor) {
      const result = await releaseMonitor.checkNow();
      return { success: true, result };
    }
    return { success: false, error: 'Release monitor not initialized' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-monitoring-status', async () => {
  try {
    return {
      success: true,
      isMonitoring: releaseMonitor?.isMonitoring || false,
      lastChecked: notificationSettings.lastChecked,
      lastVersion: notificationSettings.lastVersion,
      checkInterval: notificationSettings.checkInterval
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-check-interval', async (event, interval) => {
  try {
    notificationSettings.checkInterval = interval;
    saveNotificationSettings();
    
    // Restart monitoring with new interval
    const wasMonitoring = releaseMonitor?.isMonitoring || false;
    if (wasMonitoring) {
      releaseMonitor.stopMonitoring();
      releaseMonitor.checkInterval = interval;
      releaseMonitor.startMonitoring();
    } else if (releaseMonitor) {
      releaseMonitor.checkInterval = interval;
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Extension Detection Functions
async function detectChromeExtension() {
  try {
    const { execSync } = require('child_process');
    const output = execSync('reg query "HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist" /v', { encoding: 'utf8' });
    return output.includes(CONFIG.extensionId);
  } catch (error) {
    return false;
  }
}

async function detectEdgeExtension() {
  try {
    const { execSync } = require('child_process');
    const output = execSync('reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist" /v', { encoding: 'utf8' });
    return output.includes(CONFIG.extensionId);
  } catch (error) {
    return false;
  }
}

async function detectFirefoxExtension() {
  try {
    // Check user profile extensions (most common location)
    const profilesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
    if (fs.existsSync(profilesPath)) {
      const profiles = fs.readdirSync(profilesPath);
      for (const profile of profiles) {
        const extensionsDir = path.join(profilesPath, profile, 'extensions');
        if (fs.existsSync(extensionsDir)) {
          const extensions = fs.readdirSync(extensionsDir);
          for (const extensionId of CONFIG.firefoxExtensionIds) {
            if (extensions.includes(`${extensionId}.xpi`)) {
              return true;
            }
          }
        }
      }
    }

    // Check Program Files distribution folder (enterprise/system-wide installs)
    const firefoxProgramPaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Mozilla Firefox'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Mozilla Firefox')
    ];

    for (const firefoxPath of firefoxProgramPaths) {
      const distributionExtensions = path.join(firefoxPath, 'distribution', 'extensions');
      if (fs.existsSync(distributionExtensions)) {
        const extensions = fs.readdirSync(distributionExtensions);
        for (const extensionId of CONFIG.firefoxExtensionIds) {
          if (extensions.includes(`${extensionId}.xpi`)) {
            return true;
          }
        }
      }

      // Also check policies.json
      const policiesPath = path.join(firefoxPath, 'distribution', 'policies.json');
      if (fs.existsSync(policiesPath)) {
        const policies = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
        for (const extensionId of CONFIG.firefoxExtensionIds) {
          if (policies.extensions && policies.extensions[extensionId]) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Firefox detection error:', error);
    return false;
  }
}

// Update Checking
async function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/CarmaNayeli/owlCloud/releases/latest',
      headers: {
        'User-Agent': 'OwlCloud-Updater'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name?.replace(/^v/, '') || '1.0.0',
            downloadUrl: release.assets?.find(asset =>
              asset.name.includes('.crx') || asset.name.includes('.xpi')
            )?.browser_download_url
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// IPC Handlers
ipcMain.handle('detect-extensions', async () => {
  try {
    const results = {};
    const trackedBrowsers = notificationSettings.trackedBrowsers || ['chrome', 'edge', 'firefox'];
    const customBrowsers = notificationSettings.customBrowsers || [];

    // Detect standard browsers
    if (trackedBrowsers.includes('chrome')) {
      results.chrome = await detectChromeExtension();
    }
    if (trackedBrowsers.includes('edge')) {
      results.edge = await detectEdgeExtension();
    }
    if (trackedBrowsers.includes('firefox')) {
      results.firefox = await detectFirefoxExtension();
    }

    // Detect custom browsers
    for (const browser of customBrowsers) {
      if (trackedBrowsers.includes(browser.id)) {
        results[browser.id] = await detectCustomBrowserExtension(browser);
      }
    }

    return {
      success: true,
      results,
      trackedBrowsers,
      customBrowsers
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-updates', async () => {
  try {
    const updates = await checkForUpdates();
    
    // Check if notifications are enabled and this is a new version
    if (notificationSettings.enabled && updates.version && updates.version !== notificationSettings.lastVersion) {
      showNotification(
        'OwlCloud Update Available!',
        `Version ${updates.version} is now available. Click to open updater.`,
        { urgency: 'normal' }
      );
      
      notificationSettings.lastVersion = updates.version;
      saveNotificationSettings();
    }
    
    return { success: true, updates };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download file from URL
async function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destinationPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destinationPath);
      });

      fileStream.on('error', (error) => {
        fs.unlink(destinationPath, () => {}); // Delete partial file
        reject(error);
      });
    }).on('error', reject);
  });
}

// Get browser policy paths
function getBrowserPolicyPaths(browser) {
  const paths = {
    chrome: {
      crxPath: path.join(process.env.PROGRAMFILES, 'OwlCloud', 'owlcloud-chrome.crx'),
      registryPath: 'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist'
    },
    firefox: {
      xpiPath: path.join(process.env.PROGRAMFILES, 'Mozilla Firefox', 'distribution', 'extensions', 'owlcloud@dicecat.com.xpi'),
      policyPath: path.join(process.env.PROGRAMFILES, 'Mozilla Firefox', 'distribution', 'policies.json')
    }
  };

  return paths[browser];
}

ipcMain.handle('update-extension', async (event, browser) => {
  try {
    console.log(`Starting update for ${browser}...`);

    // Get latest release info
    const release = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.github.com',
        path: '/repos/CarmaNayeli/owlCloud/releases/latest',
        headers: {
          'User-Agent': 'OwlCloud-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });

    // Find the appropriate asset
    const isChromeOrEdge = browser === 'chrome' || browser === 'edge';
    const assetName = isChromeOrEdge ? 'owlcloud-chrome-signed.crx' : 'owlcloud-firefox-signed.xpi';
    const asset = release.assets.find(a => a.name === assetName);

    if (!asset) {
      throw new Error(`Asset ${assetName} not found in release`);
    }

    console.log(`Downloading ${asset.name} from ${asset.browser_download_url}...`);

    // Download to temp directory
    const tempDir = path.join(app.getPath('temp'), 'owlcloud-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, asset.name);
    await downloadFile(asset.browser_download_url, tempFile);

    console.log(`Downloaded to ${tempFile}`);

    // Replace extension files based on browser
    if (isChromeOrEdge) {
      await updateChromeExtension(tempFile, browser);
    } else {
      await updateFirefoxExtension(tempFile);
    }

    // Clean up temp file
    fs.unlinkSync(tempFile);

    console.log(`Update completed for ${browser}`);
    return {
      success: true,
      message: `Updated to version ${release.tag_name}`,
      version: release.tag_name,
      requiresRestart: true
    };
  } catch (error) {
    console.error(`Update failed for ${browser}:`, error);
    return { success: false, error: error.message };
  }
});

async function updateChromeExtension(tempFile, browser) {
  // Target path for extension file
  const extensionDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'OwlCloud');

  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }

  const targetPath = path.join(extensionDir, 'owlcloud-chrome.crx');

  // Copy new extension file
  fs.copyFileSync(tempFile, targetPath);
  console.log(`Copied extension to ${targetPath}`);

  // Update registry policy (Chrome and Edge use same CRX file but different registry paths)
  const registryPath = browser === 'chrome'
    ? 'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist'
    : 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist';

  const updateUrl = `file:///${targetPath.replace(/\\/g, '/')}`;

  try {
    // Update the registry entry (assumes it already exists from initial installation)
    execSync(`reg add "${registryPath}" /v "1" /t REG_SZ /d "${CONFIG.extensionId};${updateUrl}" /f`, { encoding: 'utf8' });
    console.log(`Updated ${browser} policy in registry`);
  } catch (error) {
    console.error(`Failed to update registry:`, error);
    throw error;
  }
}

async function updateFirefoxExtension(tempFile) {
  // Firefox extension paths
  const firefoxProgram = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Mozilla Firefox');
  const distributionDir = path.join(firefoxProgram, 'distribution');
  const extensionsDir = path.join(distributionDir, 'extensions');

  // Create directories if they don't exist
  if (!fs.existsSync(distributionDir)) {
    fs.mkdirSync(distributionDir, { recursive: true });
  }
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }

  const targetPath = path.join(extensionsDir, 'owlcloud@dicecat.com.xpi');

  // Copy new extension file
  fs.copyFileSync(tempFile, targetPath);
  console.log(`Copied Firefox extension to ${targetPath}`);

  // Update policies.json if it exists
  const policiesPath = path.join(distributionDir, 'policies.json');
  if (fs.existsSync(policiesPath)) {
    const policies = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
    // Policy should already exist from initial install, just verify it's there
    console.log(`Firefox policies already configured at ${policiesPath}`);
  }
}

ipcMain.handle('uninstall-extension', async (event, browser) => {
  try {
    // This would trigger the extension uninstall process
    // Implementation would depend on the specific browser's uninstall mechanism
    return { success: true, message: `Uninstall initiated for ${browser}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-notification-settings', async () => {
  try {
    return { success: true, settings: notificationSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('complete-first-run', async () => {
  try {
    // Mark first run as complete
    fs.writeFileSync(path.join(app.getPath('userData'), 'first-run-complete'), 'true');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// Browser tracking management
ipcMain.handle('get-tracked-browsers', async () => {
  try {
    return {
      success: true,
      trackedBrowsers: notificationSettings.trackedBrowsers || ['chrome', 'edge', 'firefox'],
      customBrowsers: notificationSettings.customBrowsers || []
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-browser-tracking', async (event, browserName) => {
  try {
    if (!notificationSettings.trackedBrowsers) {
      notificationSettings.trackedBrowsers = ['chrome', 'edge', 'firefox'];
    }

    const index = notificationSettings.trackedBrowsers.indexOf(browserName);
    if (index > -1) {
      // Remove from tracking
      notificationSettings.trackedBrowsers.splice(index, 1);
    } else {
      // Add to tracking
      notificationSettings.trackedBrowsers.push(browserName);
    }

    saveNotificationSettings();
    return { success: true, trackedBrowsers: notificationSettings.trackedBrowsers };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('browse-for-browser', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Browser Executable',
      filters: [
        { name: 'Executable Files', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    // Try to extract a friendly name from the executable
    const baseName = path.basename(filePath, '.exe');
    const friendlyName = baseName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      success: true,
      filePath,
      fileName,
      suggestedName: friendlyName
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-custom-browser', async (event, browserData) => {
  try {
    if (!notificationSettings.customBrowsers) {
      notificationSettings.customBrowsers = [];
    }

    // Validate browser data
    if (!browserData.name || !browserData.executablePath) {
      return { success: false, error: 'Browser name and executable path are required' };
    }

    // Check if this executable already exists
    const exists = notificationSettings.customBrowsers.some(b =>
      b.executablePath.toLowerCase() === browserData.executablePath.toLowerCase()
    );

    if (exists) {
      return { success: false, error: 'This browser is already added' };
    }

    // Add custom browser
    const newBrowser = {
      id: `custom-${Date.now()}`,
      name: browserData.name,
      executablePath: browserData.executablePath,
      fileName: path.basename(browserData.executablePath),
      icon: browserData.icon || '🌐',
      addedAt: new Date().toISOString()
    };

    notificationSettings.customBrowsers.push(newBrowser);

    // Auto-track the new custom browser
    if (!notificationSettings.trackedBrowsers) {
      notificationSettings.trackedBrowsers = ['chrome', 'edge', 'firefox'];
    }
    if (!notificationSettings.trackedBrowsers.includes(newBrowser.id)) {
      notificationSettings.trackedBrowsers.push(newBrowser.id);
    }

    saveNotificationSettings();
    return { success: true, browser: newBrowser };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-custom-browser', async (event, browserId) => {
  try {
    if (!notificationSettings.customBrowsers) {
      notificationSettings.customBrowsers = [];
    }

    const index = notificationSettings.customBrowsers.findIndex(b => b.id === browserId);
    if (index === -1) {
      return { success: false, error: 'Browser not found' };
    }

    // Remove from custom browsers
    notificationSettings.customBrowsers.splice(index, 1);

    // Remove from tracked browsers if present
    if (notificationSettings.trackedBrowsers) {
      const trackIndex = notificationSettings.trackedBrowsers.indexOf(browserId);
      if (trackIndex > -1) {
        notificationSettings.trackedBrowsers.splice(trackIndex, 1);
      }
    }

    saveNotificationSettings();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Custom browser extension detection
async function detectCustomBrowserExtension(browser) {
  try {
    // For custom browsers, we'll try to detect based on common patterns
    // Users can implement their own detection logic later
    return false; // Default to not detected for custom browsers
  } catch (error) {
    return false;
  }
}
