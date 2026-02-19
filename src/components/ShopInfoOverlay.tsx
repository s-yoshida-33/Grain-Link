import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo } from '../utils/format';
import { useAppSettings } from '../hooks/useAppSettings';

interface ShopInfoOverlayProps {
  shop: Shop | null;
}

export const ShopInfoOverlay: React.FC<ShopInfoOverlayProps> = ({ shop }) => {
  const { settings } = useAppSettings();
  const mallId = settings?.mallId || 'sakaikitahanada';
  const videoBackBg = `./assets/malls/${mallId}/video-back.webp`;
  const logoFrame = `./assets/malls/${mallId}/logo-frame.webp`;

  // 背景スタイル
  const containerStyle: React.CSSProperties = {
    backgroundImage: `url('${videoBackBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  // ダブルバッファリング用のステート
  const [shopA, setShopA] = useState<Shop | null>(shop);
  const [shopB, setShopB] = useState<Shop | null>(null);
  const [activeShop, setActiveShop] = useState<'A' | 'B'>('A');
  
  // ロゴ URL キャッシュ
  const [logoUrlA, setLogoUrlA] = useState<string | undefined>(undefined);
  const [logoUrlB, setLogoUrlB] = useState<string | undefined>(undefined);

  useEffect(() => {
    const currentActiveShop = activeShop === 'A' ? shopA : shopB;
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

  // ロゴ URL 変換処理
  useEffect(() => {
    const processLogo = (shopLogoPath: string | undefined): string | undefined => {
      if (!shopLogoPath) return undefined;
      const rawPath = shopLogoPath.startsWith('__LOCAL_FILE__:') 
        ? shopLogoPath.substring('__LOCAL_FILE__:'.length) 
        : shopLogoPath;
      return convertFileSrc(rawPath);
    };

    if (activeShop === 'A' && shopA?.shopLogoLocalPath) {
      setLogoUrlA(processLogo(shopA.shopLogoLocalPath));
    } else if (activeShop === 'B' && shopB?.shopLogoLocalPath) {
      setLogoUrlB(processLogo(shopB.shopLogoLocalPath));
    }
  }, [activeShop, shopA?.id, shopB?.id]);

  const renderContent = (targetShop: Shop | null, logoUrl: string | undefined, isActive: boolean) => {
    const displayName = formatShopName(targetShop?.name || "");
    const displayGenre = formatGenreMemo(targetShop?.genreMemo || "");

    return (
    <div 
      className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-start p-8 text-center text-[#4b2c20] transition-opacity duration-1000 ease-in-out"
      style={{ ...containerStyle, opacity: isActive ? 1 : 0, zIndex: isActive ? 2 : 1 }}
    >
      {!targetShop ? (
        <h2 className="text-5xl font-black px-8 py-4 rounded-lg bg-white/80">
          Coming Soon
        </h2>
      ) : (
        <div className="flex flex-col items-center w-full h-full">
          
          {/* 1. ロゴ表示エリア */}
          <div className="relative flex justify-center items-center shrink-0" style={{ width: '415px', height: '415px', marginTop: '4px', marginBottom: '30px' }}>
            <img 
              src={logoFrame}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={`${displayName} Logo`} 
                className="object-contain relative z-10"
                style={{ width: '320px' }}
              />
            ) : (
              <div className="h-24 w-full flex items-center justify-center text-2xl font-bold opacity-30 relative z-10" />
            )}
          </div>

          {/* 2. スペーサー：30px固定 */}
          <div style={{ height: '30px' }}></div>
        
          {/* 3. 店舗名とジャンルの塊 */}
          <div className="flex flex-col items-center">
            <h2 className="text-[60px] font-black leading-tight tracking-tight mb-7.5">
              {displayName}
            </h2>

            {displayGenre && (
              <div 
                className="inline-block border-6 border-[#bf995b] rounded-full" 
                style={{ paddingLeft: '60px', paddingRight: '60px', paddingTop: '12px', paddingBottom: '12px' }}
              >
                <p className="text-[32px] font-bold text-[#4b2c20]">
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
      {renderContent(shopA, logoUrlA, activeShop === 'A')}
      {renderContent(shopB, logoUrlB, activeShop === 'B')}
    </div>
  );
};