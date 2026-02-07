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
      // 文字列として比較
      if (String(s.id) === nameWithoutExt) return true;
      // 数値として比較 (ファイル名が "001" で IDが 1 の場合などを考慮)
      if (Number(s.id) === Number(nameWithoutExt)) return true;
      return false;
    });

    setActiveShop(shop || null);
  }, [shops, videoFileName]);

  return activeShop;
};
