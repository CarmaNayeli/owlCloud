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
  setCheckInterval: (interval) => ipcRenderer.invoke('set-check-interval', interval)
});

// Handle window close
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('quitBtn').addEventListener('click', () => {
    window.electronAPI.quitApp();
  });
});

// Listen for notification settings changes from main process
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on('notification-settings-changed', (event, settings) => {
    // Update UI if notification settings change from tray menu
    const notificationToggle = document.getElementById('notificationToggle');
    if (notificationToggle) {
      notificationToggle.checked = settings.enabled;
    }
  });
  
  ipcRenderer.on('check-updates-requested', () => {
    // Trigger update check when requested from tray
    checkForUpdates();
  });
});
