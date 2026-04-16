export interface Shop {
  id: string | number;
  name: string;
  description?: string;
  imageUrl?: string;
  genre?: string;
  genreSub?: string; // 新API: 統一ジャンルのサブカテゴリ（フードコート / レストラン / カフェ / スイーツ/その他）
  area?: string;
  // 追加フィールド
  shopLogoThumbW640LocalPath?: string;
  genreMemo?: string;
  number?: string; // 区画番号
  openTime?: string; // 営業時間（ラストオーダー含む）
}
