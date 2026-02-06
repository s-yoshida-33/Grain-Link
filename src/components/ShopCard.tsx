import React from 'react';
import { Shop } from '../types/shop';
import comingSoonSvg from '../assets/malls/sakaikitahanada/coming-soon.svg';

interface ShopCardProps {
  shop?: Shop;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop }) => {
  if (!shop) {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden shadow-md bg-gray-50 flex items-center justify-center">
         <img 
          src={comingSoonSvg} 
          alt="Coming Soon" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 flex flex-col">
      {/* 店舗画像エリア (上半分程度を想定) */}
      <div className="h-3/5 w-full bg-gray-200 relative">
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
      <div className="flex-1 p-4 flex flex-col justify-center items-center text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">{shop.name}</h3>
        {shop.description && (
          <p className="text-sm text-gray-600 line-clamp-3">
            {shop.description}
          </p>
        )}
      </div>
    </div>
  );
};
