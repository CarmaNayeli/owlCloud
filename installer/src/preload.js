const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('api', {
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Extension management
  checkExtensionInstalled: (browser) => ipcRenderer.invoke('check-extension-installed', browser),
  installExtension: (browser) => ipcRenderer.invoke('install-extension', browser),
  uninstallExtension: (browser) => ipcRenderer.invoke('uninstall-extension', browser),
  installFirefoxDevEdition: () => ipcRenderer.invoke('install-firefox-dev-edition'),

  // Discord
  openDiscordInvite: () => ipcRenderer.invoke('open-discord-invite'),

  // Pairing
  generatePairingCode: () => ipcRenderer.invoke('generate-pairing-code'),
  createPairing: (code) => ipcRenderer.invoke('create-pairing', code),
  checkPairing: (code) => ipcRenderer.invoke('check-pairing', code),

  // Utilities
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  quitApp: () => ipcRenderer.invoke('quit-app')
});
