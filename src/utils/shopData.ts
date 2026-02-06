// ショップデータのモック生成と正規化ロジック
import type { Shop } from '../types/shop';

// Bridge APIからの生データ形式 (推定)
interface BridgeShop {
  shop_id?: string | number;
  shopId?: string | number;
  shop_name?: string;
  shopName?: string;
  genre?: string;
  area?: string;
  floors?: string | string[];
  description?: string; // Gidoにはないかもしれないが要件にあるため追加
  image_url?: string;   // 同上
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

  return list.map(item => ({
    id: item.shop_id ?? item.shopId ?? "",
    name: item.shop_name ?? item.shopName ?? "",
    description: item.description || "",
    imageUrl: item.image_url ?? item.imageUrl,
    genre: item.genre,
    area: item.area,
  }));
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
