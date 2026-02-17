// ショップデータのモック生成と正規化ロジック
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Shop } from '../types/shop';

// Bridge APIからの生データ形式 (実データに基づく)
interface BridgeShop {
  shopId?: string;
  shopName?: string;
  shopNameKana?: string;
  shopNameEnglish?: string;
  genre?: string;
  genreMemo?: string;
  area?: string;
  floors?: string;
  number?: string;
  openTime?: string; // 営業時間
  description?: string;
  photo1?: string;
  photo1LocalPath?: string;
  photo2?: string;
  photo2LocalPath?: string; // これを使用
  shopLogo?: string;
  shopLogoLocalPath?: string;
  // 以下後方互換用
  shop_id?: string | number;
  shop_name?: string;
  image_url?: string;
  imageUrl?: string;
}

const isAbsoluteFilePath = (p: string) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\');

const toDisplayPath = (rawPath?: string, apiEndpoint?: string): string => {
  if (!rawPath) return "";

  // HTTP/HTTPS はそのまま
  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  // 区切りをスラッシュに統一
  const normalizedPath = rawPath.replace(/\\/g, '/');

  // file:// はそのまま
  if (/^file:\/\//i.test(normalizedPath)) return normalizedPath;

  // 絶対パスなら asset URL に変換
  if (isAbsoluteFilePath(normalizedPath)) {
    return convertFileSrc(normalizedPath);
  }

  // 相対パスなら API ベースを付与
  if (apiEndpoint) {
    const cleanBase = apiEndpoint.replace(/\/api\/events$/, '').replace(/\/+$/, '');
    const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    return `${cleanBase}${cleanPath}`;
  }

  // フォールバック
  return convertFileSrc(normalizedPath);
};

// データ正規化関数
export const normalizeShops = (rawData: any, apiEndpoint?: string): Shop[] => {
  let list: BridgeShop[] = [];
  
  if (Array.isArray(rawData)) {
    list = rawData;
  } else if (Array.isArray(rawData?.data)) {
    list = rawData.data;
  } else if (Array.isArray(rawData?.items)) {
    list = rawData.items;
  }

  return list.map(item => {
    const imageUrl = toDisplayPath(
      item.photo2LocalPath || item.photo2 || item.image_url || item.imageUrl,
      apiEndpoint
    );

    const shopLogoLocalPath = toDisplayPath(item.shopLogoLocalPath, apiEndpoint);

    return {
      id: item.shopId ?? item.shop_id ?? "",
      name: item.shopName ?? item.shop_name ?? "",
      description: item.description || "",
      imageUrl,
      genre: item.genre,
      area: item.area,
      shopLogoLocalPath,
      genreMemo: item.genreMemo,
      number: item.number,
      openTime: item.openTime,
    };
  });
};

// モックデータジェネレーター (削除)
// export const generateMockShops = (): Shop[] => { ... };
export const generateMockShops = (): Shop[] => [];
