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
  debug(message, context) {
    ipcRenderer.send('log-message', {
      level: 'debug',
      message,
      context: context || {}
    });
  },
  info(message, context) {
    ipcRenderer.send('log-message', {
      level: 'info',
      message,
      context: context || {}
    });
  },
  warn(message, context) {
    ipcRenderer.send('log-message', {
      level: 'warn',
      message,
      context: context || {}
    });
  },
  error(message, context) {
    ipcRenderer.send('log-message', {
      level: 'error',
      message,
      context: context || {}
    });
  },
});
