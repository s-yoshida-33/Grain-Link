import React, { useState, useEffect } from 'react';
import { BaseDirectory, readDir } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import type { Shop } from '../types/shop';
import { useActiveShopByVideo } from '../hooks/useActiveShopByVideo';
import { useAppSettings } from '../hooks/useAppSettings';
import { logError, logWarn } from '../logs/logging';
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
        // ベースとなるディレクトリの絶対パスを決定
        let targetDirPath = "";
        if (settings?.videoDirectory) {
          // 設定で指定がある場合（絶対パス前提）
          targetDirPath = settings.videoDirectory;
        } else {
          const appDataDir = await appLocalDataDir();
          targetDirPath = await join(appDataDir, 'videos');
        }

        // ディレクトリ読み込み（絶対パス指定）
        let entries: Awaited<ReturnType<typeof readDir>>;
        try {
          entries = await readDir(targetDirPath);
        } catch (e) {
          // フォールバック: AppLocalData/videos を BaseDirectory 指定で読む
          entries = await readDir('videos', { baseDir: BaseDirectory.AppLocalData });
          logWarn('LOCAL_VIDEO', 'Fallback to AppLocalData/videos after readDir error', {
            targetDirPath,
            error: e instanceof Error ? e.message : String(e)
          });
        }

        const videoFiles = await Promise.all(
          entries
            .filter((entry) => entry.isFile && entry.name && /\.(mp4|webm|mov)$/i.test(entry.name))
            .map(async (entry) => {
              // 確実に絶対パスへ結合
              return await join(targetDirPath, entry.name as string);
            })
        );

        videoFiles.sort();
        setPlaylist(videoFiles);

        if (videoFiles.length === 0) {
          logWarn('LOCAL_VIDEO', 'No videos found in directory', { dir: targetDirPath });
        }
      } catch (error) {
        logError('LOCAL_VIDEO', 'Failed to fetch video list', {
          error: error instanceof Error ? error.message : String(error)
        });
        setPlaylist([]);
      }
    };

    fetchVideos();
  }, [settings]);

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
