import React, { useState, useEffect } from 'react';
import { BaseDirectory, readDir } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import type { Shop } from '../types/shop';
import { useActiveShopByVideo } from '../hooks/useActiveShopByVideo';
import { useAppSettings } from '../hooks/useAppSettings';
import { logError } from '../logs/logging';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { ShopInfoOverlay } from '../components/ShopInfoOverlay';
import { ImageHeader } from '../components/ImageHeader';

interface VideoSignageViewProps {
  shops: Shop[];
}

export const VideoSignageView: React.FC<VideoSignageViewProps> = ({ shops }) => {
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentVideoFile, setCurrentVideoFile] = useState<string>("");
  const { settings } = useAppSettings();

  const activeShop = useActiveShopByVideo(shops, currentVideoFile);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const baseDir = await appLocalDataDir();
        const entries = await readDir('videos', { baseDir: BaseDirectory.AppLocalData });

        const videoFiles = await Promise.all(
          entries
            .filter((entry) => entry.isFile && entry.name && /\.(mp4|webm|mov)$/i.test(entry.name))
            .map(async (entry) => entry.path ?? await join(baseDir, 'videos', entry.name as string))
        );

        videoFiles.sort();
        setPlaylist(videoFiles);
      } catch (error) {
        logError('LOCAL_VIDEO', 'Failed to fetch video list', {
          error: error instanceof Error ? error.message : String(error)
        });
        setPlaylist([]);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* 上：店舗イメージ画像 */}
      <div style={{ height: '31.6%' }} className="shrink-0">
        <ImageHeader imageUrl={activeShop?.imageUrl} />
      </div>

      {/* 中：店舗情報 */}
      <div style={{ height: '36.8%' }} className="shrink-0 ">
        <ShopInfoOverlay shop={activeShop} />
      </div>

      {/* 下：店舗動画再生 */}
      <div 
        style={{ 
          height: '31.6%',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} 
        className="shrink-0"
      >
        <LocalVideoPlayer
          playlist={playlist}
          onVideoChange={setCurrentVideoFile}
          muted={settings?.isMuted || false}
        />
      </div>
    </div>
  );
};
