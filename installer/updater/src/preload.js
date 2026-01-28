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

  // Event listeners
  onShowNotificationSetup: (callback) => ipcRenderer.on('show-notification-setup', callback),
  onNotificationSettingsChanged: (callback) => ipcRenderer.on('notification-settings-changed', callback),
  onCheckUpdatesRequested: (callback) => ipcRenderer.on('check-updates-requested', callback),
  onNewReleaseAvailable: (callback) => ipcRenderer.on('new-release-available', callback),
  onAutoUpdateStarted: (callback) => ipcRenderer.on('auto-update-started', callback),
  onAutoUpdateCompleted: (callback) => ipcRenderer.on('auto-update-completed', callback)
});
