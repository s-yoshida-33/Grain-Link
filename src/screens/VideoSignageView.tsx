import React, { useState, useEffect } from 'react';
import { readDir } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, appDataDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
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
  const [resolvedVideoDir, setResolvedVideoDir] = useState<string>("");
  const { settings } = useAppSettings();

  const activeShop = useActiveShopByVideo(shops, currentVideoFile);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const mallId = settings?.mallId || 'sakaikitahanada';
        const devVideoDirAbs = await join('C:/dev/Grain-Link', 'tmp', mallId, 'assets', 'videos');

        const candidates: Array<{
          label: string;
          dirPath: string;
          entries: Promise<Awaited<ReturnType<typeof readDir>>>;
        }> = [];

        // 1) ユーザー設定のディレクトリ（絶対パス想定）
        if (settings?.videoDirectory) {
          candidates.push({
            label: 'settings.videoDirectory',
            dirPath: settings.videoDirectory,
            entries: readDir(settings.videoDirectory),
          });
        }

        // 2) 開発時の tmp/<mallId>/assets/videos（リポジトリ直下を想定）
        if (import.meta.env.DEV) {
          // 相対パスはスコープ拒否されるので絶対パスのみ使用
          candidates.push({
            label: 'dev tmp abs',
            dirPath: devVideoDirAbs,
            entries: readDir(devVideoDirAbs),
          });
        }

        // 3) Roaming (AppData) 配下の標準パス: grain-link/videos
        const roamingDir = await appDataDir();
        const roamingTarget = await join(roamingDir, 'grain-link', 'videos');
        candidates.push({
          label: 'AppData/grain-link/videos',
          dirPath: roamingTarget,
          entries: readDir(roamingTarget),
        });

        // 4) Local (AppLocalData) 配下の標準パス: videos
        const localDir = await appLocalDataDir();
        const localTarget = await join(localDir, 'videos');
        candidates.push({
          label: 'AppLocalData/videos',
          dirPath: localTarget,
          entries: readDir(localTarget),
        });

        let pickedDir = '';
        let pickedEntries: Awaited<ReturnType<typeof readDir>> | null = null;

        for (const c of candidates) {
          try {
            const ent = await c.entries;
            pickedDir = c.dirPath;
            pickedEntries = ent;
            break;
          } catch (e) {
            logWarn('LOCAL_VIDEO', 'Failed to read candidate video dir, trying next', {
              candidate: c.label,
              dir: c.dirPath,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (!pickedEntries) {
          throw new Error('No readable video directory was found');
        }

        setResolvedVideoDir(pickedDir);

        const videoFiles = await Promise.all(
          pickedEntries
            .filter((entry) => entry.isFile && entry.name && /\.(mp4|webm|mov)$/i.test(entry.name))
            .map(async (entry) => {
              // 確実に絶対パスへ結合し、パス区切りを統一して asset 変換で詰まらないようにする
              const absolutePath = await join(pickedDir, entry.name as string);
              return absolutePath.replace(/\\/g, '/');
            })
        );

        videoFiles.sort();
        setPlaylist(videoFiles);

        logWarn('LOCAL_VIDEO', 'Picked video directory', {
          dir: pickedDir,
          fileCount: videoFiles.length,
          sample: videoFiles.slice(0, 3),
        });

        if (videoFiles.length === 0) {
          logWarn('LOCAL_VIDEO', 'No videos found in directory', { dir: pickedDir });
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

  // ビデオディレクトリが確定したら、Rustサーバーに通知
  useEffect(() => {
    if (resolvedVideoDir) {
      invoke<void>('set_video_dir', { dir: resolvedVideoDir })
        .then(() => {
          logWarn('LOCAL_VIDEO', 'Video directory set on server', { dir: resolvedVideoDir });
        })
        .catch((error) => {
          logError('LOCAL_VIDEO', 'Failed to set video dir on server', { error: String(error) });
        });
    }
  }, [resolvedVideoDir]);

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
          muted={true} // Dev/サイネージ用途では自動再生を優先するため強制ミュート
        />
      </div>

      {import.meta.env.DEV && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs p-3 rounded leading-relaxed space-y-1 z-50 max-w-[60vw]">
          <div>Video dir: {resolvedVideoDir || 'n/a'}</div>
          <div>Playlist: {playlist.length} files</div>
          <div>Current video: {currentVideoFile || 'n/a'}</div>
          {playlist.length > 0 && (
            <div className="text-yellow-300">
              First video file:// URL:
              <div className="font-mono text-xs break-words">
                file://{playlist[0]?.replace(/\\/g, '/')}
              </div>
            </div>
          )}
          <div>Image URL: {activeShop?.imageUrl || 'n/a'}</div>
          <div>Logo URL: {activeShop?.shopLogoLocalPath || 'n/a'}</div>
        </div>
      )}
    </div>
  );
};
