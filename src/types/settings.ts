export type AppMode = 'VIDEO_AD' | 'SHOP_LIST';

export interface ShopListGridConfig {
  rows: number;
  cols: number;
}

export interface MediaDownloadSettings {
  autoDownloadOnStartup?: boolean;
  autoDownloadOnUpdate?: boolean;
  maxConcurrentDownloads?: number;
  retryAttempts?: number;
}

export interface SleepSettings {
  enabled: boolean;
  startTime: string; // 営業開始時刻 "HH:MM" 形式
  endTime: string;   // 営業終了時刻 "HH:MM" 形式
}

/**
 * settings.json に保存するグローバル設定（端末レベル）
 * モールを切り替えても引き継がれる。
 */
export interface GlobalSettings {
  mallId: string;
  hostname?: string;
  appMode: AppMode;
  isMuted?: boolean;
  sleepSettings?: SleepSettings;
}

/**
 * {mallId}-settings.json に保存するモール別設定。
 * モールごとに独立したファイルを持つ。
 */
export interface MallSettings {
  apiEndpoint: string;
  shopListGrid: ShopListGridConfig;
  videoDirectory?: string;
  mediaDownloadSettings?: MediaDownloadSettings;
  /** 新API用 genreSub フィルター。未設定時は従来の genre + area フィルターを使用 */
  genreSubFilter?: string;
}

/**
 * GlobalSettings + MallSettings を統合したビュー。
 * 既存コードとの後方互換性のために維持する。
 */
export interface AppSettings extends GlobalSettings, MallSettings {}
