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
  number?: string; // 区画番号
  openTime?: string; // 営業時間（ラストオーダー含む）
}
