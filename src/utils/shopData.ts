// ショップデータのモック生成と正規化ロジック
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

// データ正規化関数
export const normalizeShops = (rawData: any): Shop[] => {
  let list: BridgeShop[] = [];
  
  if (Array.isArray(rawData)) {
    list = rawData;
  } else if (Array.isArray(rawData?.data)) {
    list = rawData.data;
  } else if (Array.isArray(rawData?.items)) {
    list = rawData.items;
  }

  return list.map(item => {
    // 画像パスの解決: ローカルパスを file:// URL に変換
    // Electron (WebSecurity: false) 環境下でのみ有効
    let imageUrl = "";
    if (item.photo2LocalPath) {
        // Windowsパスのバックスラッシュをスラッシュに変換
        imageUrl = `file:///${item.photo2LocalPath.replace(/\\/g, '/')}`;
    } else if (item.photo2) {
        imageUrl = item.photo2;
    } else {
        imageUrl = item.image_url ?? item.imageUrl ?? "";
    }
    
    // ロゴパスの解決
    let shopLogoLocalPath = "";
    if (item.shopLogoLocalPath) {
        shopLogoLocalPath = `file:///${item.shopLogoLocalPath.replace(/\\/g, '/')}`;
    }

    return {
        id: item.shopId ?? item.shop_id ?? "",
        name: item.shopName ?? item.shop_name ?? "",
        description: item.description || "",
        imageUrl: imageUrl,
        genre: item.genre,
        area: item.area,
        shopLogoLocalPath: shopLogoLocalPath,
        genreMemo: item.genreMemo,
        number: item.number,
    };
  });
};

// モックデータジェネレーター (削除)
// export const generateMockShops = (): Shop[] => { ... };
export const generateMockShops = (): Shop[] => [];
