import React from 'react';
import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo } from '../utils/format';
import comingSoonImage from '../assets/malls/sakaikitahanada/coming-soon.webp';

interface ShopCardProps {
  shop?: Shop;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop }) => {
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
      <div className="h-[220px] w-full bg-white relative">
        {shop.imageUrl ? (
          <img 
            src={shop.imageUrl} 
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
        <div className="flex items-center gap-2 mb-1 ml-[15px]">
          {shop.number && (
            <span className="text-[16px] font-bold text-white bg-[#F08300] w-[60px] inline-block text-center py-1 rounded-[3px]">
              {shop.number}
            </span>
          )}
          {shop.genreMemo && (
            <span className="text-[16px] font-bold text-brand-brown">
              {formatGenreMemo(shop.genreMemo)}
            </span>
          )}
        </div>
        <h3 className="text-[24px] font-bold text-brand-brown ml-[15px]">{formatShopName(shop.name)}</h3>
      </div>
    </div>
  );
};
