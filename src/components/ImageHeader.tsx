import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ImageHeaderProps {
  imageUrl?: string;
}

export const ImageHeader: React.FC<ImageHeaderProps> = ({ imageUrl }) => {
  const [imageA, setImageA] = useState<string | undefined>(undefined);
  const [imageB, setImageB] = useState<string | undefined>(undefined);
  const [activeImage, setActiveImage] = useState<'A' | 'B'>('A');

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    // パス処理：__LOCAL_FILE__: を除去してアセットURL化
    const rawPath = imageUrl.startsWith('__LOCAL_FILE__:') 
      ? imageUrl.substring('__LOCAL_FILE__:'.length) 
      : imageUrl;
      
    const assetUrl = convertFileSrc(rawPath);

    // 次のアクティブ画像の準備
    if (activeImage === 'A') {
      setImageB(assetUrl);
      setActiveImage('B');
    } else {
      setImageA(assetUrl);
      setActiveImage('A');
    }
    
    // imageUrl が変わった時だけ実行（activeImage を依存配列から削除）
  }, [imageUrl]);

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
