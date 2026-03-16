import React, { useState, useEffect, useMemo } from 'react';
import { readDir } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Shop } from '../types/shop';
import { useActiveShopByVideo } from '../hooks/useActiveShopByVideo';
import { useAppSettings } from '../hooks/useAppSettings';
import { logDebug, logError, logWarn } from '../logs/logging';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { ShopInfoOverlay } from '../components/ShopInfoOverlay';
import { ImageHeader } from '../components/ImageHeader';

interface VideoSignageViewProps {
  shops: Shop[];
}

export const VideoSignageView: React.FC<VideoSignageViewProps> = ({ shops }) => {
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentVideoFile, setCurrentVideoFile] = useState<string>("");
  const [isSleeping, setIsSleeping] = useState(false);
  const { settings } = useAppSettings();

  // 暗転状態の変化を監視し、暗転中は音声をミュートにする
  useEffect(() => {
    const handleSleepChange = (e: Event) => {
      const detail = (e as CustomEvent<{ sleeping: boolean }>).detail;
      setIsSleeping(detail.sleeping);
    };
    window.addEventListener('screen-sleep-change', handleSleepChange);
    return () => window.removeEventListener('screen-sleep-change', handleSleepChange);
  }, []);

  const activeShop = useActiveShopByVideo(shops, currentVideoFile);

  // 次の動画を特定して、そのショップ情報を取得する
  const nextVideoFile = useMemo(() => {
    if (playlist.length === 0) return "";
    const currentIndex = playlist.indexOf(currentVideoFile);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % playlist.length;
    return playlist[nextIndex];
  }, [playlist, currentVideoFile]);

  const nextShop = useActiveShopByVideo(shops, nextVideoFile);

  // 次のショップの画像をプリロード（先読み）する
  useEffect(() => {
    if (!nextShop) return;

    const preload = (path?: string) => {
      if (!path) return;
      // パスを整形してURL化
      const rawPath = path.startsWith('__LOCAL_FILE__:')
        ? path.substring('__LOCAL_FILE__:'.length)
        : path;
      const src = convertFileSrc(rawPath);

      // 画像をメモリ上に読み込む
      const img = new Image();
      img.src = src;
    };

    preload(nextShop.imageUrl);
    preload(nextShop.shopLogoThumbW640LocalPath);
  }, [nextShop]);

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

        // 3) Local (AppLocalData) 配下の標準パス: videos
        // appLocalDataDir() はすでに com.tti.grain-link を指しているので、
        // そこに videos サブディレクトリがあるはず
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
            logDebug('LOCAL_VIDEO', 'Failed to read candidate video dir, trying next', {
              candidate: c.label,
              dir: c.dirPath,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (!pickedEntries) {
          throw new Error('No readable video directory was found');
        }

        const allVideoFiles = await Promise.all(
          pickedEntries
            .filter((entry) => entry.isFile && entry.name && /\.(mp4|webm|mov)$/i.test(entry.name))
            .map(async (entry) => {
              const absolutePath = await join(pickedDir, entry.name as string);
              return absolutePath.replace(/\\/g, '/');
            })
        );

        allVideoFiles.sort();

        // Validate video filenames against shopIds — skip videos with no matching shop
        const validVideoFiles: string[] = [];
        const skippedVideos: string[] = [];

        if (shops.length > 0) {
          for (const videoPath of allVideoFiles) {
            const baseName = videoPath.split(/[/\\]/).pop() || '';
            const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');

            const hasMatchingShop = shops.some(s => {
              if (String(s.id) === nameWithoutExt) return true;
              if (Number(s.id) === Number(nameWithoutExt)) return true;
              return false;
            });

            if (hasMatchingShop) {
              validVideoFiles.push(videoPath);
            } else {
              skippedVideos.push(baseName);
            }
          }

          if (skippedVideos.length > 0) {
            logWarn('VIDEO_VALIDATION',
              `Skipped ${skippedVideos.length} video(s) with no matching shopId`,
              {
                skippedFiles: skippedVideos,
                totalVideos: allVideoFiles.length,
                validVideos: validVideoFiles.length,
                shopIds: shops.map(s => String(s.id)),
              },
            );
          }
        } else {
          validVideoFiles.push(...allVideoFiles);
        }

        setPlaylist(validVideoFiles);

        logDebug('LOCAL_VIDEO', 'Picked video directory', {
          dir: pickedDir,
          fileCount: validVideoFiles.length,
          totalOnDisk: allVideoFiles.length,
          skipped: skippedVideos.length,
          sample: validVideoFiles.slice(0, 3),
        });

        if (validVideoFiles.length === 0) {
          logWarn('LOCAL_VIDEO', 'No playable videos after validation', {
            dir: pickedDir,
            totalOnDisk: allVideoFiles.length,
            skippedFiles: skippedVideos,
          });
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
    <div className="flex flex-col w-full h-full overflow-hidden bg-white">
      {/* 上：店舗イメージ画像 */}
      <div style={{ height: '31.6%' }} className="shrink-0 bg-white">
        <ImageHeader imageUrl={activeShop?.imageUrl} />
      </div>

      {/* 中：店舗情報 */}
      <div style={{ height: '36.8%' }} className="shrink-0 bg-gray-200">
        <ShopInfoOverlay shop={activeShop} />
      </div>

      {/* 下：店舗動画再生 */}
      <div 
        style={{ 
          height: '31.6%',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} 
        className="shrink-0 bg-white"
      >
        <LocalVideoPlayer
          playlist={playlist}
          onVideoChange={setCurrentVideoFile}
          muted={isSleeping || (settings?.isMuted ?? false)}
        />
      </div>
    </div>
  );
};
