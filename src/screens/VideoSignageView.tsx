import React, { useState, useEffect } from 'react';
import type { Shop } from '../types/shop';
import { useActiveShopByVideo } from '../hooks/useActiveShopByVideo';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { ShopInfoOverlay } from '../components/ShopInfoOverlay';
import { ImageHeader } from '../components/ImageHeader';
import videoBackBg from '../assets/malls/sakaikitahanada/video-back.webp';

interface VideoSignageViewProps {
  shops: Shop[];
}

export const VideoSignageView: React.FC<VideoSignageViewProps> = ({ shops }) => {
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentVideoFile, setCurrentVideoFile] = useState<string>("");
  
  const activeShop = useActiveShopByVideo(shops, currentVideoFile);

  useEffect(() => {
    // Electron経由で動画リストを取得
    const fetchVideos = async () => {
      try {
        if (window.electronAPI) {
          const videos = await window.electronAPI.getVideoList();
          // 必要に応じて並び替え（名前順など）
          videos.sort();
          setPlaylist(videos);
        } else {
          console.warn("Electron API not found. Running in browser mode.");
          // ブラウザテスト用にダミーリストを設定（この場合は再生できないがエラー回避）
          setPlaylist([]);
        }
      } catch (error) {
        console.error("Failed to fetch video list:", error);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden">
      {/* 上：店舗イメージ画像 (H: 608px) */}
      <div style={{ height: '608px' }} className="shrink-0">
        <ImageHeader imageUrl={activeShop?.imageUrl} />
      </div>

      {/* 中：店舗情報 (H: 704px) */}
      <div style={{ height: '704px' }} className="shrink-0 border-t border-b border-gray-200">
        <ShopInfoOverlay shop={activeShop} />
      </div>

      {/* 下：店舗動画再生 (H: 608px) */}
      <div 
        style={{ 
          height: '608px',
          backgroundImage: `url(${videoBackBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} 
        className="shrink-0"
      >
        <LocalVideoPlayer 
          playlist={playlist}
          onVideoChange={setCurrentVideoFile}
        />
      </div>
    </div>
  );
};
