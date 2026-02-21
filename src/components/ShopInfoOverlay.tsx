import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Shop } from '../types/shop';
import { formatShopName, formatGenreMemo } from '../utils/format';
import { useAppSettings } from '../hooks/useAppSettings';

interface ShopInfoOverlayProps {
  shop: Shop | null;
}

const AREA_HEIGHT = 704;

/*
 * ジャンルブロックの実高さ計算:
 *   border: 4px × 2 = 8px
 *   padding: 10px × 2 = 20px
 *   text-[18px] line-height ≒ 24px
 *   合計: 8 + 20 + 24 = 52px
 */
const GENRE_BLOCK_HEIGHT = 52;

export const ShopInfoOverlay: React.FC<ShopInfoOverlayProps> = ({ shop }) => {
  const { settings } = useAppSettings();
  const mallId = settings?.mallId || 'sakaikitahanada';
  const videoBackBg = `./assets/malls/${mallId}/video-back.webp`;
  const logoFrame = `./assets/malls/${mallId}/logo-frame.webp`;

  const containerStyle: React.CSSProperties = {
    backgroundImage: `url('${videoBackBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  // ダブルバッファリング用のステート
  const [shopA, setShopA] = useState<Shop | null>(shop);
  const [shopB, setShopB] = useState<Shop | null>(null);
  const [activeShop, setActiveShop] = useState<'A' | 'B'>('A');
  
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
      className="absolute top-0 left-0 w-full text-center text-[#4b2c20] transition-opacity duration-1000 ease-in-out"
      style={{ ...containerStyle, height: `${AREA_HEIGHT}px`, opacity: isActive ? 1 : 0, zIndex: isActive ? 2 : 1 }}
    >
      {!targetShop ? (
        <div className="w-full h-full flex items-center justify-center">
          <h2 className="text-5xl font-black px-8 py-4 rounded-lg bg-white/80">
            Coming Soon
          </h2>
        </div>
      ) : (
        <div 
          className="w-full flex flex-col items-center justify-center"
          style={{ height: `${AREA_HEIGHT}px`, gap: '10px' }}
        >
          
          {/* ブロック1: ロゴ（フレーム）— 固定サイズ */}
          <div 
            className="relative flex justify-center items-center shrink-0" 
            style={{ width: '560px', height: '560px' }}
          >
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
                style={{ maxWidth: '430px', maxHeight: '430px' }}
              />
            ) : (
              <div className="h-24 w-full flex items-center justify-center text-2xl font-bold opacity-30 relative z-10" />
            )}
          </div>

          {/* ブロック2: 店舗名 */}
          <h2 className="text-[40px] font-black leading-tight tracking-tight shrink-0">
            {displayName}
          </h2>

          {/* ブロック3: ジャンル詳細 — ジャンル有無に関わらず同じ高さの枠 */}
          <div 
            className="shrink-0 flex items-center justify-center"
            style={{ height: `${GENRE_BLOCK_HEIGHT}px` }}
          >
            {displayGenre && (
              <div 
                className="inline-block border-4 border-[#bf995b] rounded-full" 
                style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                <p className="text-[18px] font-bold text-[#4b2c20]">
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