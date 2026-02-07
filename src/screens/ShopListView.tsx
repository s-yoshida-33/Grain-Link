import React, { useMemo } from 'react';
import type { Shop } from '../types/shop';
import type { ShopListGridConfig } from '../types/settings';
import { ShopCard } from '../components/ShopCard';
import shopListBg from '../assets/malls/sakaikitahanada/shoplist-back.webp';
import areaTitleImage from '../assets/malls/sakaikitahanada/area-title.webp';

interface ShopListViewProps {
  shops: Shop[];
  gridConfig: ShopListGridConfig;
}

// フィルタリング条件定数
const TARGET_GENRE = "飲食店・食品";
const TARGET_AREA = "Food Forest";
const MAX_SLOTS = 12; // 全12枠固定

export const ShopListView: React.FC<ShopListViewProps> = ({ shops, gridConfig }) => {
  
  // 表示用ショップリストの生成
  const displaySlots = useMemo(() => {
    // 1. 条件に合致する店舗を抽出
    const filteredShops = shops.filter(shop => 
      // APIから取得するデータ構造に依存するが、
      // ここではShop型にgenre, areaが含まれていると仮定してフィルタリング
      // 現状のShop型定義にはないので後ほど型定義を拡張する必要がある
      (shop as any).genre === TARGET_GENRE && 
      (shop as any).area === TARGET_AREA
    );

    // 2. 最大12枠分の配列を作成
    const slots: (Shop | undefined)[] = new Array(MAX_SLOTS).fill(undefined);

    // 3. 抽出した店舗を埋める
    filteredShops.slice(0, MAX_SLOTS).forEach((shop, index) => {
      slots[index] = shop;
    });

    return slots;
  }, [shops]);

  return (
    <div 
      className="w-full h-full p-8 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${shopListBg})` }}
    >
      <img 
        src={areaTitleImage} 
        alt="Area Title" 
        className="absolute top-[50px] left-1/2 -translate-x-1/2 z-10" 
      />
       {/* 
         グリッドレイアウト: 
         gridConfig.rows / cols を使うこともできるが、
         12枠固定(例えば 3x4 や 2x6)であればTailwindのクラスで指定する方が簡単。
         ここでは設定値(settings.ts)を尊重しつつ、スタイルを適用する。
       */}
      <div 
        className="grid w-full h-full gap-6"
        style={{
          gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
          gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
        }}
      >
        {displaySlots.map((shop, index) => (
          <div key={index} className="w-full h-full flex items-center justify-center">
            <div style={{ width: '330px', height: '368px' }}>
              <ShopCard shop={shop} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
