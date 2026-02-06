export interface Shop {
  id: string | number;
  name: string;
  description?: string;
  imageUrl?: string;
  // フィルタリング用に追加
  genre?: string;
  area?: string;
  // slot_id はショップリスト表示時の固定枠用（1-indexed または 0-indexed、運用に合わせて決定）
  slot_id?: number;
}
