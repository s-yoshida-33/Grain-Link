import type { AppSettings } from '../types/settings';
import defaultSettings from '../config/default-settings.json';

// 設定読み込み関数
// ElectronのIPC経由でローカルの設定ファイルを読み込む
export const loadSettings = async (): Promise<AppSettings> => {
  if (window.electronAPI && window.electronAPI.getSettings) {
    try {
      const settings = await window.electronAPI.getSettings();
      // デフォルト値とマージして返す（不足項目を補完）
      return { ...defaultSettings, ...settings } as AppSettings;
    } catch (error) {
      console.error('Failed to load settings via IPC:', error);
      return defaultSettings as AppSettings;
    }
  }
  
  // 開発環境（ブラウザ）などのフォールバック
  // console.log('Loading settings (fallback)...', defaultSettings);
  return defaultSettings as AppSettings;
};
