import { AppSettings } from '../types/settings';
import defaultSettings from '../config/default-settings.json';

// 設定読み込み関数
// 将来的にはElectronのIPC経由でローカルの設定ファイルを読み込むように拡張可能
export const loadSettings = async (): Promise<AppSettings> => {
  // console.log('Loading settings...', defaultSettings);
  // 型アサーションを使って返す
  return defaultSettings as AppSettings;
};
