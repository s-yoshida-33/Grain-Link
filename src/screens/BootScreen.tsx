import React, { useEffect, useState, useCallback } from 'react';
import { UpdateDialog, MediaDownloadDialog } from '../components/UpdateDialog';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload } from '../hooks/useMediaDownload';
import { useAppSettings } from '../hooks/useAppSettings';
import { logInfo, logError } from '../logs/logging';
import { BaseDirectory, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { fetchMediaAssetMetadata } from '../api/restClient';

interface BootScreenProps {
  onBootComplete: () => void;
}

type BootStage = 'update' | 'media' | 'countdown' | 'complete';

const MEDIA_META_FILE = 'media-meta.json';

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const { updateStatus, installUpdate } = useAutoUpdate();
  const { downloadStatus, syncMediaFromZip } = useMediaDownload();
  const { settings } = useAppSettings();

  const [currentStage, setCurrentStage] = useState<BootStage>('update');
  const [countdownSeconds, setCountdownSeconds] = useState(90);
  const [mediaStarted, setMediaStarted] = useState(false);

  // --- Stage 1: Update ---
  useEffect(() => {
    if (currentStage !== 'update') return;

    let timer: ReturnType<typeof setTimeout>;

    if (updateStatus.status === 'ready') {
      logInfo('BOOT', 'Update ready, restarting in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Executing auto-restart for update...');
        installUpdate();
      }, 5000);
    } else if (updateStatus.status === 'error') {
      logInfo('BOOT', 'Update error, skipping in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Auto-skipping update due to error');
        setCurrentStage('media');
      }, 5000);
    } else if (updateStatus.status === 'uptodate') {
      logInfo('BOOT', 'App is up to date, proceeding...');
      timer = setTimeout(() => setCurrentStage('media'), 1000);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [updateStatus.status, currentStage, installUpdate]);

  // --- Stage 2: Media check & download ---
  const startMediaCheck = useCallback(async () => {
    try {
      logInfo('BOOT', 'Checking for media updates via GitHub Release API...');

      // ローカルの media-meta.json を読み込み（存在しない場合は初回起動扱い）
      let localUpdatedAt: string | null = null;
      let isFirstBoot = false;
      try {
        const metaExists = await exists(MEDIA_META_FILE, { baseDir: BaseDirectory.AppLocalData });
        if (metaExists) {
          const metaContent = await readTextFile(MEDIA_META_FILE, { baseDir: BaseDirectory.AppLocalData });
          const meta = JSON.parse(metaContent);
          localUpdatedAt = meta.lastMediaUpdatedAt || null;
        } else {
          isFirstBoot = true;
        }
      } catch (e) {
        logInfo('BOOT', 'Failed to read media metadata, treating as first boot', {
          error: e instanceof Error ? e.message : String(e)
        });
        isFirstBoot = true;
      }

      // メディアディレクトリが存在しない場合も初回起動扱い（再インストール等で AppData が残っている場合の対策）
      if (!isFirstBoot) {
        try {
          const videosDirExists = await exists('videos', { baseDir: BaseDirectory.AppLocalData });
          if (!videosDirExists) {
            logInfo('BOOT', 'Media metadata exists but videos directory is missing, treating as first boot');
            isFirstBoot = true;
          }
        } catch {
          logInfo('BOOT', 'Failed to check videos directory, treating as first boot');
          isFirstBoot = true;
        }
      }

      // GitHub API からメディアの更新日時を取得（タイムアウト5秒）
      logInfo('BOOT', 'Fetching media metadata from GitHub...');
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<{ updated_at: string | null }>((resolve) => {
        timeoutId = setTimeout(() => {
          logInfo('BOOT', 'GitHub API request timed out, proceeding without update check');
          resolve({ updated_at: null });
        }, 5000);
      });

      const assetMetadata = await Promise.race([
        fetchMediaAssetMetadata('sakaikitahanada').finally(() => clearTimeout(timeoutId)),
        timeoutPromise
      ]);

      // 初回起動 → GitHub API の結果に関係なく必ずダウンロード
      // 2回目以降 → 日付比較して更新があればダウンロード
      if (!isFirstBoot) {
        if (!assetMetadata.updated_at) {
          logInfo('BOOT', 'Could not fetch remote media metadata, assuming up to date');
          setCurrentStage('countdown');
          return;
        }

        if (localUpdatedAt) {
          const remoteDate = new Date(assetMetadata.updated_at).getTime();
          const localDate = new Date(localUpdatedAt).getTime();

          if (remoteDate <= localDate) {
            logInfo('BOOT', 'Media is already up to date, skipping download');
            logInfo('BOOT', `Remote: ${assetMetadata.updated_at}, Local: ${localUpdatedAt}`);
            setCurrentStage('countdown');
            return;
          }
        }
      } else {
        logInfo('BOOT', 'First boot detected, will download media regardless of API result');
      }

      // メディアのダウンロード（初回 or 更新あり）
      const mediaZipUrl = `https://github.com/s-yoshida-33/Grain-Link/releases/latest/download/sakaikitahanada-media.zip`;
      logInfo('BOOT', `${isFirstBoot ? 'First boot' : 'Found media update'}, downloading from: ${mediaZipUrl}`);
      await syncMediaFromZip(mediaZipUrl);

      // ダウンロード完了後、メディアメタデータを保存
      const updatedAt = assetMetadata.updated_at || new Date().toISOString();
      try {
        await writeTextFile(
          MEDIA_META_FILE,
          JSON.stringify({ lastMediaUpdatedAt: updatedAt }),
          { baseDir: BaseDirectory.AppLocalData }
        );
        logInfo('BOOT', `Saved media metadata: ${updatedAt}`);
      } catch {
        // Non-critical failure
      }
    } catch (error) {
      logError('BOOT', 'Failed to check media updates', {
        error: error instanceof Error ? error.message : String(error)
      });
      logInfo('BOOT', 'Proceeding with startup despite media check failure');
      setCurrentStage('countdown');
    }
  }, [syncMediaFromZip]);

  useEffect(() => {
    if (currentStage === 'media' && settings && !mediaStarted) {
      setMediaStarted(true);
      startMediaCheck();
    }
  }, [currentStage, settings, mediaStarted, startMediaCheck]);

  // メディアダウンロード完了/エラー → カウントダウンへ
  useEffect(() => {
    if (currentStage !== 'media' || !mediaStarted) return;
    if (downloadStatus.status === 'completed' || downloadStatus.status === 'error') {
      logInfo('BOOT', 'Media sync stage finished');
      setTimeout(() => setCurrentStage('countdown'), 1000);
    }
  }, [downloadStatus.status, currentStage, mediaStarted]);

  // --- Stage 3: Countdown ---
  useEffect(() => {
    if (currentStage !== 'countdown') return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCurrentStage('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentStage]);

  // --- Stage 4: Complete ---
  useEffect(() => {
    if (currentStage === 'complete') {
      setTimeout(() => onBootComplete(), 500);
    }
  }, [currentStage, onBootComplete]);

  // --- Handlers ---
  const handleSkipUpdate = () => setCurrentStage('media');
  const handleSkipMedia = () => setCurrentStage('countdown');
  const handleSkipCountdown = () => setCurrentStage('complete');

  const getMediaDialogStatus = () => {
    if (downloadStatus.status === 'extracting') return 'downloading';
    return downloadStatus.status;
  };

  // --- Render ---

  // Phase 1: アップデートダイアログ
  if (currentStage === 'update') {
    return (
      <UpdateDialog
        isOpen={true}
        status={updateStatus.status === 'idle' ? 'checking' : updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onInstall={installUpdate}
        onDismiss={handleSkipUpdate}
      />
    );
  }

  // Phase 2: メディアダウンロードダイアログ
  if (currentStage === 'media' && mediaStarted && downloadStatus.status !== 'idle') {
    return (
      <MediaDownloadDialog
        isOpen={true}
        status={getMediaDialogStatus()}
        progress={downloadStatus.progress}
        message={downloadStatus.message}
        currentFile={downloadStatus.currentFile}
        totalFiles={downloadStatus.totalFiles}
        downloadedFiles={downloadStatus.downloadedFiles}
        onDismiss={handleSkipMedia}
      />
    );
  }

  // Phase 3: カウントダウン画面
  return (
    <div className="fixed inset-0 bg-linear-to-b from-gray-900 to-black flex items-center justify-center z-50">
      <div className="w-full h-full flex flex-col items-center justify-center gap-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Grain Link</h1>
          {currentStage === 'media' && (
            <p className="text-gray-400">メディアを確認中...</p>
          )}
        </div>

        {currentStage === 'countdown' && (
          <div className="w-96">
            <div className="text-center py-6 bg-gray-800 rounded">
              <div className="text-5xl font-bold text-white mb-2">{countdownSeconds}</div>
              <p className="text-gray-400 text-sm">Seconds remaining</p>
              <button
                onClick={handleSkipCountdown}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Start Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};