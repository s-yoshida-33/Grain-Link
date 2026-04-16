import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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
  const genreMemoContainerRef = useRef<HTMLSpanElement>(null);
  const genreMemoTextRef = useRef<HTMLSpanElement>(null);
  const lastOrderContainerRef = useRef<HTMLParagraphElement>(null);
  const lastOrderTextRef = useRef<HTMLSpanElement>(null);

  const adjustGenreMemoScale = useCallback(() => {
    const container = genreMemoContainerRef.current;
    const text = genreMemoTextRef.current;
    if (!container || !text) return;
    const containerWidth = container.clientWidth;
    const textWidth = text.scrollWidth;
    text.style.transform =
      textWidth > containerWidth && containerWidth > 0
        ? `scaleX(${containerWidth / textWidth})`
        : "scaleX(1)";
  }, []);

  const adjustLastOrderScale = useCallback(() => {
    const container = lastOrderContainerRef.current;
    const text = lastOrderTextRef.current;
    if (!container || !text) return;
    const containerWidth = container.clientWidth;
    const textWidth = text.scrollWidth;
    text.style.transform =
      textWidth > containerWidth && containerWidth > 0
        ? `scaleX(${containerWidth / textWidth})`
        : "scaleX(1)";
  }, []);

  useLayoutEffect(() => {
    adjustGenreMemoScale();
    document.fonts.ready.then(adjustGenreMemoScale);
    const timer = setTimeout(adjustGenreMemoScale, 100);
    return () => clearTimeout(timer);
  }, [shop?.genreMemo, adjustGenreMemoScale]);

  useLayoutEffect(() => {
    adjustLastOrderScale();
    document.fonts.ready.then(adjustLastOrderScale);
    const timer = setTimeout(adjustLastOrderScale, 100);
    return () => clearTimeout(timer);
  }, [shop?.openTime, adjustLastOrderScale]);

  // 画像URLを処理（ローカルファイルパスの場合は Object URL に変換）
  useEffect(() => {
    if (!shop?.imageUrl) {
      setImageUrl("");
      return;
    }

    if (shop.imageUrl.startsWith('__LOCAL_FILE__:')) {
      // ローカルファイルパス: Object URL に変換して効率的に表示
      const filePath = shop.imageUrl.substring('__LOCAL_FILE__:'.length);
      
      invoke<number[]>('read_image_file', { filePath })
        .then((data: number[]) => {
          // ファイル拡張子から MIME タイプを判定
          const mimeType = filePath.endsWith('.png') 
            ? 'image/png'
            : filePath.endsWith('.gif')
            ? 'image/gif'
            : filePath.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg'; // jpg/jpeg が最も一般的
          
          const uint8Array = new Uint8Array(data);
          const blob = new Blob([uint8Array], { type: mimeType });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        })
        .catch((error: unknown) => {
          logError('SHOP_CARD', 'Failed to load image file', { error: error instanceof Error ? error.message : String(error), filePath });
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
            <span
              ref={genreMemoContainerRef}
              className="text-[16px] font-bold text-brand-brown flex-1 overflow-hidden"
              style={{ display: "block", whiteSpace: "nowrap" }}
            >
              <span
                ref={genreMemoTextRef}
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  transformOrigin: "left center",
                  transform: "scaleX(1)",
                }}
              >
                {formatGenreMemo(shop.genreMemo)}
              </span>
            </span>
          )}
        </div>
        <h3 className="text-[24px] font-bold text-brand-brown ml-2">{formatShopName(shop.name)}</h3>
        {shop.openTime && formatLastOrder(shop.openTime) && (
          <p
            ref={lastOrderContainerRef}
            className="text-[16px] font-bold text-brand-brown ml-2 mt-5 w-[calc(100%-0.5rem)] overflow-hidden"
            style={{ whiteSpace: "nowrap" }}
          >
            <span
              ref={lastOrderTextRef}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                transformOrigin: "left center",
                transform: "scaleX(1)",
              }}
            >
              {formatLastOrder(shop.openTime)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
