export type AppMode = 'VIDEO_AD' | 'SHOP_LIST';

export interface ShopListGridConfig {
  rows: number;
  cols: number;
}

export interface AppSettings {
  appMode: AppMode;
  mallId: string;
  videoDirectory?: string;
  apiEndpoint: string;
  shopListGrid: ShopListGridConfig;
  isMuted?: boolean;
}
