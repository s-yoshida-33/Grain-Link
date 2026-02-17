import { BaseDirectory, exists, readTextFile } from '@tauri-apps/plugin-fs';
import type { AppSettings } from '../types/settings';
import defaultSettings from '../config/default-settings.json';
import { logError } from '../logs/logging';

const SETTINGS_FILE = 'settings.json';

// AppLocalData 配下の settings.json を読み込み、デフォルトとマージする
export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const fileExists = await exists(SETTINGS_FILE, { baseDir: BaseDirectory.AppLocalData });

    if (fileExists) {
      const content = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppLocalData });
      const parsed = JSON.parse(content);
      return applyRuntimeDefaults({ ...defaultSettings, ...parsed } as AppSettings);
    }
  } catch (error) {
    logError('CONFIG', 'Failed to load local settings', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return applyRuntimeDefaults(defaultSettings as AppSettings);
};

// Dev 環境でも設定ファイルの値を優先する
const applyRuntimeDefaults = (settings: AppSettings): AppSettings => {
  return settings;
};
