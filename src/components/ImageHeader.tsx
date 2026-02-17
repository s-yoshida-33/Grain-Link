import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logError } from '../logs/logging';

interface ImageHeaderProps {
  imageUrl?: string;
}

export const ImageHeader: React.FC<ImageHeaderProps> = ({ imageUrl }) => {
  // ダブルバッファリング用のステート
  const [imageA, setImageA] = useState<string | undefined>(undefined);
  const [imageB, setImageB] = useState<string | undefined>(undefined);
  const [activeImage, setActiveImage] = useState<'A' | 'B'>('A');

  useEffect(() => {
    if (!imageUrl) {
      if (activeImage === 'A') {
        setImageB(undefined);
      } else {
        setImageA(undefined);
      }
      return;
    }

    const processImage = async () => {
      let processedUrl = imageUrl;

      // __LOCAL_FILE__: マーカーの場合は Object URL に変換
      if (imageUrl.startsWith('__LOCAL_FILE__:')) {
        const filePath = imageUrl.substring('__LOCAL_FILE__:'.length);
        try {
          const data = await invoke<number[]>('read_image_file', { filePath });
          const uint8Array = new Uint8Array(data);
          const mimeType = filePath.endsWith('.png') 
            ? 'image/png'
            : filePath.endsWith('.gif')
            ? 'image/gif'
            : filePath.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
          const blob = new Blob([uint8Array], { type: mimeType });
          processedUrl = URL.createObjectURL(blob);
        } catch (error) {
          logError('IMAGE_HEADER', 'Failed to load image file', {
            error: error instanceof Error ? error.message : String(error),
            filePath,
          });
          return;
        }
      }

      // 非アクティブな方にセットして切り替える
      if (activeImage === 'A') {
        setImageB(processedUrl);
        setActiveImage('B');
      } else {
        setImageA(processedUrl);
        setActiveImage('A');
      }
    };

    processImage();
  }, [imageUrl, activeImage]);

  const renderImage = (src: string | undefined, isActive: boolean) => {
    return (
      <div 
        className="absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out bg-gray-200"
        style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 2 : 1 }}
      >
        {src ? (
          <img 
            src={src} 
            alt="Shop Header" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
            <span className="text-2xl">No Image</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-gray-200 overflow-hidden relative">
      {renderImage(imageA, activeImage === 'A')}
      {renderImage(imageB, activeImage === 'B')}
    </div>
  );
};
