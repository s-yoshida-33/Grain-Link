import React, { useState, useEffect } from 'react';
import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo } from '../utils/format';
import videoBackBg from '../assets/malls/sakaikitahanada/video-back.webp';
import logoFrame from '../assets/malls/sakaikitahanada/logo-frame.webp';

interface ShopInfoOverlayProps {
  shop: Shop | null;
}

export const ShopInfoOverlay: React.FC<ShopInfoOverlayProps> = ({ shop }) => {
  // 背景スタイル（共通）
  const containerStyle: React.CSSProperties = {
    backgroundImage: `url(${videoBackBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  // ダブルバッファリング用のステート
  const [shopA, setShopA] = useState<Shop | null>(shop);
  const [shopB, setShopB] = useState<Shop | null>(null);
  const [activeShop, setActiveShop] = useState<'A' | 'B'>('A');

  useEffect(() => {
    // ショップが変わった場合、非アクティブな方にセットして切り替える
    const currentActiveShop = activeShop === 'A' ? shopA : shopB;
    
    // ID比較で変更検知
    if (shop?.id !== currentActiveShop?.id) {
      if (activeShop === 'A') {
        setShopB(shop);
        setActiveShop('B');
      } else {
        setShopA(shop);
        setActiveShop('A');
      }
    }
  }, [shop, activeShop, shopA, shopB]);

  const renderContent = (targetShop: Shop | null, isActive: boolean) => {
    // テキスト整形
    const displayName = formatShopName(targetShop?.name || "");
    const displayGenre = formatGenreMemo(targetShop?.genreMemo || "");
    const currentLogo = targetShop?.shopLogoLocalPath;

    return (
    <div 
      className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-start pt-[60px] p-8 text-center text-[#4b2c20] transition-opacity duration-1000 ease-in-out"
      style={{ ...containerStyle, opacity: isActive ? 1 : 0, zIndex: isActive ? 2 : 1 }}
    >
      {!targetShop ? (
        <h2 className="text-5xl font-black px-8 py-4 rounded-lg bg-white/80">
          Coming Soon
        </h2>
      ) : (
        <div className="flex flex-col items-center w-full h-full">
          
          {/* 1. ロゴ表示エリア */}
          <div className="relative flex justify-center items-center w-75 h-75 shrink-0">
            <img 
              src={logoFrame}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            {currentLogo ? (
              <img 
                src={currentLogo} 
                alt={`${displayName} Logo`} 
                className="w-58 object-contain relative z-10"
              />
            ) : (
              <div className="h-24 w-full flex items-center justify-center text-2xl font-bold opacity-30 relative z-10" />
            )}
          </div>

          {/* 2. スペーサー：警告に従い flex-grow を grow に変更 */}
          <div className="grow" style={{ minHeight: '36px' }}></div>
        
          {/* 3. 店舗名とジャンルの塊（下部に配置） */}
          <div className="flex flex-col items-center mb-[8vh]">
            <h2 className="text-[96px] font-black leading-tight tracking-tight mb-8">
              {displayName}
            </h2>

            {displayGenre && (
              <div className="inline-block px-18 py-6 border-6 border-[#bf995b] rounded-full">
                <p className="text-4xl font-bold text-[#4b2c20]">
                  {displayGenre}
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-200">
      {renderContent(shopA, activeShop === 'A')}
      {renderContent(shopB, activeShop === 'B')}
    </div>
  );
};
