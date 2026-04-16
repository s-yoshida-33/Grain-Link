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

export interface AppSettings {
  appMode: AppMode;
  mallId: string;
  videoDirectory?: string;
  apiEndpoint: string;
  shopListGrid: ShopListGridConfig;
  isMuted?: boolean;
  mediaDownloadSettings?: MediaDownloadSettings;
  sleepSettings?: SleepSettings;
  /** 新API用 genreSub フィルター。未設定時は従来の genre + area フィルターを使用 */
  genreSubFilter?: string;
  /** 端末ホスト名（S3メディアパスの識別子として使用） */
  hostname?: string;
}
