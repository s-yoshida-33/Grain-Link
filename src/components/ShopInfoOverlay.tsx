import React from 'react';
import type { Shop } from '../types/shop';

interface ShopInfoOverlayProps {
  shop: Shop | null;
}

export const ShopInfoOverlay: React.FC<ShopInfoOverlayProps> = ({ shop }) => {
  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white text-gray-400">
        <h2 className="text-4xl font-bold">Coming Soon</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white p-8 text-center">
      <h2 className="text-6xl font-bold text-gray-800 mb-6">{shop.name}</h2>
      {shop.description && (
        <p className="text-3xl text-gray-600 leading-relaxed whitespace-pre-wrap">
          {shop.description}
        </p>
      )}
    </div>
  );
};
