const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  extensionId: 'mkckngoemfjdkhcpaomdndlecolckgdj',
  chromeUpdateUrl: 'https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/updates/update_manifest.xml',
  firefoxUpdateUrl: 'https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi',
  githubApiUrl: 'https://api.github.com/repos/CarmaNayeli/rollCloud/releases/latest'
};

let mainWindow;
let tray;
let notificationSettings = {
  enabled: false,
  lastChecked: null,
  lastVersion: null,
  checkInterval: 3600000 // 1 hour in milliseconds
};

// Background update checking
let updateCheckInterval;

// Notification settings storage
const SETTINGS_FILE = path.join(app.getPath('userData'), 'notification-settings.json');

function loadNotificationSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      notificationSettings = { ...notificationSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.log('Using default notification settings');
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
        path: '/repos/CarmaNayeli/rollCloud/releases/latest',
        headers: {
          'User-Agent': 'RollCloud-Updater',
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

    // Show notification
    showNotification(
      'RollCloud Update Available!',
      `Version ${release.version} is now available.\n\n${release.name}`,
      { urgency: 'normal' }
    );

    // Send to renderer if window is open
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-release-available', release);
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
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'RollCloud Updater',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('check-updates-requested');
        }
      }
    },
    {
      label: 'Toggle Notifications',
      click: () => {
        notificationSettings.enabled = !notificationSettings.enabled;
        saveNotificationSettings();
        
        if (mainWindow) {
          mainWindow.webContents.send('notification-settings-changed', notificationSettings);
        }
        
        showNotification(
          'Notifications ' + (notificationSettings.enabled ? 'Enabled' : 'Disabled'),
          notificationSettings.enabled ? 'You will be notified when updates are available.' : 'You will not receive update notifications.'
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
  
  tray.setToolTip('RollCloud Updater');
  tray.setContextMenu(contextMenu);
  
  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

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
    mainWindow.show();
  });

  if (process.platform === 'win32') {
    mainWindow.setMenu(null);
  }

  // Hide window instead of closing (for system tray)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  loadNotificationSettings();
  
  // Initialize release monitor
  releaseMonitor = new GitHubReleaseMonitor(CONFIG.githubApiUrl, notificationSettings.checkInterval);
  
  // Perform immediate startup check regardless of notification settings
  console.log('🚀 Performing startup release check...');
  releaseMonitor.checkNow().then(result => {
    console.log('Startup check completed:', result);
  }).catch(error => {
    console.error('Startup check failed:', error);
  });
  
  // Start monitoring if notifications are enabled
  if (notificationSettings.enabled) {
    releaseMonitor.startMonitoring();
  }
  
  // Check if this is first run (installation)
  const isFirstRun = !fs.existsSync(path.join(app.getPath('userData'), 'first-run-complete'));
  if (isFirstRun) {
    // Show notification setup dialog
    setTimeout(() => {
      mainWindow.webContents.send('show-notification-setup');
    }, 1000);
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

// Handle notification settings changes
ipcMain.handle('save-notification-settings', async (event, settings) => {
  try {
    const wasEnabled = notificationSettings.enabled;
    notificationSettings = { ...notificationSettings, ...settings };
    saveNotificationSettings();
    
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
    const firefoxPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox'),
      path.join(os.homedir(), 'Library', 'Application Support', 'Firefox'),
      path.join(os.homedir(), '.mozilla', 'firefox')
    ];

    for (const firefoxPath of firefoxPaths) {
      const policiesPath = path.join(firefoxPath, 'distribution', 'policies.json');
      if (fs.existsSync(policiesPath)) {
        const policies = JSON.parse(fs.readFileSync(policies, 'utf8'));
        if (policies.extensions && policies.extensions[CONFIG.extensionId]) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Update Checking
async function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/CarmaNayeli/rollCloud/releases/latest',
      headers: {
        'User-Agent': 'RollCloud-Updater'
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
}

// IPC Handlers
ipcMain.handle('detect-extensions', async () => {
  try {
    const results = {
      chrome: await detectChromeExtension(),
      edge: await detectEdgeExtension(),
      firefox: await detectFirefoxExtension()
    };
    return { success: true, results };
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
        'RollCloud Update Available!',
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

ipcMain.handle('update-extension', async (event, browser) => {
  try {
    // This would trigger the extension update process
    // Implementation would depend on the specific browser's update mechanism
    return { success: true, message: `Update initiated for ${browser}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('uninstall-extension', async (event, browser) => {
  try {
    // This would trigger the extension uninstall process
    // Implementation would depend on the specific browser's uninstall mechanism
    return { success: true, message: `Uninstall initiated for ${browser}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-notification-settings', async (event, settings) => {
  try {
    notificationSettings = { ...notificationSettings, ...settings };
    saveNotificationSettings();
    return { success: true };
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
