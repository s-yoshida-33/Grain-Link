// electron/preload.cjs
// Preload script for Electron

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
  onStatus(callback) {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  onProgress(callback) {
    ipcRenderer.on('update-progress', (_event, data) => callback(data));
  },
  startupWaitCompleted() {
    ipcRenderer.send('startup-wait-completed');
  },
  checkForUpdatesReady() {
    ipcRenderer.send('updater:check-for-updates-ready');
  },
});

contextBridge.exposeInMainWorld('appInfo', {
  getVersion() {
    return ipcRenderer.invoke('get-app-version');
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getVideoList: () => ipcRenderer.invoke('get-video-list'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onSettingsUpdate: (callback) => {
    ipcRenderer.on('settings-updated', (_event, settings) => callback(settings));
  },
});

contextBridge.exposeInMainWorld('logger', {
  log: (payload) => ipcRenderer.send('log-message', payload),
});
