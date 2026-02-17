import React, { useState, useEffect } from 'react';
import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo, formatLastOrder } from '../utils/format';
import { useAppSettings } from '../hooks/useAppSettings';
import { invoke } from '@tauri-apps/api/core';
import { logError } from '../logs/logging';

interface ShopCardProps {
  shop?: Shop;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop }) => {
  const { settings } = useAppSettings();
  const mallId = settings?.mallId || 'sakaikitahanada';
  const comingSoonImage = `./assets/malls/${mallId}/coming-soon.webp`;
  
  const [imageUrl, setImageUrl] = useState<string>("");

  // 画像URLを処理（ローカルファイルパスの場合は Data URL に変換）
  useEffect(() => {
    if (!shop?.imageUrl) {
      setImageUrl("");
      return;
    }

    if (shop.imageUrl.startsWith('__LOCAL_FILE__:')) {
      // ローカルファイルパス: Tauri コマンドで Data URL に変換
      const filePath = shop.imageUrl.substring('__LOCAL_FILE__:'.length);
      invoke<string>('load_image_file', { filePath })
        .then(dataUrl => setImageUrl(dataUrl))
        .catch(error => {
          logError('SHOP_CARD', 'Failed to load image file', { error: String(error), filePath });
          setImageUrl("");
        });
    } else {
      // 通常の URL
      setImageUrl(shop.imageUrl);
    }
  }, [shop?.imageUrl]);

  if (!shop) {
    return (
      <div className="w-full h-full rounded-[15px] overflow-hidden border-[3px] border-[#BF995B] flex items-center justify-center">
         <img 
          src={comingSoonImage}  
          alt="Coming Soon" 
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#F8F5E4] rounded-[15px] overflow-hidden border-[3px] border-[#BF995B] flex flex-col">
      {/* 店舗画像エリア (上半分程度を想定) */}
      <div className="h-55 w-full bg-white relative">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={shop.name} 
            className="w-full h-full object-cover"
          />
        ) : (
           <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
            No Image
          </div>
        )}
      </div>

      {/* 店舗情報エリア */}
      <div className="flex-1 flex flex-col justify-center items-start">
        <div className="flex items-center gap-2 mb-1 ml-2 pt-1">
          {shop.number && (
            <span className="text-[16px] font-bold text-white bg-[#F08300] w-15 inline-block text-center py-1 rounded-[3px]">
              {shop.number}
            </span>
          )}
          {shop.genreMemo && (
            <span className="text-[16px] font-bold text-brand-brown">
              {formatGenreMemo(shop.genreMemo)}
            </span>
          )}
        </div>
        <h3 className="text-[24px] font-bold text-brand-brown ml-2">{formatShopName(shop.name)}</h3>
        {shop.openTime && formatLastOrder(shop.openTime) && (
          <p className="text-[16px] font-bold text-brand-brown ml-2 mt-5">
            {formatLastOrder(shop.openTime)}
          </p>
        )}
      </div>
    </div>
  );
};
