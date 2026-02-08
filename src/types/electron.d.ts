export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getVideoList: () => Promise<string[]>;
}

export interface UpdaterAPI {
  onStatus: (callback: (data: { state: string; message: string }) => void) => void;
  onProgress: (
    callback: (data: {
      percent: number;
      transferred: number;
      total: number;
      speed: number;
    }) => void
  ) => void;
  startupWaitCompleted: () => void;
  checkForUpdatesReady: () => void;
}

export interface AppInfoAPI {
  getVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    updater: UpdaterAPI;
    appInfo: AppInfoAPI;
  }
}
