import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import type { AppSettings } from '../types/settings';
import defaultSettings from '../config/default-settings.json';
import { logError, logInfo } from '../logs/logging';

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

// 設定を AppLocalData 配下の settings.json に保存する
export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    // AppLocalData ディレクトリが存在しない場合は作成
    const dirExists = await exists('', { baseDir: BaseDirectory.AppLocalData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true });
    }

    const content = JSON.stringify(settings, null, 2);
    await writeTextFile(SETTINGS_FILE, content, { baseDir: BaseDirectory.AppLocalData });
    logInfo('CONFIG', 'Settings saved successfully');
  } catch (error) {
    logError('CONFIG', 'Failed to save settings', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

// Dev 環境でも設定ファイルの値を優先する
const applyRuntimeDefaults = (settings: AppSettings): AppSettings => {
  return settings;
};
