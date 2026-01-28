const { contextBridge, ipcRenderer, shell } = require('electron');

// Expose safe functions to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  detectExtensions: () => ipcRenderer.invoke('detect-extensions'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  updateExtension: (browser) => ipcRenderer.invoke('update-extension', browser),
  uninstallExtension: (browser) => ipcRenderer.invoke('uninstall-extension', browser),
  saveNotificationSettings: (settings) => ipcRenderer.invoke('save-notification-settings', settings),
  getNotificationSettings: () => ipcRenderer.invoke('get-notification-settings'),
  completeFirstRun: () => ipcRenderer.invoke('complete-first-run'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  openExternal: (url) => shell.openExternal(url),
  // Release monitoring functions
  startReleaseMonitoring: () => ipcRenderer.invoke('start-release-monitoring'),
  stopReleaseMonitoring: () => ipcRenderer.invoke('stop-release-monitoring'),
  checkReleasesNow: () => ipcRenderer.invoke('check-releases-now'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  setCheckInterval: (interval) => ipcRenderer.invoke('set-check-interval', interval),

  // Browser tracking management
  getTrackedBrowsers: () => ipcRenderer.invoke('get-tracked-browsers'),
  toggleBrowserTracking: (browserName) => ipcRenderer.invoke('toggle-browser-tracking', browserName),
  browseForBrowser: () => ipcRenderer.invoke('browse-for-browser'),
  addCustomBrowser: (browserData) => ipcRenderer.invoke('add-custom-browser', browserData),
  removeCustomBrowser: (browserId) => ipcRenderer.invoke('remove-custom-browser', browserId),

  // Event listeners
  onShowNotificationSetup: (callback) => ipcRenderer.on('show-notification-setup', callback),
  onNotificationSettingsChanged: (callback) => ipcRenderer.on('notification-settings-changed', callback),
  onCheckUpdatesRequested: (callback) => ipcRenderer.on('check-updates-requested', callback),
  onNewReleaseAvailable: (callback) => ipcRenderer.on('new-release-available', callback),
  onAutoUpdateStarted: (callback) => ipcRenderer.on('auto-update-started', callback),
  onAutoUpdateCompleted: (callback) => ipcRenderer.on('auto-update-completed', callback)
});
