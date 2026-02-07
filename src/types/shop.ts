import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo } from '../utils/format';

export interface Shop {
  id: string | number;
  name: string;
  description?: string;
  imageUrl?: string;
  genre?: string;
  area?: string;
  // 追加フィールド
  shopLogoLocalPath?: string;
  genreMemo?: string;
}
