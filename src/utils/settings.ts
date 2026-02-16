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

// Dev 環境では Vite のプロキシを活用するため、API エンドポイントを相対パスに差し替える。
// 本番ビルドでは設定値をそのまま使う。
const applyRuntimeDefaults = (settings: AppSettings): AppSettings => {
  if (import.meta.env.DEV) {
    const mallId = settings.mallId || 'sakaikitahanada';
    return {
      ...settings,
      apiEndpoint: '/api/events',
      // Dev ではリポジトリ直下の tmp/<mallId>/assets/videos をデフォルト参照
      videoDirectory: settings.videoDirectory || `tmp/${mallId}/assets/videos`,
    };
  }

  return settings;
};
