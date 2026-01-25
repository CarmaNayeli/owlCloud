const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { installExtension, uninstallExtension, isExtensionInstalled, installFirefoxDeveloperEdition } = require('./extension-installer');
// const { sendPairingCodeToExtension } = require('./native-messaging');
const { generatePairingCode, createPairingAndSend, checkPairing } = require('./pairing');

// Extension and bot configuration
const CONFIG = {
  extensionId: 'mkckngoemfjdkhcpaomdndlecolckgdj', // Actual Chrome extension ID from signed CRX
  chromeUpdateUrl: 'https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/updates/update_manifest.xml',
  firefoxUpdateUrl: 'https://github.com/CarmaNayeli/rollCloud/releases/latest/download/rollcloud-firefox-signed.xpi',
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

// Install extension via enterprise policy
ipcMain.handle('install-extension', async (event, browser) => {
  try {
    const result = await installExtension(browser, CONFIG);
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install Firefox Developer Edition
ipcMain.handle('install-firefox-dev-edition', async () => {
  try {
    const result = await installFirefoxDeveloperEdition();
    return result;
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

// Create pairing and send to extension (new integrated flow)
ipcMain.handle('create-pairing-and-send', async (event, browser) => {
  try {
    const result = await createPairingAndSend(browser, CONFIG);
    return result;
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

// Send pairing code to extension
// ipcMain.handle('send-pairing-to-extension', async (event, browser, code) => {
//   try {
//     const success = await sendPairingCodeToExtension(browser, code);
//     return { success };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// });

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// Quit app
ipcMain.handle('quit-app', async () => {
  app.quit();
});

// Check for extension updates
ipcMain.handle('check-for-updates', async (event, browser) => {
  try {
    const { checkForUpdates } = require('./extension-installer');
    const result = await checkForUpdates(browser, CONFIG);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update extension
ipcMain.handle('update-extension', async (event, browser) => {
  try {
    const { updateExtension } = require('./extension-installer');
    const result = await updateExtension(browser, CONFIG);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Force reinstall extension
ipcMain.handle('force-reinstall-extension', async (event, browser) => {
  try {
    const { forceReinstallExtension } = require('./extension-installer');
    const result = await forceReinstallExtension(browser, CONFIG);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('uninstall-extension', async (event, browser) => {
  try {
    const { uninstallExtension } = require('./extension-installer');
    const result = await uninstallExtension(browser);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Close browser for restart
// ipcMain.handle('close-browser', async (event, browser) => {
//   try {
//     const { exec } = require('child_process');
//     
//     if (browser === 'firefox') {
//       if (process.platform === 'win32') {
//         // Try multiple methods to close Firefox
//         const commands = [
//           'taskkill /f /im firefox.exe',
//           'taskkill /f /im firefox-dev.exe',
//           'taskkill /f /im "Mozilla Firefox"',
//           'taskkill /f /im "Firefox Developer Edition"'
//         ];
//         
//         let browserClosed = false;
//         for (const cmd of commands) {
//           try {
//             exec(cmd, { stdio: 'pipe' });
//             console.log(`✅ Firefox closed with: ${cmd}`);
//             browserClosed = true;
//             break;
//           } catch (error) {
//             // Check if the error is because the process wasn't found (browser not running)
//             if (error.message.includes('not found') || error.message.includes('ERROR: The process') && error.message.includes('not found')) {
//               console.log(`Firefox not running (checked with ${cmd})`);
//               browserClosed = true; // Consider this a success since browser isn't running
//               break;
//             }
//             console.log(`Failed to close Firefox with ${cmd}:`, error.message);
//           }
//         }
//         
//         if (!browserClosed) {
//           throw new Error('Could not close Firefox with any method');
//         }
//       } else if (process.platform === 'darwin') {
//         const commands = [
//           'pkill -f "Firefox Developer Edition"',
//           'pkill -f firefox',
//           'osascript -e \'tell application "Firefox Developer Edition" to quit\'',
//           'osascript -e \'tell application "Firefox" to quit\''
//         ];
//         
//         let browserClosed = false;
//         for (const cmd of commands) {
//           try {
//             exec(cmd, { stdio: 'pipe' });
//             console.log(`✅ Firefox closed with: ${cmd}`);
//             browserClosed = true;
//             break;
//           } catch (error) {
//             console.log(`Failed to close Firefox with ${cmd}:`, error.message);
//           }
//         }
//         
//         if (!browserClosed) {
//           throw new Error('Could not close Firefox with any method');
//         }
//       } else {
//         exec('pkill -f firefox', (error) => {
//           if (error) {
//             console.log('Could not close Firefox:', error.message);
//           }
//         });
//       }
//     } else if (browser === 'chrome') {
//       if (process.platform === 'win32') {
//         const commands = [
//           'taskkill /f /im chrome.exe',
//           'taskkill /f /im "Google Chrome"',
//           'taskkill /f /im "Google Chrome Canary"',
//           'taskkill /f /im "Google Chrome Beta"'
//         ];
//         
//         let browserClosed = false;
//         for (const cmd of commands) {
//           try {
//             exec(cmd, { stdio: 'pipe' });
//             console.log(`✅ Chrome closed with: ${cmd}`);
//             browserClosed = true;
//             break;
//           } catch (error) {
//             // Check if the error is because the process wasn't found (browser not running)
//             if (error.message.includes('not found') || error.message.includes('ERROR: The process') && error.message.includes('not found')) {
//               console.log(`Chrome not running (checked with ${cmd})`);
//               browserClosed = true; // Consider this a success since browser isn't running
//               break;
//             }
//             console.log(`Failed to close Chrome with ${cmd}:`, error.message);
//           }
//         }
//         
//         if (!browserClosed) {
//           throw new Error('Could not close Chrome with any method');
//         }
//       } else if (process.platform === 'darwin') {
//         const commands = [
//           'osascript -e \'tell application "Google Chrome" to quit\'',
//           'pkill -f "Google Chrome"'
//         ];
//         
//         let browserClosed = false;
//         for (const cmd of commands) {
//           try {
//             exec(cmd, { stdio: 'pipe' });
//             console.log(`✅ Chrome closed with: ${cmd}`);
//             browserClosed = true;
//             break;
//           } catch (error) {
//             console.log(`Failed to close Chrome with ${cmd}:`, error.message);
//           }
//         }
//         
//         if (!browserClosed) {
//           throw new Error('Could not close Chrome with any method');
//         }
//       } else {
//         exec('pkill -f chrome', (error) => {
//           if (error) {
//             console.log('Could not close Chrome:', error.message);
//           }
//         });
//       }
//     }
//     
//     return { success: true };
//   } catch (error) {
//     console.error('Error closing browser:', error);
//     return { success: false, error: error.message };
//   }
// });

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
