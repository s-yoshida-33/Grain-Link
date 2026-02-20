// src/hooks/useAutoUpdate.ts

import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import type { Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logWarn, logError } from '../logs/logging';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatRemaining = (seconds: number): string => {
  if (seconds < 5) return '';
  const rounded = Math.ceil(seconds / 5) * 5;
  if (rounded < 60) return `残り約${rounded}秒`;
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return secs > 0 ? `残り約${mins}分${secs}秒` : `残り約${mins}分`;
};

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'uptodate';
  progress: number; // 0-100
  message: string;
}

export const useAutoUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setUpdateStatus({
          status: 'checking',
          progress: 0,
          message: 'アップデートを確認中...',
        });

        logWarn('UPDATER', 'Checking for app updates');

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Update check timeout')), 30000)
        );

        const update = await Promise.race([check(), timeoutPromise]);

        if (update) {
          logWarn('UPDATER', 'Update available', {
            version: update.version,
          });

          setUpdateStatus({
            status: 'available',
            progress: 0,
            message: `新しいバージョンが利用可能です (${update.version})`,
          });

          // 自動的にダウンロード開始
          await downloadAndInstallUpdate(update);
        } else {
          logWarn('UPDATER', 'App is up to date');
          setUpdateStatus({
            status: 'uptodate',
            progress: 0,
            message: '最新バージョンです',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('UPDATER', 'Failed to check for updates', {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });

        if (errorMessage.includes('timeout')) {
          logError('UPDATER', 'Update check timed out - possible network issue or DNS resolution problem');
        } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
          logError('UPDATER', 'SSL/Certificate error - check network configuration');
        }

        setUpdateStatus({
          status: 'error',
          progress: 0,
          message: 'アップデート確認に失敗しました',
        });
      }
    };

    checkForUpdates();
  }, []);

  const downloadAndInstallUpdate = async (update: Update) => {
    try {
      setUpdateStatus({
        status: 'downloading',
        progress: 0,
        message: 'アップデートをダウンロード中...',
      });

      logWarn('UPDATER', 'Starting update download');

      const downloadStartTime = Date.now();
      let contentLength = 0;
      let downloaded = 0;

      const downloadPromise = update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            logWarn('UPDATER', 'Download started', { contentLength });
            break;
          case 'Progress': {
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0
              ? Math.min(Math.round((downloaded / contentLength) * 100), 99)
              : 0;

            const elapsed = (Date.now() - downloadStartTime) / 1000;
            const speed = elapsed > 0 ? downloaded / elapsed : 0;
            const remaining = speed > 0 && contentLength > 0
              ? Math.ceil((contentLength - downloaded) / speed)
              : 0;

            const sizeStr = contentLength > 0
              ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}`
              : formatBytes(downloaded);
            const remainingStr = formatRemaining(remaining);
            const message = remainingStr
              ? `ダウンロード中... ${sizeStr} (${remainingStr})`
              : `ダウンロード中... ${sizeStr}`;

            setUpdateStatus({
              status: 'downloading',
              progress,
              message,
            });
            break;
          }
          case 'Finished':
            logWarn('UPDATER', 'Download finished, verifying signature...');
            setUpdateStatus({
              status: 'downloading',
              progress: 100,
              message: '署名を検証中...',
            });
            break;
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Update download timeout - took too long')), 600000)
      );

      await Promise.race([downloadPromise, timeoutPromise]);

      // downloadAndInstall の Promise が解決した = 署名検証もインストールも成功
      const downloadTime = (Date.now() - downloadStartTime) / 1000;
      logWarn('UPDATER', 'Update ready to install', { duration: `${downloadTime}s` });
      setUpdateStatus({
        status: 'ready',
        progress: 100,
        message: 'アップデート完了。5秒後に再起動します。',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('UPDATER', 'Failed to download/install update', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (errorMessage.includes('timeout')) {
        logError('UPDATER', 'Download timeout - possible slow/unstable network connection');
      }

      setUpdateStatus({
        status: 'error',
        progress: 0,
        message: 'アップデートのダウンロードに失敗しました',
      });
    }
  };

  const installUpdate = async () => {
    try {
      await relaunch();
    } catch (error) {
      logError('UPDATER', 'Failed to relaunch app', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    updateStatus,
    installUpdate,
    isUpdateAvailable: updateStatus.status === 'available',
    isUpdateReady: updateStatus.status === 'ready',
  };
};