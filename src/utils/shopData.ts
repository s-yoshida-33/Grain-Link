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

    return {
        id: item.shopId ?? item.shop_id ?? "",
        name: item.shopName ?? item.shop_name ?? "",
        description: item.description || "",
        imageUrl: imageUrl,
        genre: item.genre,
        area: item.area,
    };
  });
};

// モックデータジェネレーター
export const generateMockShops = (): Shop[] => {
  const shops: Shop[] = [];
  
  // 動画ファイル名に合わせたID設定 (112, 116, 180, 293, 326, 329)
  const videoIds = [112, 116, 180, 293, 326, 329];
  
  // 動画がある店舗
  videoIds.forEach(id => {
    shops.push({
      id: id.toString(),
      name: `Shop ${id} (Video Available)`,
      description: `美味しい料理を提供するショップ${id}です。詳細な説明文がここに入ります。`,
      genre: "飲食店・食品",
      area: "Food Forest",
      imageUrl: "https://placehold.co/600x400/orange/white?text=Shop+Image"
    });
  });

  // 動画がない店舗 (リスト表示用)
  for (let i = 1; i <= 6; i++) {
    const id = 1000 + i;
    shops.push({
      id: id.toString(),
      name: `Other Shop ${id}`,
      description: `その他の店舗${id}の説明です。`,
      genre: "飲食店・食品",
      area: "Food Forest", // 条件一致させる
      imageUrl: "https://placehold.co/600x400/blue/white?text=Other+Shop"
    });
  }

  // 条件に合致しない店舗 (フィルタリング確認用)
  shops.push({
    id: "9999",
    name: "Non-Food Shop",
    genre: "Fashion",
    area: "1F",
  });

  return shops;
};
