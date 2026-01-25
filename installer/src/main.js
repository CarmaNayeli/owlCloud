const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { installExtension, uninstallExtension, isExtensionInstalled } = require('./extension-installer');
// const { installExtensions } = require('./local-installer'); // Disabled for enterprise
const { generatePairingCode, createPairing, checkPairing } = require('./pairing');

// Extension and bot configuration
const CONFIG = {
  extensionId: 'rollcloud-extension', // Will be the actual extension ID after packaging
  pip2InviteUrl: 'https://discord.com/api/oauth2/authorize?client_id=1464771468452827380&permissions=536870912&scope=bot%20applications.commands',
  supabaseUrl: 'https://gkfpxwvmumaylahtxqrk.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZnB4d3ZtdW1heWxhaHR4cXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDA4MDIsImV4cCI6MjA4MDAxNjgwMn0.P4a17PQ7i1ZgUvLnFdQGupOtKxx8-CWvPhIaFOl2i7g',
  updateManifestUrl: 'https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/updates/update_manifest.xml'
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================================================
// IPC Handlers
// ============================================================================

// Get system info
ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    isAdmin: process.platform === 'win32' ? await checkWindowsAdmin() : process.getuid() === 0
  };
});

// Check if extension is already installed
ipcMain.handle('check-extension-installed', async (event, browser) => {
  return await isExtensionInstalled(browser);
});

// Install extension via local ZIP extraction
ipcMain.handle('install-extension', async (event, browser) => {
  try {
    const result = await installExtension(browser, CONFIG); // Use enterprise policy
    
    if (browser === 'chrome') {
      return results.chrome;
    } else if (browser === 'firefox') {
      return results.firefox;
    } else {
      return { success: false, error: 'Unsupported browser' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Uninstall extension (remove policy)
ipcMain.handle('uninstall-extension', async (event, browser) => {
  try {
    await uninstallExtension(browser);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open Discord bot invite
ipcMain.handle('open-discord-invite', async () => {
  await shell.openExternal(CONFIG.pip2InviteUrl);
  return { success: true };
});

// Generate pairing code
ipcMain.handle('generate-pairing-code', async () => {
  const code = generatePairingCode();
  return { success: true, code };
});

// Create pairing in Supabase
ipcMain.handle('create-pairing', async (event, code) => {
  try {
    await createPairing(code, CONFIG);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if pairing is complete
ipcMain.handle('check-pairing', async (event, code) => {
  try {
    const result = await checkPairing(code, CONFIG);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// Quit app
ipcMain.handle('quit-app', async () => {
  app.quit();
});

// ============================================================================
// Utilities
// ============================================================================

async function checkWindowsAdmin() {
  if (process.platform !== 'win32') return false;

  try {
    const { execSync } = require('child_process');
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
