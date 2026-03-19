import { useEffect, useState, useCallback, useRef } from 'react';
import { BaseDirectory, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useMediaDownload } from './useMediaDownload';
import { useAppSettings } from './useAppSettings';
import { fetchMediaVersionFromS3 } from '../api/restClient';
import { logInfo, logError } from '../logs/logging';

export interface MediaSyncStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

const MEDIA_META_FILE = 'media-meta.json';

/**
 * Automatically checks for media updates on mount and downloads if needed.
 * Returns a unified mediaStatus compatible with PatchScreen.
 */
export const useMediaSync = () => {
  const { downloadStatus, syncMediaFromZip } = useMediaDownload();
  const { settings } = useAppSettings();
  const [mediaStatus, setMediaStatus] = useState<MediaSyncStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const startedRef = useRef(false);

  const runMediaCheck = useCallback(async () => {
    try {
      if (settings?.appMode === 'SHOP_LIST') {
        logInfo('BOOT', 'App mode is SHOP_LIST, skipping media download');
        setMediaStatus({ status: 'done', progress: 100, message: 'SHOP_LISTモードのためメディア同期をスキップ' });
        return;
      }

      setMediaStatus({ status: 'checking', progress: 0, message: 'メディアデータを確認中…' });
      logInfo('BOOT', 'Checking for media updates via S3...');

      let localUpdatedAt: string | null = null;
      let localZipName: string | null = null;
      let isFirstBoot = false;

      try {
        const metaExists = await exists(MEDIA_META_FILE, { baseDir: BaseDirectory.AppLocalData });
        if (metaExists) {
          const metaContent = await readTextFile(MEDIA_META_FILE, { baseDir: BaseDirectory.AppLocalData });
          const meta = JSON.parse(metaContent);
          localUpdatedAt = meta.lastMediaUpdatedAt || null;
          localZipName = meta.lastZipName || null;
        } else {
          isFirstBoot = true;
        }
      } catch (e) {
        logInfo('BOOT', 'Failed to read media metadata, treating as first boot', {
          error: e instanceof Error ? e.message : String(e),
        });
        isFirstBoot = true;
      }

      if (!isFirstBoot) {
        try {
          const videosDirExists = await exists('videos', { baseDir: BaseDirectory.AppLocalData });
          if (!videosDirExists) {
            logInfo('BOOT', 'Media metadata exists but videos directory is missing, treating as first boot');
            isFirstBoot = true;
          }
        } catch {
          isFirstBoot = true;
        }
      }

      const mallId = settings?.mallId ?? 'sakaikitahanada';
      logInfo('BOOT', `Fetching media version from S3 (mallId: ${mallId})...`);
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
        timeoutId = setTimeout(() => {
          logInfo('BOOT', 'S3 latest.json request timed out, proceeding without update check');
          resolve({ zip: null, updated_at: null });
        }, 5000);
      });

      const remoteVersion = await Promise.race([
        fetchMediaVersionFromS3(mallId).finally(() => clearTimeout(timeoutId!)),
        timeoutPromise,
      ]);

      if (!isFirstBoot) {
        if (!remoteVersion.updated_at && !remoteVersion.zip) {
          logInfo('BOOT', 'Could not fetch remote media version, assuming up to date');
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
          return;
        }

        // Primary: ZIP filename comparison (reliable even when CDN caches latest.json)
        // If localZipName is null (old metadata format without zip tracking), treat as unknown → download
        const zipNameChanged = remoteVersion.zip != null && (
          localZipName == null || remoteVersion.zip !== localZipName
        );

        // Fallback: updated_at timestamp comparison (only when remote has no zip name)
        const timestampNewer = !remoteVersion.zip && localUpdatedAt && remoteVersion.updated_at
          ? new Date(remoteVersion.updated_at).getTime() > new Date(localUpdatedAt).getTime()
          : false;

        if (!zipNameChanged && !timestampNewer) {
          logInfo('BOOT', 'Media is already up to date, skipping download');
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
          return;
        }

        if (zipNameChanged) {
          logInfo('BOOT', `ZIP file changed: ${localZipName} → ${remoteVersion.zip}`);
        }
        if (timestampNewer) {
          logInfo('BOOT', `Media timestamp updated: ${localUpdatedAt} → ${remoteVersion.updated_at}`);
        }
      } else {
        logInfo('BOOT', 'First boot detected, will download media regardless of version check');
      }

      if (!remoteVersion.zip) {
        logInfo('BOOT', 'No zip filename in latest.json, skipping download');
        setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
        return;
      }

      const mediaZipUrl = `https://dl.tti.ninja/grain-link/medias/videos/${mallId}/${remoteVersion.zip}`;
      logInfo('BOOT', `${isFirstBoot ? 'First boot' : 'Found media update'}, downloading from: ${mediaZipUrl}`);
      setMediaStatus({ status: 'downloading', progress: 0, message: 'メディアデータをダウンロード中…' });

      await syncMediaFromZip(mediaZipUrl);

      const updatedAt = remoteVersion.updated_at || new Date().toISOString();
      try {
        await writeTextFile(
          MEDIA_META_FILE,
          JSON.stringify({ lastMediaUpdatedAt: updatedAt, lastZipName: remoteVersion.zip || null }),
          { baseDir: BaseDirectory.AppLocalData },
        );
        logInfo('BOOT', `Saved media metadata: ${updatedAt}`);
      } catch {
        // non-critical
      }

      setMediaStatus({ status: 'done', progress: 100, message: 'メディアの同期が完了しました' });
    } catch (error) {
      logError('BOOT', 'Failed to check media updates', {
        error: error instanceof Error ? error.message : String(error),
      });
      setMediaStatus({ status: 'error', progress: 0, message: 'メディアの更新に失敗しました' });
    }
  }, [syncMediaFromZip, settings?.appMode, settings?.mallId]);

  // Forward download progress from useMediaDownload into mediaStatus
  useEffect(() => {
    if (downloadStatus.status === 'downloading' || downloadStatus.status === 'extracting') {
      setMediaStatus({
        status: 'downloading',
        progress: downloadStatus.progress,
        message: downloadStatus.message,
      });
    }
  }, [downloadStatus.status, downloadStatus.progress, downloadStatus.message]);

  // Auto-run when settings are loaded
  useEffect(() => {
    if (settings && !startedRef.current) {
      startedRef.current = true;
      runMediaCheck();
    }
  }, [settings, runMediaCheck]);

  return { mediaStatus };
};
