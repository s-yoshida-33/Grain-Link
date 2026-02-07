export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getVideoList: () => Promise<string[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
