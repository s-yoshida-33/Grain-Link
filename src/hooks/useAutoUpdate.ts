import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logWarn, logError } from '../logs/logging';

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  progress: number; // 0-100
  message: string;
}

export const useAutoUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const [update, setUpdate] = useState<any>(null);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setUpdateStatus({
          status: 'checking',
          progress: 0,
          message: 'アップデートを確認中...',
        });

        logWarn('UPDATER', 'Checking for app updates');

        // Tauri's built-in updater check
        const updateInfo = await check();

        if (updateInfo?.shouldUpdate) {
          logWarn('UPDATER', 'Update available', {
            currentVersion: updateInfo.currentVersion,
            latestVersion: updateInfo.latestVersion,
          });

          setUpdate(updateInfo);
          setUpdateStatus({
            status: 'available',
            progress: 0,
            message: `新しいバージョンが利用可能です (${updateInfo.latestVersion})`,
          });

          // 自動的にダウンロード開始
          await downloadAndInstallUpdate(updateInfo);
        } else {
          logWarn('UPDATER', 'App is up to date');
          setUpdateStatus({
            status: 'idle',
            progress: 0,
            message: '',
          });
        }
      } catch (error) {
        logError('UPDATER', 'Failed to check for updates', {
          error: error instanceof Error ? error.message : String(error),
        });

        setUpdateStatus({
          status: 'error',
          progress: 0,
          message: 'アップデート確認に失敗しました',
        });
      }
    };

    checkForUpdates();
  }, []);

  const downloadAndInstallUpdate = async (updateInfo: any) => {
    try {
      setUpdateStatus({
        status: 'downloading',
        progress: 10,
        message: 'アップデートをダウンロード中...',
      });

      logWarn('UPDATER', 'Starting update download');

      // Download the update
      await updateInfo.downloadAndInstall(
        new (class {
          finish() {
            setUpdateStatus({
              status: 'ready',
              progress: 100,
              message: 'アップデートレディ。再起動するとアップデートが适用されます。',
            });

            logWarn('UPDATER', 'Update ready to install');
          }

          progress(payload: any) {
            const progress = Math.round((payload.chunkLen / payload.contentLength) * 100);
            setUpdateStatus({
              status: 'downloading',
              progress,
              message: `ダウンロード中... ${progress}%`,
            });

            logWarn('UPDATER', 'Update download progress', { progress });
          }
        })()
      );
    } catch (error) {
      logError('UPDATER', 'Failed to download/install update', {
        error: error instanceof Error ? error.message : String(error),
      });

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
