import { useState, useEffect } from 'react';
import type { Shop } from '../types/shop';

export const useActiveShopByVideo = (shops: Shop[], videoFileName: string) => {
  const [activeShop, setActiveShop] = useState<Shop | null>(null);

  useEffect(() => {
    if (!videoFileName) {
      setActiveShop(null);
      return;
    }

    // 動画ファイル名 (例: "001.mp4" または "shop_123.mp4") から ID 部分を抽出
    // 拡張子を除去
    const nameWithoutExt = videoFileName.replace(/\.[^/.]+$/, "");
    
    // ここでは単純にファイル名(拡張子なし)とIDが一致するか、
    // あるいはファイル名がIDを含んでいるか(パースロジック)を定義する
    // 現在の要件では「メディア名をショップIDに設定」とのことなので、完全一致または数値変換で比較
    
    const shop = shops.find(s => {
      // 文字列として比較（旧API: 数値文字列のshopId）
      if (String(s.id) === nameWithoutExt) return true;
      // 数値として比較（ファイル名 "001" と ID 1 などを考慮）
      if (Number(s.id) === Number(nameWithoutExt)) return true;
      // 区画番号で比較（新API: shopIdがUUIDになるため、動画ファイル名はnumberで命名）
      if (s.number !== undefined && String(s.number) === nameWithoutExt) return true;
      return false;
    });

    setActiveShop(shop || null);
  }, [shops, videoFileName]);

  return activeShop;
};
