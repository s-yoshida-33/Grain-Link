import React, { useMemo } from 'react';
import type { Shop } from '../types/shop';
import type { ShopListGridConfig } from '../types/settings';
import { ShopCard } from '../components/ShopCard';
import { useAppSettings } from '../hooks/useAppSettings';

interface ShopListViewProps {
  shops: Shop[];
  gridConfig: ShopListGridConfig;
}

// フィルタリング条件定数
const TARGET_GENRE = "飲食店・食品";
const TARGET_AREA = "Food Forest";
const MAX_SLOTS = 12; // 全12枠固定

export const ShopListView: React.FC<ShopListViewProps> = ({ shops, gridConfig }) => {
  const { settings } = useAppSettings();
  const mallId = settings?.mallId || 'sakaikitahanada';
  
  // アセットパス
  const shopListBg = `./assets/malls/${mallId}/shoplist-back.webp`;
  const areaTitleImage = `./assets/malls/${mallId}/area-title.webp`;
  
  // 表示用ショップリストの生成
  const displaySlots = useMemo(() => {
    // 1. 条件に合致する店舗を抽出
    const filteredShops = shops.filter(shop => 
      (shop as any).genre === TARGET_GENRE && 
      (shop as any).area === TARGET_AREA
    ).sort((a, b) => {
      const numA = a.number || "";
      const numB = b.number || "";
      return numA.localeCompare(numB, undefined, { numeric: true });
    });

    console.log('[DEBUG] ShopListView filter:', {
      totalShops: shops.length,
      filteredShops: filteredShops.length,
      targetGenre: TARGET_GENRE,
      targetArea: TARGET_AREA,
      sampleShop: shops[0] ? { genre: (shops[0] as any).genre, area: (shops[0] as any).area } : null
    });

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
      style={{ backgroundImage: `url('${shopListBg}')` }}
    >
      <img 
        src={areaTitleImage} 
        alt="Area Title" 
        className="absolute top-12.5 left-1/2 -translate-x-1/2 z-10 rounded-[15px]" 
      />
       {/* 
         グリッドレイアウト: 
         gridConfig.rows / cols を使うこともできるが、
         12枠固定(例えば 3x4 や 2x6)であればTailwindのクラスで指定する方が簡単。
         ここでは設定値(settings.ts)を尊重しつつ、スタイルを適用する。
       */}
      <div className="flex w-full h-full items-start justify-center pt-80">
        <div 
          className="grid gap-3.75"
          style={{
            gridTemplateRows: `repeat(${gridConfig.rows}, auto)`,
            gridTemplateColumns: `repeat(${gridConfig.cols}, auto)`,
          }}
        >
          {displaySlots.map((shop, index) => (
            <div key={index} style={{ width: '330px', height: '368px' }}>
              <ShopCard shop={shop} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
